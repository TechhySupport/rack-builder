import { NODE_SIZE } from './designNodes.js';

export const LAYER = { image: 0, rect: 1, ellipse: 1, link: 2, line: 3, path: 3, node: 4, text: 5 };

export function textLines(el) {
  return String(el.text || '').split('\n');
}

export function bboxOf(el, byId) {
  switch (el.type) {
    case 'node': {
      const labelWidth = (el.label || '').length * 7.4 + 8;
      const w = Math.max(NODE_SIZE, labelWidth);
      return { x: el.x + NODE_SIZE / 2 - w / 2, y: el.y, w, h: NODE_SIZE + (el.label ? 28 : 0) };
    }
    case 'text': {
      const lines = textLines(el);
      const w = Math.max(...lines.map((line) => line.length), 1) * el.size * 0.58;
      return { x: el.x, y: el.y, w, h: lines.length * el.size * 1.2 + 4 };
    }
    case 'line': {
      const x = Math.min(el.x1, el.x2);
      const y = Math.min(el.y1, el.y2);
      return { x, y, w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1) };
    }
    case 'path': {
      const xs = el.points.map((point) => point[0]);
      const ys = el.points.map((point) => point[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    case 'link': {
      const a = byId[el.from];
      const b = byId[el.to];
      if (!a || !b) return null;
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      return { x, y, w: Math.abs(b.x - a.x) + NODE_SIZE, h: Math.abs(b.y - a.y) + NODE_SIZE };
    }
    default:
      return { x: el.x, y: el.y, w: el.w, h: el.h };
  }
}

export function boundsOf(elements) {
  const byId = Object.fromEntries(elements.map((el) => [el.id, el]));
  const boxes = elements.map((el) => bboxOf(el, byId)).filter(Boolean);
  if (boxes.length === 0) return null;
  const x1 = Math.min(...boxes.map((box) => box.x));
  const y1 = Math.min(...boxes.map((box) => box.y));
  const x2 = Math.max(...boxes.map((box) => box.x + box.w));
  const y2 = Math.max(...boxes.map((box) => box.y + box.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

