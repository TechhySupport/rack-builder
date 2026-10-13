// Turns an uploaded image or PDF into a compressed JPEG data URL small enough to store in the document.

const MAX_SIDE = 2400;
const MAX_FILE_BYTES = 30 * 1024 * 1024;

function drawToJpeg(source, width, height) {
  const ratio = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return { src: canvas.toDataURL('image/jpeg', 0.85), width: canvas.width, height: canvas.height };
}

async function fromImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('That image could not be read.'));
      element.src = url;
    });
    return drawToJpeg(image, image.naturalWidth, image.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fromPdf(file) {
  const [pdfjs, { default: workerSrc }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: MAX_SIDE / Math.max(base.width, base.height) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    return { src: canvas.toDataURL('image/jpeg', 0.85), width: canvas.width, height: canvas.height };
  } finally {
    task.destroy();
  }
}

// Normalises two corner points into a whole-pixel box inside the plan.
export function cropBox(p1, p2, plan) {
  const x1 = Math.max(0, Math.min(p1.x, p2.x));
  const y1 = Math.max(0, Math.min(p1.y, p2.y));
  const x2 = Math.min(plan.width, Math.max(p1.x, p2.x));
  const y2 = Math.min(plan.height, Math.max(p1.y, p2.y));
  return { x: Math.round(x1), y: Math.round(y1), w: Math.round(x2 - x1), h: Math.round(y2 - y1) };
}

export async function cropFloorPlan(plan, box) {
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('The floor plan could not be cropped.'));
    element.src = plan.src;
  });
  const canvas = document.createElement('canvas');
  canvas.width = box.w;
  canvas.height = box.h;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, box.w, box.h);
  const ratio = image.naturalWidth / plan.width;
  context.drawImage(image, box.x * ratio, box.y * ratio, box.w * ratio, box.h * ratio, 0, 0, box.w, box.h);
  return { src: canvas.toDataURL('image/jpeg', 0.9), width: box.w, height: box.h };
}

export async function importFloorPlan(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error('That file is larger than 30 MB.');
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf && !file.type.startsWith('image/')) throw new Error('Choose an image or a PDF.');
  const plan = isPdf ? await fromPdf(file) : await fromImage(file);
  return { ...plan, name: file.name };
}
