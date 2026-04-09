/**
 * DeviceFaces.jsx
 * Inline-SVG faceplate components for technical rack elevation diagram.
 * Each component receives: { x, y, w, h, label, ruCount }
 * and returns SVG <g> content ready to embed inside an <svg>.
 */
import patchPanelSvg from '../assets/24-port_patch_panel.svg';
import switchSvg     from '../assets/48-Ports-Network-Switch-Generic.svg';
import extremeSvg    from '../assets/extreme_switch.svg';
import fibreSvg      from '../assets/Fibre.svg';
// upsSvg replaced with inline SVG for reliable scaling

// ── Palette ─────────────────────────────────────────────────────────────────
const C_STROKE  = '#878d96';
const C_PORT    = '#22262e';
const C_LABEL   = '#2e3240';
const C_SUB     = '#6b7280';
const C_LED_GRN = '#22c55e';
const C_SHINE   = 'rgba(255,255,255,0.32)';

// ── Helpers ──────────────────────────────────────────────────────────────────
function trunc(s, max) {
  if (!s) return '';
  const t = String(s);
  return t.length > max ? t.slice(0, max - 1) + '\u2026' : t;
}

/** Shared faceplate rect + top-shine strip */
function Face({ x, y, w, h, fill, children }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h}
        fill={fill} stroke={C_STROKE} strokeWidth={0.75} rx={1} />
      <rect x={x + 1} y={y + 1} width={w - 2} height={Math.min(2, h - 2)}
        fill={C_SHINE} rx={0.5} />
      {children}
    </g>
  );
}

/** Small label at right end of a 1RU face */
function InlineLabel({ x, y, w, h, label, maxChars = 22 }) {
  return (
    <text
      x={x + w - 7} y={y + h / 2}
      textAnchor="end" dominantBaseline="middle"
      fontSize={7} fill={C_SUB} fontFamily="'Courier New', Courier, monospace"
    >{trunc(label, maxChars)}</text>
  );
}

