/**
 * RackElevation.jsx
 * Full inline-SVG technical rack elevation diagram.
 * Renders the rack as a crisp, professional front-elevation drawing.
 */
import { buildRackRows } from '../utils/rackUtils';
import {
  PatchPanelFace,
  SwitchFace,
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

// ── Layout constants ─────────────────────────────────────────────────────────
const RU_H       = 28;   // px per rack unit
const SVG_W      = 490;  // total SVG width
const HDR_H      = 42;   // header bar height
const FTR_H      = 22;   // footer bar height
const OUTER_PX   = 6;    // outer horizontal padding (left edge of SVG)
const RU_NUM_W   = 26;   // RU number strip width
const RAIL_W     = 14;   // mounting rail width (each side)
const DEVICE_X   = OUTER_PX + RU_NUM_W + RAIL_W;          // = 46
const DEVICE_W   = SVG_W - DEVICE_X - RAIL_W - OUTER_PX;  // = 424

// ── Colours ──────────────────────────────────────────────────────────────────
const C_OUTER    = '#b0b5be';   // outer frame colour
const C_BODY     = '#e4e7ec';   // rack interior background
const C_RAIL     = '#bcc0ca';   // mounting rail colour
const C_RU_BG    = '#d8dce4';   // RU number strip background
const C_RU_TEXT  = '#5a6272';   // RU number text
const C_BOLT     = '#9098a6';   // bolt hole fill
const C_BOLT_S   = '#7a8290';   // bolt hole stroke
const C_HDR      = '#363d4e';   // header/footer bar
const C_ROW_LINE = '#c4c8d0';   // horizontal RU separator

// ── Choose the right face component for a device type ───────────────────────
function renderFace(item, ruCount, x, y, w, h) {
  const props = { x, y, w, h, label: item.label || '', ruCount };
  switch (item.type) {
    case 'patch_panel': return <PatchPanelFace   key={y} {...props} />;
    case 'switch':      return <SwitchFace        key={y} {...props} />;
    case 'cable_manager': return <CableManagerFace key={y} {...props} />;
    case 'server':      return <ServerFace         key={y} {...props} />;
    case 'ups':         return <UPSFace            key={y} {...props} />;
    case 'pdu':         return <PDUFace            key={y} {...props} />;
    case 'fibre':       return <FibreFace          key={y} {...props} />;
    case 'firewall':    return <FirewallFace        key={y} {...props} />;
    case 'tray':
    case 'shelf':
    case 'desktop':
    case 'monitor': return <ShelfFace  key={y} {...props} />;
    case 'nvr':     return <ServerFace key={y} {...props} />;
    case 'empty':   return <EmptyFace  key={y} x={x} y={y} w={w} h={h} />;
    default:
      return <GenericFace key={y} {...props}
               typeStr={item.type?.replace(/_/g, ' ')} />;
  }
}

// ── Bolt holes in a mounting rail ────────────────────────────────────────────
function RailBolts({ railCX, maxRU }) {
  const holes = [];
  for (let i = 0; i < maxRU; i++) {
    // 3 holes per U (EIA-310 standard positions: 0.25", 0.875", 1.375")
    const positions = [0.2, 0.5, 0.8];
    positions.forEach((frac, j) => {
      const cy = HDR_H + i * RU_H + frac * RU_H;
      holes.push(
        <ellipse key={`${i}-${j}`}
          cx={railCX} cy={cy} rx={2.8} ry={2.5}
          fill={C_BOLT} stroke={C_BOLT_S} strokeWidth={0.5} />
      );
    });
  }
  return <>{holes}</>;
}

// ── Main component ────────────────────────────────────────────────────────────
export function RackElevation({ rack, innerRef }) {
  if (!rack) return null;

  const maxRU   = rack.maxRU || 42;
  const bodyH   = maxRU * RU_H;
  const totalH  = HDR_H + bodyH + FTR_H;
  const rows    = buildRackRows(rack);

  const leftRailX  = OUTER_PX + RU_NUM_W;
  const rightRailX = DEVICE_X + DEVICE_W;

  // Build device renders as a running-y approach (top → bottom)
  let currentY = HDR_H;
  const deviceElements = rows.map((row, idx) => {
    const rowH = row.height * RU_H;
    let el;

    if (row.type === 'item') {
      const faceY = currentY + 1;
      const faceH = rowH - 2;
      el = renderFace(row.item, row.height, DEVICE_X, faceY, DEVICE_W, faceH);
    } else {
      // empty RU
      el = <EmptyFace key={idx} x={DEVICE_X} y={currentY + 1}
                      w={DEVICE_W} h={RU_H - 2} />;
    }

    currentY += rowH;
    return el;
  });

  return (
    <div ref={innerRef} style={{ display: 'inline-block', background: '#fff', padding: '8px' }}>
      <svg
        width={SVG_W}
        height={totalH}
        viewBox={`0 0 ${SVG_W} ${totalH}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', fontFamily: "system-ui, -apple-system, 'Helvetica Neue', sans-serif" }}
        aria-label={`Rack elevation diagram: ${rack.rackName || 'Unnamed Rack'}`}
      >
        {/* ─── Outer rack frame ──────────────────────────────────────────── */}
        {/* Shadow layer */}
        <rect x={3} y={3} width={SVG_W - 4} height={totalH - 4}
          fill="rgba(0,0,0,0.12)" rx={5} />
        {/* Main frame body */}
        <rect x={0} y={0} width={SVG_W} height={totalH}
          fill={C_OUTER} rx={5} />
        {/* Inner bevel highlight */}
        <rect x={1} y={1} width={SVG_W - 2} height={4}
          fill="rgba(255,255,255,0.25)" rx={4} />

        {/* ─── Header ────────────────────────────────────────────────────── */}
        <rect x={0} y={0} width={SVG_W} height={HDR_H} fill={C_HDR} rx={5} />
        {/* Square off bottom corners of header */}
        <rect x={0} y={HDR_H - 8} width={SVG_W} height={8} fill={C_HDR} />

        <text x={SVG_W / 2} y={HDR_H / 2 - 5}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={13} fontWeight={700} fill="#eef0f4"
          letterSpacing={0.4}
        >{rack.rackName || 'Unnamed Rack'}</text>

        <text x={SVG_W / 2} y={HDR_H / 2 + 9}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={8} fill="#7a8898"
          fontFamily="'Courier New', Courier, monospace" letterSpacing={0.8}
        >{rack.rackNumber
            ? `RACK ${rack.rackNumber}  ·  ${maxRU}U`
            : `${maxRU}U`}
        </text>

        {/* ─── Rack body background ──────────────────────────────────────── */}
        <rect x={OUTER_PX} y={HDR_H} width={SVG_W - OUTER_PX * 2} height={bodyH}
          fill={C_BODY} />

        {/* ─── Horizontal RU separator lines ─────────────────────────────── */}
        {Array.from({ length: maxRU + 1 }, (_, i) => (
          <line key={i}
            x1={OUTER_PX} x2={SVG_W - OUTER_PX}
            y1={HDR_H + i * RU_H} y2={HDR_H + i * RU_H}
            stroke={C_ROW_LINE}
            strokeWidth={i === 0 || i === maxRU ? 1 : 0.4}
          />
        ))}

        {/* ─── RU number strip ───────────────────────────────────────────── */}
        <rect x={OUTER_PX} y={HDR_H} width={RU_NUM_W} height={bodyH}
          fill={C_RU_BG} />
        {/* Divider line between numbers and rail */}
        <line x1={OUTER_PX + RU_NUM_W} y1={HDR_H}
              x2={OUTER_PX + RU_NUM_W} y2={HDR_H + bodyH}
              stroke="#b0b8c4" strokeWidth={0.5} />

        {Array.from({ length: maxRU }, (_, i) => {
          const ru = maxRU - i;
          const cy = HDR_H + i * RU_H + RU_H / 2;
          return (
            <text key={ru}
              x={OUTER_PX + RU_NUM_W - 5} y={cy}
              textAnchor="end" dominantBaseline="middle"
              fontSize={8} fill={C_RU_TEXT}
              fontFamily="'Courier New', Courier, monospace"
            >{ru}</text>
          );
        })}

        {/* ─── Left mounting rail ────────────────────────────────────────── */}
        <rect x={leftRailX} y={HDR_H} width={RAIL_W} height={bodyH}
          fill={C_RAIL} />
        <rect x={leftRailX + 1} y={HDR_H} width={2} height={bodyH}
          fill="rgba(255,255,255,0.28)" />
        <RailBolts railCX={leftRailX + RAIL_W / 2} maxRU={maxRU} />

        {/* ─── Right mounting rail ───────────────────────────────────────── */}
        <rect x={rightRailX} y={HDR_H} width={RAIL_W} height={bodyH}
          fill={C_RAIL} />
        <rect x={rightRailX + RAIL_W - 3} y={HDR_H} width={2} height={bodyH}
          fill="rgba(255,255,255,0.28)" />
        <RailBolts railCX={rightRailX + RAIL_W / 2} maxRU={maxRU} />

        {/* ─── Device faceplates ─────────────────────────────────────────── */}
        {deviceElements}

        {/* ─── Footer ────────────────────────────────────────────────────── */}
        <rect x={0} y={HDR_H + bodyH} width={SVG_W} height={FTR_H} fill={C_HDR} />
        {/* Square off top corners of footer */}
        <rect x={0} y={HDR_H + bodyH} width={SVG_W} height={6} fill={C_HDR} />
        <rect x={0} y={HDR_H + bodyH + FTR_H - 5} width={SVG_W} height={5}
          fill={C_HDR} rx={4} />

        <text x={SVG_W / 2} y={HDR_H + bodyH + FTR_H / 2}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={7} fill="#607080"
          fontFamily="'Courier New', Courier, monospace" letterSpacing={1.2}
        >{`${maxRU}U RACK ELEVATION`}</text>

        {/* Corner bolt decorations */}
        {[
          [10, 10], [SVG_W - 10, 10],
          [10, totalH - 10], [SVG_W - 10, totalH - 10],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={4}
            fill="#4a5260" stroke="#3a4050" strokeWidth={0.5} />
        ))}
      </svg>
    </div>
  );
}
