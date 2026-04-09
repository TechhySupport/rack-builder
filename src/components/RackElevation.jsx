/**
 * RackElevation.jsx
 * Rack elevation diagram using 42rack.svg as the physical frame background,
 * with device faceplates overlaid at the correct mounting positions.
 */
import rackSvgUrl from '../assets/42rack.svg';
import { buildRackRows } from '../utils/rackUtils';
import {
  PatchPanelFace,
  SwitchFace,
  Catalyst2960Face,
  CableManagerFace,
  ServerFace,
  UPSFace,
  ShelfFace,
  PDUFace,
  FibreFace,
  FirewallFace,
  GenericFace,
  EmptyFace,
} from './DeviceFaces';

// ── 42rack.svg native coordinate constants ───────────────────────────────────
// SVG viewBox: 0 0 800 1956  (layer1 transform already accounted for below)
const RACK_SVG_W      = 800;
const RACK_SVG_H      = 1956;
// Device mounting area inside the SVG frame:
const SVG_DEV_X       = 175;    // left edge of the mounting area (px in SVG units)
const SVG_DEV_Y       = 44.45;  // top edge of mounting area
const SVG_DEV_W       = 450;    // width of device faceplate area
const SVG_DEV_H_42U   = 1867.05;// full mounting height for 42U
// RU label strip inside mounting area
const SVG_RU_LABEL_W  = 22;     // width reserved for RU numbers on left
const SVG_FACE_X      = SVG_DEV_X + SVG_RU_LABEL_W;
const SVG_FACE_W      = SVG_DEV_W - SVG_RU_LABEL_W;

// ── Display scaling ───────────────────────────────────────────────────────────
const RU_H_PX = 28; // desired pixels per rack unit in the display

// ── Colours ──────────────────────────────────────────────────────────────────
const C_RU_TEXT  = '#9ca8b8';
const C_ROW_SEP  = 'rgba(0,0,0,0.12)';

// ── Choose the right face component for a device type ───────────────────────
function renderFace(item, ruCount, x, y, w, h) {
  const props = { x, y, w, h, label: item.label || '', ruCount };
  switch (item.type) {
    case 'patch_panel':   return <PatchPanelFace   key={y} {...props} />;
    case 'switch':        return <SwitchFace        key={y} {...props} />;
    case 'catalyst_2960': return <Catalyst2960Face  key={y} {...props} />;
    case 'cable_manager': return <CableManagerFace  key={y} {...props} />;
    case 'server':        return <ServerFace         key={y} {...props} />;
    case 'ups':           return <UPSFace            key={y} {...props} />;
    case 'pdu':           return <PDUFace            key={y} {...props} />;
    case 'fibre':         return <FibreFace          key={y} {...props} />;
    case 'firewall':      return <FirewallFace        key={y} {...props} />;
    case 'tray':
    case 'shelf':
    case 'desktop':
    case 'monitor':       return <ShelfFace  key={y} {...props} />;
    case 'nvr':           return <ServerFace key={y} {...props} />;
    case 'empty':         return <EmptyFace  key={y} x={x} y={y} w={w} h={h} />;
    default:
      return <GenericFace key={y} {...props} typeStr={item.type?.replace(/_/g, ' ')} />;
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export function RackElevation({ rack, innerRef }) {
  if (!rack) return null;

  const maxRU = rack.maxRU || 42;
  const rows  = buildRackRows(rack);

  // Scale the SVG so device area equals maxRU * RU_H_PX pixels tall
  const ruH_svg   = SVG_DEV_H_42U / maxRU;  // SVG units per RU (for this rack)
  const scale     = (maxRU * RU_H_PX) / SVG_DEV_H_42U;
  const dispW     = Math.round(RACK_SVG_W * scale);
  const dispH     = Math.round(RACK_SVG_H * scale);

  // Build device elements in SVG coordinate space
  let currentY = SVG_DEV_Y;
  const deviceElements = [];
  const ruLines       = [];

  // RU separator lines across the mounting area
  for (let i = 0; i <= maxRU; i++) {
    const ly = SVG_DEV_Y + i * ruH_svg;
    ruLines.push(
      <line key={i}
        x1={SVG_DEV_X} x2={SVG_DEV_X + SVG_DEV_W}
        y1={ly} y2={ly}
        stroke={C_ROW_SEP} strokeWidth={0.6}
      />
    );
  }

  // RU number labels
  const ruLabels = Array.from({ length: maxRU }, (_, i) => {
    const ru = maxRU - i;
    const cy = SVG_DEV_Y + i * ruH_svg + ruH_svg / 2;
    return (
      <text key={ru}
        x={SVG_DEV_X + SVG_RU_LABEL_W - 3} y={cy}
        textAnchor="end" dominantBaseline="middle"
        fontSize={ruH_svg * 0.4} fill={C_RU_TEXT}
        fontFamily="'Courier New', Courier, monospace"
      >{ru}</text>
    );
  });

  rows.forEach((row, idx) => {
    const rowH = row.height * ruH_svg;
    if (row.type === 'item') {
      deviceElements.push(
        renderFace(row.item, row.height, SVG_FACE_X, currentY + 0.5, SVG_FACE_W, rowH - 1)
      );
    } else {
      deviceElements.push(
        <EmptyFace key={`empty-${idx}`}
          x={SVG_FACE_X} y={currentY + 0.5} w={SVG_FACE_W} h={rowH - 1} />
      );
    }
    currentY += rowH;
  });

  return (
    <div ref={innerRef} style={{ display: 'inline-block', background: 'transparent' }}>
      <svg
        width={dispW}
        height={dispH}
        viewBox={`0 0 ${RACK_SVG_W} ${RACK_SVG_H}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', fontFamily: "system-ui, -apple-system, 'Helvetica Neue', sans-serif" }}
        aria-label={`Rack elevation diagram: ${rack.rackName || 'Unnamed Rack'}`}
      >
        {/* ─── Physical rack frame as background ─────────────────────────── */}
        <image
          href={rackSvgUrl}
          x={0} y={0}
          width={RACK_SVG_W} height={RACK_SVG_H}
          preserveAspectRatio="none"
        />

        {/* ─── White background behind device area so faces are visible ──── */}
        <rect
          x={SVG_FACE_X} y={SVG_DEV_Y}
          width={SVG_FACE_W} height={maxRU * ruH_svg}
          fill="#e8eaed" opacity={0.92}
        />

        {/* ─── Row separator lines ────────────────────────────────────────── */}
        {ruLines}

        {/* ─── RU number labels ───────────────────────────────────────────── */}
        {ruLabels}

        {/* ─── Device faceplates ──────────────────────────────────────────── */}
        {deviceElements}

        {/* ─── Rack name label over the top bar of the SVG ───────────────── */}
        <text
          x={SVG_DEV_X + SVG_DEV_W / 2} y={SVG_DEV_Y / 2}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={18} fontWeight={700} fill="#f0f2f5"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing={0.5}
        >{rack.rackName || 'Unnamed Rack'}</text>
        {rack.rackNumber && (
          <text
            x={SVG_DEV_X + SVG_DEV_W / 2} y={SVG_DEV_Y / 2 + 13}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fill="#7a8898"
            fontFamily="'Courier New', Courier, monospace"
          >{`RACK ${rack.rackNumber}  ·  ${maxRU}U`}</text>
        )}
      </svg>
    </div>
  );
}