/** Centered label for multi-RU */
function CenterLabel({ x, y, w, h, label, typeStr, ruCount }) {
  const fontSize = ruCount >= 4 ? 10 : 9;
  const cy = y + h / 2;
  return (
    <g>
      {typeStr && ruCount >= 2 && (
        <text x={x + w / 2} y={cy - fontSize / 2 - 4}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={7} fill={C_SUB} fontFamily="'Courier New', Courier, monospace"
          letterSpacing={1}
        >{typeStr.toUpperCase()}</text>
      )}
      <text x={x + w / 2} y={typeStr && ruCount >= 2 ? cy + fontSize / 2 + 2 : cy}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={fontSize} fill={C_LABEL}
        fontFamily="system-ui, -apple-system, sans-serif"
      >{trunc(label, 30)}</text>
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH PANEL  (24-port_patch_panel.svg)
// ─────────────────────────────────────────────────────────────────────────────
export function PatchPanelFace({ x, y, w, h }) {
  return (
    <image href={patchPanelSvg} x={x} y={y} width={w} height={h}
      preserveAspectRatio="none" />
  );
}

// Voice patch panel reuses the same 24-port patch panel SVG
export function VoiceFace({ x, y, w, h }) {
  return (
    <image href={patchPanelSvg} x={x} y={y} width={w} height={h}
      preserveAspectRatio="none" />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SWITCH  (48-Ports-Network-Switch-Generic.svg)
// ─────────────────────────────────────────────────────────────────────────────
export function SwitchFace({ x, y, w, h }) {
  return (
    <image href={switchSvg} x={x} y={y} width={w} height={h}
      preserveAspectRatio="none" />
  );
}

/** (kept for internal reference) */
function SwitchFaceDetailed({ x, y, w, h, label, ruCount }) {
  const mgmtW = 34;
  const numPorts = 24;
  const pW = 8, pH = 10, gX = 3;
  const portAreaX = x + 10;
  const totalPortW = numPorts * (pW + gX) - gX;  // 245 px
  const portY = y + (h - pH) / 2;

  // LED dots above each port (if room)
  const showLed = h >= 24;
  const ledY = portY - 4;

  const ports = [];
  for (let p = 0; p < numPorts; p++) {
    const px = portAreaX + p * (pW + gX);
    ports.push(
      <g key={p}>
        {showLed && (
          <rect x={px} y={ledY} width={pW} height={2}
            fill={C_LED_GRN} opacity={0.65} rx={0.5} />
        )}
        <rect x={px} y={portY} width={pW} height={pH} fill={C_PORT} rx={1} />
        <rect x={px + 1} y={portY + 1} width={pW - 2} height={3}
          fill="#383d48" rx={0.5} />
      </g>
    );
  }

  // Management panel
  const mgmtX = x + w - mgmtW - 5;
  const mgmtY = y + 3;
  const mgmtH = h - 6;

  return (
    <Face x={x} y={y} w={w} h={h} fill="#c4cad4">
      {ports}
      <rect x={mgmtX} y={mgmtY} width={mgmtW} height={mgmtH}
        fill="#a8b0bc" stroke="#7a8492" strokeWidth={0.5} rx={1} />
      {/* Console port */}
      <circle cx={mgmtX + 8} cy={y + h / 2} r={3.5}
        fill="#1e2228" stroke="#505a68" strokeWidth={0.5} />
      {/* Small display */}
      <rect x={mgmtX + 14} y={mgmtY + 2} width={mgmtW - 16} height={mgmtH - 4}
        fill="#0f1218" rx={1} />
      <rect x={mgmtX + 15} y={mgmtY + 3} width={mgmtW - 18} height={3}
        fill="#1a4a28" rx={0.5} />
    </Face>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CABLE MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export function CableManagerFace({ x, y, w, h, label, ruCount }) {
  const slotW = 10, slotH = h - 6, gX = 4;
  const count = Math.floor((w - 12) / (slotW + gX));
  const totalW = count * (slotW + gX) - gX;
  const sx0 = x + (w - totalW) / 2;

  const slots = [];
  for (let i = 0; i < count; i++) {
    const sx = sx0 + i * (slotW + gX);
    slots.push(
      <g key={i}>
        <rect x={sx} y={y + 3} width={slotW} height={slotH}
          fill="#404550" rx={2} />
        <rect x={sx + 1} y={y + 4} width={slotW - 2} height={slotH - 2}
          fill="#333840" rx={1.5} />
        <rect x={sx + 1} y={y + 4} width={slotW - 2} height={3}
          fill="#555d6a" rx={1} />
      </g>
    );
  }

  return (
    <Face x={x} y={y} w={w} h={h} fill="#9098a2">
      {slots}
    </Face>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SERVER
// ─────────────────────────────────────────────────────────────────────────────
export function ServerFace({ x, y, w, h, label, ruCount }) {
  const numBays = ruCount >= 2 ? 8 : 4;
  const bayW = ruCount >= 2 ? 20 : 16;
  const bayH = Math.min(h - 8, 20);
  const bayGap = 3;
  const baysWidth = numBays * (bayW + bayGap) - bayGap;
  const bx0 = x + 8;
  const by0 = y + (h - bayH) / 2;

  const bays = [];
  for (let b = 0; b < numBays; b++) {
    const bx = bx0 + b * (bayW + bayGap);
    bays.push(
      <g key={b}>
        <rect x={bx} y={by0} width={bayW} height={bayH}
          fill="#1a1f28" stroke="#363c48" strokeWidth={0.5} rx={1} />
        <rect x={bx + 1} y={by0 + 1} width={bayW - 2} height={3}
          fill="#2a3040" rx={0.5} />
        <rect x={bx + 2} y={by0 + bayH - 3} width={bayW - 4} height={1.5}
          fill="#404858" rx={0.5} />
      </g>
    );
  }

  // Vent lines
  const ventX = bx0 + baysWidth + 10;
  const ventW = Math.min(w - (ventX - x) - 22, 70);
  const ventLines = Math.floor((h - 6) / 4);

  // Status indicators
  const statusX = x + w - 16;

  return (
    <Face x={x} y={y} w={w} h={h} fill="#c8ccd4">
      {bays}
      {/* Vent array */}
      {ventW > 0 && Array.from({ length: ventLines }, (_, i) => (
        <rect key={i}
          x={ventX} y={y + 4 + i * 4} width={ventW} height={2}
          fill="#9098a4" rx={0.5} />
      ))}
      {/* Power LED */}
      <circle cx={statusX} cy={y + h / 2 - 4} r={2.5} fill={C_LED_GRN} opacity={0.8} />
      {/* HDD LED */}
      <circle cx={statusX} cy={y + h / 2 + 4} r={2.5} fill="#f59e0b" opacity={0.5} />
    </Face>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  UPS  – APC SmartUPS rackmount style (inline SVG)
// ─────────────────────────────────────────────────────────────────────────────
export function UPSFace({ x, y, w, h, ruCount }) {
  const isTall = ruCount >= 2;
  const bodyH  = h - 4;
  const bodyY  = y + 2;

  // zones
  const lcdW   = Math.round(w * 0.18);
  const lcdX   = x + 8;
  const batW   = Math.round(w * 0.28);
  const batX   = lcdX + lcdW + 6;
  const ventX  = batX + batW + 6;
  const ventW  = Math.round(w * 0.16);
  const rightX = ventX + ventW + 6;
  const rightW = w - (rightX - x) - 10;

  // Battery bar segments
  const numSegs = 5;
  const segW    = Math.floor((batW - 4 - (numSegs - 1) * 2) / numSegs);
  const segH    = Math.max(4, Math.round(bodyH * 0.35));
  const segY    = bodyY + (bodyH - segH) / 2;

  // Vent slots
  const ventSlots = Math.floor(bodyH / 5);

  return (
    <Face x={x} y={y} w={w} h={h} fill="#3a3f4a">
      {/* LCD display */}
      <rect x={lcdX} y={bodyY + 2} width={lcdW} height={bodyH - 4}
        fill="#0a1a0a" rx={1.5} />
      <rect x={lcdX + 2} y={bodyY + 4} width={lcdW - 4} height={Math.round((bodyH - 8) * 0.55)}
        fill="#0d2a0d" rx={0.5} />
      {/* LCD bars */}
      {[0, 1, 2].map(i => (
        <rect key={i}
          x={lcdX + 3} y={bodyY + 5 + i * 3} width={lcdW - 6} height={1.5}
          fill="#22c55e" opacity={0.6} rx={0.3} />
      ))}
      <text x={lcdX + lcdW / 2} y={bodyY + bodyH - 4}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={4.5} fill="#22c55e" fontFamily="'Courier New', monospace"
      >100%</text>

      {/* Battery level bar */}
      <rect x={batX} y={segY - 2} width={batW} height={segH + 4}
        fill="#252830" rx={2} />
      {Array.from({ length: numSegs }, (_, i) => (
        <rect key={i}
          x={batX + 2 + i * (segW + 2)} y={segY} width={segW} height={segH}
          fill={i < 4 ? '#22c55e' : '#1a3a1a'} opacity={i < 4 ? 0.85 : 0.4} rx={0.5} />
      ))}
      {/* Battery icon cap */}
      <rect x={batX + batW} y={segY + Math.round(segH * 0.25)}
        width={3} height={Math.round(segH * 0.5)}
        fill="#505860" rx={1} />
      <text x={batX + batW / 2} y={bodyY + bodyH - 3}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={4} fill="#6a7888" fontFamily="'Courier New', monospace"
      >BATTERY</text>

      {/* Vent slots */}
      {Array.from({ length: ventSlots }, (_, i) => (
        <rect key={i}
          x={ventX} y={bodyY + 2 + i * 5} width={ventW} height={2.5}
          fill="#252830" rx={0.5} />
      ))}

      {/* Status LEDs (right zone) */}
      {rightW > 10 && (
        <g>
          {[['#22c55e', 'ON'], ['#22c55e', 'OK'], ['#f59e0b', 'BAT']].map(([col, lbl], i) => (
            <g key={i}>
              <circle cx={rightX + 5} cy={bodyY + 4 + i * 8} r={2.5}
                fill={col} opacity={0.85} />
              {isTall && (
                <text x={rightX + 10} y={bodyY + 5 + i * 8}
                  dominantBaseline="middle"
                  fontSize={4} fill="#8898a8" fontFamily="'Courier New', monospace"
                >{lbl}</text>
              )}
            </g>
          ))}
        </g>
      )}

      {/* Power button */}
      <circle cx={x + w - 7} cy={bodyY + bodyH / 2} r={4}
        fill="#1a1e28" stroke="#505868" strokeWidth={0.5} />
      <circle cx={x + w - 7} cy={bodyY + bodyH / 2} r={2.2}
        fill="#2a3040" />
      <rect x={x + w - 7.5} y={bodyY + bodyH / 2 - 3} width={1} height={3}
        fill="#22c55e" rx={0.3} />

      {/* APC brand text */}
      <text x={x + w - 7} y={bodyY + bodyH - 3}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={5} fill="#6070a0" fontFamily="system-ui, sans-serif" fontWeight={700}
      >APC</text>
    </Face>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PDU
// ─────────────────────────────────────────────────────────────────────────────
export function PDUFace({ x, y, w, h, label, ruCount }) {
  const outletDiam = Math.min(h - 8, 14);
  const outletCount = Math.floor((w - 60) / (outletDiam + 6));
  const ox0 = x + 8;
  const cy = y + h / 2;

  const outlets = [];
  for (let i = 0; i < outletCount; i++) {
    const ox = ox0 + i * (outletDiam + 6) + outletDiam / 2;
    outlets.push(
      <g key={i}>
        <circle cx={ox} cy={cy} r={outletDiam / 2}
          fill="#1e2228" stroke="#404858" strokeWidth={0.5} />
        {/* Hot/neutral pins */}
        <rect x={ox - 2} y={cy - outletDiam / 2 + 3} width={1.5}
          height={outletDiam / 2 - 2} fill="#505a68" rx={0.5} />
        <rect x={ox + 1} y={cy - outletDiam / 2 + 3} width={1.5}
          height={outletDiam / 2 - 2} fill="#505a68" rx={0.5} />
      </g>
    );
  }

  const labelX = ox0 + outletCount * (outletDiam + 6) + 6;

  return (
    <Face x={x} y={y} w={w} h={h} fill="#c4c8d0">
      {/* PDU badge */}
      <rect x={x + 2} y={y + 3} width={22} height={h - 6}
        fill="#9098a4" rx={1} />
      <text x={x + 13} y={y + h / 2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={6} fill="#e8eaee" fontFamily="'Courier New', monospace"
        letterSpacing={0.5}
      >PDU</text>
      {outlets}
    </Face>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHELF / TRAY
// ─────────────────────────────────────────────────────────────────────────────
export function ShelfFace({ x, y, w, h, label, ruCount }) {
  // Shelf front lip (bottom bar) + flat surface
  return (
    <Face x={x} y={y} w={w} h={h} fill="#d4d8de">
      {/* Shelf surface texture */}
      {ruCount >= 2 && Array.from({ length: 4 }, (_, i) => (
        <rect key={i}
          x={x + 8 + i * 14} y={y + h - 8} width={10} height={4}
          fill="#bcc0c8" rx={0.5} />
      ))}
      {/* Bottom lip */}
      <rect x={x + 2} y={y + h - 4} width={w - 4} height={3}
        fill="#a8adb8" rx={0.5} />
    </Face>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  FIBRE PANEL  (Fibre.svg)
// ─────────────────────────────────────────────────────────────────────────────
export function FibreFace({ x, y, w, h }) {
  return (
    <image href={fibreSvg} x={x} y={y} width={w} height={h}
      preserveAspectRatio="none" />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  FIREWALL (distinguished from generic)
// ─────────────────────────────────────────────────────────────────────────────
export function FirewallFace({ x, y, w, h, label, ruCount }) {
  const numPorts = 8;
  const pW = 8, pH = Math.min(10, h - 10), gX = 4;
  const portAreaW = numPorts * (pW + gX) - gX;
  const px0 = x + 10;
  const portY = y + (h - pH) / 2;

  const ports = [];
  for (let p = 0; p < numPorts; p++) {
    const px = px0 + p * (pW + gX);
    ports.push(
      <g key={p}>
        <rect x={px} y={portY} width={pW} height={pH} fill="#1e2a1a" rx={1} />
        <rect x={px + 1} y={portY + 1} width={pW - 2} height={3}
          fill="#284022" rx={0.5} />
        {/* Link LED */}
        <rect x={px} y={portY - 3} width={pW} height={2}
          fill="#22c55e" rx={0.5} opacity={0.7} />
      </g>
    );
  }

  return (
    <Face x={x} y={y} w={w} h={h} fill="#c8d0c8">
      {ports}
      {/* Firewall badge */}
      <rect x={px0 + portAreaW + 8} y={y + 3} width={28} height={h - 6}
        fill="#1a2a1a" rx={1} />
      <text x={px0 + portAreaW + 22} y={y + h / 2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={6} fill="#22c55e" fontFamily="'Courier New', monospace"
        letterSpacing={0.5}
      >FW</text>
    </Face>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  GENERIC / VOICE / DESKTOP / MONITOR / NVR / TRAY / UNKNOWN
// ─────────────────────────────────────────────────────────────────────────────
export function GenericFace({ x, y, w, h, label, ruCount, typeStr }) {
  // Decorative horizontal vent-like stripes on left quarter
  const stripeCount = Math.floor((h - 4) / 5);
  const stripeW = Math.round(w * 0.22);

  return (
    <Face x={x} y={y} w={w} h={h} fill="#ccd0d8">
      {Array.from({ length: stripeCount }, (_, i) => (
        <rect key={i}
          x={x + 8} y={y + 3 + i * 5} width={stripeW} height={2.5}
          fill="#9098a4" rx={0.5} />
      ))}
      {/* Status LED */}
      <circle cx={x + w - 12} cy={y + h / 2} r={3}
        fill="#1e2228" stroke="#404858" strokeWidth={0.5} />
      <circle cx={x + w - 12} cy={y + h / 2} r={1.5}
        fill={C_LED_GRN} opacity={0.6} />
    </Face>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CISCO (catalyst_2960) – uses generic 48-port switch SVG
//  EXTREME SWITCH – uses extreme_switch.svg
// ─────────────────────────────────────────────────────────────────────────────
export function Catalyst2960Face({ x, y, w, h }) {
  return (
    <image href={switchSvg} x={x} y={y} width={w} height={h}
      preserveAspectRatio="none" />
  );
}

export function ExtremeSwitchFace({ x, y, w, h }) {
  return (
    <image href={extremeSvg} x={x} y={y} width={w} height={h}
      preserveAspectRatio="none" />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  EMPTY SLOT
// ─────────────────────────────────────────────────────────────────────────────
export function EmptyFace({ x, y, w, h }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h}
        fill="#e8eaee" stroke="#cdd0d8" strokeWidth={0.5} rx={0.5} />
    </g>
  );
}
