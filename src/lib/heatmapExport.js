// Renders a heat map (plan, coverage, walls, devices and legend) to SVG, PNG or JPEG.

import { LEGEND, materialOf } from './heatmap.js';

const DEVICE_LETTER = { ap: 'AP', repeater: 'M', das: 'D' };
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (value) => String(value).replace(/[&<>"]/g, (char) => ESCAPES[char]);
const fmt = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, ''));

function gridToDataUrl(grid) {
  const canvas = document.createElement('canvas');
  canvas.width = grid.columns;
  canvas.height = grid.rows;
  canvas.getContext('2d').putImageData(new ImageData(grid.data, grid.columns, grid.rows), 0, 0);
  return canvas.toDataURL('image/png');
}

export function buildHeatmapSvg({ plan, grid, walls, devices, scale, caption }) {
  const font = Math.max(12, Math.round(plan.width / 100));
  const footer = Math.round(font * 4.4);
  const height = plan.height + footer;
  const parts = [
    `<rect width="${plan.width}" height="${height}" fill="#ffffff"/>`,
    `<image href="${esc(plan.src)}" x="0" y="0" width="${plan.width}" height="${plan.height}"/>`,
  ];
  if (grid) parts.push(`<image href="${gridToDataUrl(grid)}" x="0" y="0" width="${plan.width}" height="${plan.height}" opacity="0.5" preserveAspectRatio="none"/>`);
  for (const wall of walls) {
    parts.push(`<line x1="${wall.x1}" y1="${wall.y1}" x2="${wall.x2}" y2="${wall.y2}" stroke="${materialOf(wall.material).color}" stroke-width="4" stroke-linecap="round"/>`);
  }
  if (scale) {
    const midX = (scale.p1.x + scale.p2.x) / 2;
    const midY = (scale.p1.y + scale.p2.y) / 2 - 8;
    parts.push(
      `<g stroke="#e11d8f" stroke-width="2" fill="#e11d8f"><line x1="${scale.p1.x}" y1="${scale.p1.y}" x2="${scale.p2.x}" y2="${scale.p2.y}"/>`
      + `<circle cx="${scale.p1.x}" cy="${scale.p1.y}" r="4" stroke="none"/><circle cx="${scale.p2.x}" cy="${scale.p2.y}" r="4" stroke="none"/>`
      + `<text x="${midX}" y="${midY}" stroke="#ffffff" stroke-width="3" paint-order="stroke" font-size="13" font-weight="700" text-anchor="middle" font-family="Arial, sans-serif">${esc(fmt(scale.metres))} m</text></g>`,
    );
  }
  for (const device of devices) {
    parts.push(
      `<g transform="translate(${device.x} ${device.y})" font-family="Arial, sans-serif" text-anchor="middle">`
      + '<circle r="12" fill="#1e293b" stroke="#ffffff" stroke-width="2"/>'
      + `<text y="3.5" fill="#ffffff" font-size="10" font-weight="800">${DEVICE_LETTER[device.type] || 'AP'}</text>`
      + `<text y="28" fill="#111827" stroke="#ffffff" stroke-width="3" paint-order="stroke" font-size="12" font-weight="700">${esc(device.name)}</text></g>`,
    );
  }

  const legendY = plan.height + font * 3.2;
  parts.push(`<text x="${font}" y="${plan.height + font * 1.6}" font-size="${font}" font-weight="700" fill="#111827" font-family="Arial, sans-serif">${esc(caption)}</text>`);
  let x = font;
  for (const step of LEGEND) {
    parts.push(
      `<rect x="${x}" y="${legendY - font * 0.9}" width="${font}" height="${font}" rx="3" fill="rgb(${step.color.join(',')})"/>`
      + `<text x="${x + font * 1.4}" y="${legendY}" font-size="${font * 0.9}" fill="#374151" font-family="Arial, sans-serif"><tspan font-weight="700">${step.label}</tspan> ${esc(step.range)}</text>`,
    );
    x += font * 13;
  }
  return {
    width: plan.width,
    height,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" width="${plan.width}" height="${height}" viewBox="0 0 ${plan.width} ${height}">${parts.join('')}</svg>`,
  };
}

function saveBlob(blob, name, extension) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${(name.trim() || 'heat-map').replace(/[^\w-]+/g, '-')}.${extension}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export async function downloadHeatmap(format, name, input) {
  const { markup, width, height } = buildHeatmapSvg(input);
  const svgBlob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  if (format === 'svg') {
    saveBlob(svgBlob, name, 'svg');
    return;
  }
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Could not export the heat map.'));
      element.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.92));
    if (!blob) throw new Error('Could not export the heat map.');
    saveBlob(blob, name, format === 'jpeg' ? 'jpg' : 'png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
