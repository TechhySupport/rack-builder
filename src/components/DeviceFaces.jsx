/**
 * DeviceFaces.jsx
 * Inline-SVG faceplate components for technical rack elevation diagram.
 * Each component receives: { x, y, w, h, label, ruCount }
 * and returns SVG <g> content ready to embed inside an <svg>.
 */

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
//  PATCH PANEL
// ─────────────────────────────────────────────────────────────────────────────
export function PatchPanelFace({ x, y, w, h, label, ruCount }) {
  const rows    = ruCount >= 2 ? 2 : 1;
  const numPorts = 24;
  const pW = 7, pH = 9, gX = 2, gY = 5;
  const totalW = numPorts * (pW + gX) - gX;   // 214 px
  const totalH = rows * (pH + gY) - gY;
  const px0 = x + 10;
  const py0 = y + (h - totalH) / 2;

  const ports = [];
  for (let r = 0; r < rows; r++) {
    for (let p = 0; p < numPorts; p++) {
      const px = px0 + p * (pW + gX);
      const py = py0 + r * (pH + gY);
      ports.push(
        <g key={`${r}-${p}`}>
          <rect x={px} y={py} width={pW} height={pH} fill={C_PORT} rx={0.5} />
          {/* keystone latch notch hint */}
          <rect x={px + 1} y={py + pH - 2} width={pW - 2} height={1}
            fill="#3a3f48" />
        </g>
      );
    }
  }

  return (
    <Face x={x} y={y} w={w} h={h} fill="#cdd2d8">
      {ports}
      {ruCount === 1
        ? <InlineLabel x={x} y={y} w={w} h={h} label={label} />
        : <CenterLabel x={x + px0 + totalW + 8 - x} y={y} w={w - (px0 - x) - totalW - 12} h={h} label={label} ruCount={ruCount} />
      }
    </Face>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SWITCH
// ─────────────────────────────────────────────────────────────────────────────
export function SwitchFace({ x, y, w, h, label, ruCount }) {
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
      <InlineLabel x={x} y={y} w={mgmtX - x - 6} h={h} label={label} maxChars={28} />
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
      <text x={x + w / 2} y={y + h / 2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={7} fill="#c8ccd4" fontFamily="'Courier New', monospace"
      >{trunc(label, 28)}</text>
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
      <InlineLabel x={x} y={y} w={statusX - x - 6} h={h} label={label} maxChars={24} />
    </Face>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  UPS
// ─────────────────────────────────────────────────────────────────────────────
export function UPSFace({ x, y, w, h, label, ruCount }) {
  // Vent lines occupy left 55%
  const displayW = Math.min(90, Math.round(w * 0.28));
  const ventEndX = x + w - displayW - 14;
  const ventLines = Math.max(2, Math.floor((h - 4) / 4));

  // Display panel
  const displayX = x + w - displayW - 6;
  const displayY = y + 4;
  const displayH = h - 8;

  return (
    <Face x={x} y={y} w={w} h={h} fill="#b8bcc8">
      {/* Vent lines */}
      {Array.from({ length: ventLines }, (_, i) => (
        <line key={i}
          x1={x + 8} y1={y + 3 + i * 4}
          x2={ventEndX} y2={y + 3 + i * 4}
          stroke="#7a8090" strokeWidth={1.5} />
      ))}
      {/* Display panel */}
      <rect x={displayX} y={displayY} width={displayW} height={displayH}
        fill="#0d1018" stroke="#404858" strokeWidth={0.5} rx={2} />
      {/* Battery bar graphic */}
      <rect x={displayX + 3} y={displayY + 3} width={displayW - 6} height={4}
        fill="#1a3a22" rx={1} />
      <rect x={displayX + 3} y={displayY + 3}
        width={Math.round((displayW - 6) * 0.82)} height={4}
        fill="#22c55e" rx={1} opacity={0.8} />
      {/* Status text */}
      {displayH > 14 && (
        <text x={displayX + displayW / 2} y={displayY + 10}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={6} fill="#22c55e" fontFamily="'Courier New', monospace"
        >AC OK</text>
      )}
      {/* Power button */}
      <circle cx={displayX - 8} cy={y + h / 2} r={4}
        fill="#1e2228" stroke="#404858" strokeWidth={0.5} />
      <InlineLabel x={x} y={y} w={displayX - x - 14} h={h} label={label} maxChars={22} />
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
      <InlineLabel x={labelX - 20} y={y} w={w - (labelX - x) + 20} h={h} label={label} maxChars={20} />
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
      <CenterLabel x={x} y={y} w={w} h={h - 6} label={label}
        ruCount={ruCount} typeStr={ruCount >= 2 ? 'SHELF' : null} />
    </Face>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  FIBRE PANEL
// ─────────────────────────────────────────────────────────────────────────────
export function FibreFace({ x, y, w, h, label, ruCount }) {
  // LC-style duplex ports: pairs of small squares
  const rows = ruCount >= 2 ? 2 : 1;
  const pairsPerRow = 12;
  const pW = 5, pH = 8, gX = 3, pairGap = 5, gY = 5;
  const pairW = pW * 2 + 1;          // 11 px per pair
  const rowW = pairsPerRow * (pairW + gX + pairGap) - pairGap;
  const rowH = pH;
  const totalH = rows * (rowH + gY) - gY;
  const px0 = x + 10;
  const py0 = y + (h - totalH) / 2;

  const panels = [];
  for (let r = 0; r < rows; r++) {
    for (let pair = 0; pair < pairsPerRow; pair++) {
      const baseX = px0 + pair * (pairW + gX + pairGap);
      const baseY = py0 + r * (rowH + gY);
      panels.push(
        <g key={`${r}-${pair}`}>
          {/* Port A */}
          <rect x={baseX} y={baseY} width={pW} height={pH}
            fill="#1a0a2a" rx={0.5} />
          <rect x={baseX + 1} y={baseY + 1} width={pW - 2} height={3}
            fill="#4040b0" opacity={0.8} rx={0.5} />
          {/* Port B */}
          <rect x={baseX + pW + 1} y={baseY} width={pW} height={pH}
            fill="#1a0a2a" rx={0.5} />
          <rect x={baseX + pW + 2} y={baseY + 1} width={pW - 2} height={3}
            fill="#4040b0" opacity={0.8} rx={0.5} />
        </g>
      );
    }
  }

  return (
    <Face x={x} y={y} w={w} h={h} fill="#ccd0dc">
      {panels}
      <InlineLabel x={x} y={y} w={w} h={h} label={label} maxChars={22} />
    </Face>
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
      <InlineLabel x={x} y={y} w={w} h={h} label={label} maxChars={24} />
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
      <CenterLabel x={x + stripeW + 12} y={y} w={w - stripeW - 28} h={h}
        label={label} ruCount={ruCount} typeStr={typeStr} />
    </Face>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CISCO CATALYST 2960
// ─────────────────────────────────────────────────────────────────────────────
export function Catalyst2960Face({ x, y, w, h, label, ruCount }) {
  // Layout: [LED panel | 24 RJ45 ports (2×12) | model text | 2 SFP slots + console]
  const ledW    = 44;
  const ledX    = x + 4;
  const sfpW    = 44;
  const sfpX    = x + w - sfpW - 4;

  // Port area — 12 columns × 2 rows = 24 ports (stacked pairs)
  const numCols = 12;
  const pW = 9, pH = 10, colGap = 3, rowGap = 3;
  const totalPortW = numCols * (pW + colGap) - colGap;  // 129 px
  const portX0 = ledX + ledW + 6;
  const totalPortH = pH * 2 + rowGap;
  const portY0 = y + (h - totalPortH) / 2;

  const ports = [];
  for (let col = 0; col < numCols; col++) {
    const px = portX0 + col * (pW + colGap);
    // Top row (ports 1, 3, 5 … 23)
    ports.push(
      <g key={`t${col}`}>
        <rect x={px} y={portY0 - 2} width={pW} height={2}
          fill={C_LED_GRN} opacity={0.65} rx={0.3} />
        <rect x={px} y={portY0} width={pW} height={pH}
          fill={C_PORT} rx={0.5} />
        <rect x={px + 1} y={portY0 + 1} width={pW - 2} height={3}
          fill="#383d48" rx={0.3} />
      </g>
    );
    // Bottom row (ports 2, 4, 6 … 24)
    const py2 = portY0 + pH + rowGap;
    ports.push(
      <g key={`b${col}`}>
        <rect x={px} y={py2} width={pW} height={pH}
          fill={C_PORT} rx={0.5} />
        <rect x={px + 1} y={py2 + 1} width={pW - 2} height={3}
          fill="#383d48" rx={0.3} />
        <rect x={px} y={py2 + pH + 1} width={pW} height={2}
          fill={C_LED_GRN} opacity={0.4} rx={0.3} />
      </g>
    );
  }

  // Model label area between ports and SFP panel
  const labelX0 = portX0 + totalPortW + 6;
  const labelAreaW = sfpX - labelX0 - 4;

  // SFP slots (2 stacked)
  const sfpSlotH = Math.floor((h - 8) / 2) - 1;
  const sfpSlotW = sfpW - 8;

  return (
    <Face x={x} y={y} w={w} h={h} fill="#b8c2cc">
      {/* Left LED status panel */}
      <rect x={ledX} y={y + 2} width={ledW} height={h - 4}
        fill="#a0aab6" stroke="#788090" strokeWidth={0.5} rx={1} />
      {/* SYST LED */}
      <circle cx={ledX + 7} cy={y + h / 2 - 7} r={2.8}
        fill={C_LED_GRN} opacity={0.9} />
      <text x={ledX + 13} y={y + h / 2 - 7}
        dominantBaseline="middle" fontSize={5.5} fill="#e4e8ee"
        fontFamily="'Courier New', monospace">SYST</text>
      {/* RPS LED */}
      <circle cx={ledX + 7} cy={y + h / 2 + 1} r={2.2}
        fill="#f59e0b" opacity={0.45} />
      <text x={ledX + 13} y={y + h / 2 + 1}
        dominantBaseline="middle" fontSize={5.5} fill="#e4e8ee"
        fontFamily="'Courier New', monospace">RPS</text>
      {/* STAT LED */}
      <circle cx={ledX + 7} cy={y + h / 2 + 8} r={2.2}
        fill={C_LED_GRN} opacity={0.5} />
      <text x={ledX + 13} y={y + h / 2 + 8}
        dominantBaseline="middle" fontSize={5.5} fill="#e4e8ee"
        fontFamily="'Courier New', monospace">STAT</text>
      {/* Mode button */}
      <circle cx={ledX + ledW - 8} cy={y + h / 2} r={4}
        fill="#1e2228" stroke="#505a68" strokeWidth={0.5} />

      {/* 24 RJ45 ports */}
      {ports}

      {/* Model text */}
      {labelAreaW > 12 && (
        <g>
          <text x={labelX0 + labelAreaW / 2} y={y + h / 2 - 4}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={6} fill="#3a4555" fontFamily="'Courier New', monospace"
            letterSpacing={0.8}
          >CISCO</text>
          <text x={labelX0 + labelAreaW / 2} y={y + h / 2 + 4}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={5.5} fill="#5a6272" fontFamily="'Courier New', monospace"
          >{trunc(label, 14)}</text>
        </g>
      )}

      {/* Right SFP + console panel */}
      <rect x={sfpX} y={y + 2} width={sfpW} height={h - 4}
        fill="#909aa6" stroke="#6a7280" strokeWidth={0.5} rx={1} />
      {/* SFP 1 */}
      <rect x={sfpX + 4} y={y + 3} width={sfpSlotW} height={sfpSlotH}
        fill="#1e2228" stroke="#363c48" strokeWidth={0.4} rx={1} />
      <text x={sfpX + 4 + sfpSlotW / 2} y={y + 3 + sfpSlotH / 2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={5} fill="#505a68" fontFamily="'Courier New', monospace"
      >SFP1</text>
      {/* SFP 2 */}
      <rect x={sfpX + 4} y={y + 3 + sfpSlotH + 2} width={sfpSlotW} height={sfpSlotH}
        fill="#1e2228" stroke="#363c48" strokeWidth={0.4} rx={1} />
      <text x={sfpX + 4 + sfpSlotW / 2} y={y + 3 + sfpSlotH + 2 + sfpSlotH / 2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={5} fill="#505a68" fontFamily="'Courier New', monospace"
      >SFP2</text>
    </Face>
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
