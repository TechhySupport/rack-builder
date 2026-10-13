import { NODE_SIZE, fontFamily, nodeKind } from '../lib/designNodes.js';
import { textLines } from '../lib/designGeometry.js';
import { GlyphPaths } from './DesignGlyph.jsx';

const FONT = 'Manrope, system-ui, sans-serif';
const INK = '#1f2937';
const ACCENT = '#2563eb';
const dashFor = (el) => (el.dashed ? `${Math.max(6, el.width * 3)} ${Math.max(5, el.width * 2.5)}` : undefined);

function pathD(points) {
  if (points.length === 1) return `M${points[0][0]} ${points[0][1]}h.01`;
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const mx = (points[i][0] + points[i + 1][0]) / 2;
    const my = (points[i][1] + points[i + 1][1]) / 2;
    d += ` Q${points[i][0]} ${points[i][1]} ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  return `${d} L${last[0]} ${last[1]}`;
}

function arrowHeadD(x1, y1, x2, y2, width) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 12 + width * 2;
  const spread = 0.5;
  const ax = x2 - size * Math.cos(angle - spread);
  const ay = y2 - size * Math.sin(angle - spread);
  const bx = x2 - size * Math.cos(angle + spread);
  const by = y2 - size * Math.sin(angle + spread);
  return `M${ax} ${ay} L${x2} ${y2} L${bx} ${by}`;
}

export default function ElementView({ el, byId, linkOffsets, zoom, selected }) {
  const hitWidth = Math.max(14 / zoom, (el.width || 2) + 6);
  switch (el.type) {
    case 'image':
      return <g data-el={el.id}><image href={el.src} x={el.x} y={el.y} width={el.w} height={el.h} preserveAspectRatio="none" /></g>;
    case 'rect':
      return (
        <g data-el={el.id}>
          <rect x={el.x} y={el.y} width={el.w} height={el.h} rx="6" fill={el.fill ? el.color : 'none'} fillOpacity={el.fill ? 0.1 : undefined} stroke={el.color} strokeWidth={el.width} strokeDasharray={dashFor(el)} />
        </g>
      );
    case 'ellipse':
      return (
        <g data-el={el.id}>
          <ellipse cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2} fill={el.fill ? el.color : 'none'} fillOpacity={el.fill ? 0.1 : undefined} stroke={el.color} strokeWidth={el.width} strokeDasharray={dashFor(el)} />
        </g>
      );
    case 'path': {
      const d = pathD(el.points);
      return (
        <g data-el={el.id}>
          {selected && <path data-ui d={d} fill="none" stroke={ACCENT} strokeOpacity=".28" strokeWidth={el.width + 8} strokeLinecap="round" strokeLinejoin="round" />}
          <path d={d} fill="none" stroke={el.color} strokeWidth={el.width} strokeLinecap="round" strokeLinejoin="round" />
          <path data-ui d={d} fill="none" stroke="transparent" strokeWidth={hitWidth} pointerEvents="stroke" />
        </g>
      );
    }
    case 'line':
      return (
        <g data-el={el.id}>
          {selected && <line data-ui x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={ACCENT} strokeOpacity=".28" strokeWidth={el.width + 8} strokeLinecap="round" />}
          <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={el.color} strokeWidth={el.width} strokeLinecap="round" strokeDasharray={dashFor(el)} />
          {el.arrow && <path d={arrowHeadD(el.x1, el.y1, el.x2, el.y2, el.width)} fill="none" stroke={el.color} strokeWidth={el.width} strokeLinecap="round" strokeLinejoin="round" />}
          <line data-ui x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="transparent" strokeWidth={hitWidth} pointerEvents="stroke" />
        </g>
      );
    case 'link': {
      const a = byId[el.from];
      const b = byId[el.to];
      if (!a || !b) return null;
      const { index, count } = linkOffsets[el.id];
      const ax = a.x + NODE_SIZE / 2;
      const ay = a.y + NODE_SIZE / 2;
      const bx = b.x + NODE_SIZE / 2;
      const by = b.y + NODE_SIZE / 2;
      const length = Math.hypot(bx - ax, by - ay) || 1;
      const offset = (index - (count - 1) / 2) * 16;
      const nx = (-(by - ay) / length) * offset;
      const ny = ((bx - ax) / length) * offset;
      const x1 = ax + nx;
      const y1 = ay + ny;
      const x2 = bx + nx;
      const y2 = by + ny;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const labelWidth = (el.label || '').length * 7 + 14;
      return (
        <g data-el={el.id}>
          {selected && <line data-ui x1={x1} y1={y1} x2={x2} y2={y2} stroke={ACCENT} strokeOpacity=".28" strokeWidth={el.width + 8} strokeLinecap="round" />}
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={el.color} strokeWidth={el.width} strokeLinecap="round" strokeDasharray={dashFor(el)} />
          <line data-ui x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={hitWidth} pointerEvents="stroke" />
          {el.label && (
            <>
              <rect x={mx - labelWidth / 2} y={my - 11} width={labelWidth} height="22" rx="6" fill="#ffffff" stroke={el.color} strokeWidth="1" />
              <text x={mx} y={my + 4.5} textAnchor="middle" fontFamily={FONT} fontSize="12" fontWeight="700" fill={INK}>{el.label}</text>
            </>
          )}
        </g>
      );
    }
    case 'node': {
      const kind = nodeKind(el.kind);
      return (
        <g data-el={el.id}>
          <rect x={el.x} y={el.y} width={NODE_SIZE} height={NODE_SIZE} rx="14" fill="#ffffff" />
          <rect x={el.x} y={el.y} width={NODE_SIZE} height={NODE_SIZE} rx="14" fill={el.color} fillOpacity=".1" stroke={el.color} strokeWidth="2" />
          <g transform={`translate(${el.x + 14} ${el.y + 14}) scale(1.5)`}><GlyphPaths glyph={kind.glyph} color={el.color} /></g>
          {el.label && <text x={el.x + NODE_SIZE / 2} y={el.y + NODE_SIZE + 18} textAnchor="middle" fontFamily={FONT} fontSize="13" fontWeight="700" fill={INK}>{el.label}</text>}
        </g>
      );
    }
    case 'text':
      return (
        <g data-el={el.id}>
          <text fontFamily={fontFamily(el.font)} fontSize={el.size} fontWeight="600" fill={el.color}>
            {textLines(el).map((line, index) => <tspan key={index} x={el.x} y={el.y + el.size * (index + 1)}>{line || ' '}</tspan>)}
          </text>
        </g>
      );
    default:
      return null;
  }
}
