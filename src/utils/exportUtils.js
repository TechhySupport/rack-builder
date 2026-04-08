import { toPng } from 'html-to-image';

// ─── Download a JS object as a JSON file ───────────────────────────────────────
export function downloadJsonFile(data, filename = 'racks.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Export a DOM element as PNG using html-to-image ──────────────────────────
export async function exportRackAsPng(elementRef, filename = 'rack.png') {
  if (!elementRef) throw new Error('No element to export.');
  const dataUrl = await toPng(elementRef, {
    backgroundColor: '#ffffff',
    pixelRatio: 2,
    style: { fontFamily: 'system-ui, sans-serif' },
  });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

// ─── Read a File object and return its text content ───────────────────────────
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}
