// Wi-Fi coverage estimate: log-distance path loss plus the loss of every wall the straight line crosses.

export const BANDS = [
  { id: '24', label: '2.4 GHz', lossAt1m: 40 },
  { id: '5', label: '5 GHz', lossAt1m: 47 },
];

export const PHONE_POWER_DBM = 15;

export const BAND_OPTIONS = [{ id: 'all', label: 'All' }, ...BANDS];

export const VIEWS = [
  { id: 'expected', label: 'Expected' },
  { id: 'pessimistic', label: 'Pessimistic' },
  { id: 'optimistic', label: 'Optimistic' },
];

export const ENVIRONMENTS = [
  { id: 'open', label: 'Open space', n: 2 },
  { id: 'house', label: 'Typical house', n: 3 },
  { id: 'cluttered', label: 'Cluttered', n: 3.5 },
];

export const WALL_MATERIALS = [
  { id: 'plasterboard', label: 'Plasterboard', loss: { 24: 3, 5: 5 }, color: '#8b7d6b' },
  { id: 'wood-door', label: 'Wood door', loss: { 24: 3, 5: 4 }, color: '#a0662c' },
  { id: 'glass', label: 'Glass', loss: { 24: 2, 5: 4 }, color: '#0891b2' },
  { id: 'low-e-glass', label: 'Low-e glass', loss: { 24: 20, 5: 25 }, color: '#2563eb' },
  { id: 'brick', label: 'Brick', loss: { 24: 8, 5: 12 }, color: '#b4472f' },
  { id: 'concrete', label: 'Concrete', loss: { 24: 15, 5: 25 }, color: '#4b5563' },
  { id: 'metal', label: 'Metal', loss: { 24: 30, 5: 35 }, color: '#7c3aed' },
];
export const DEFAULT_MATERIAL = 'plasterboard';

export const DEVICE_TYPES = [
  { id: 'ap', label: 'Access point', short: 'AP' },
  { id: 'repeater', label: 'Repeater / mesh', short: 'Mesh' },
  { id: 'das', label: 'DAS antenna', short: 'DAS' },
];
export const DEFAULT_POWER = { 24: 20, 5: 23 };

// Strongest bands first; the lowest threshold is the floor of the band.
export const LEGEND = [
  { id: 'good', label: 'Good', range: '-67 dBm or better', min: -67, color: [34, 170, 84] },
  { id: 'ok', label: 'OK', range: '-67 to -75 dBm', min: -75, color: [245, 208, 32] },
  { id: 'weak', label: 'Weak', range: '-75 to -80 dBm', min: -80, color: [245, 140, 30] },
  { id: 'dead', label: 'Dead', range: 'Below -80 dBm', min: -Infinity, color: [220, 38, 38] },
];

export const DEFAULT_SETTINGS = { band: 'all', view: 'expected', environment: 'house', uncertainty: 6 };

export const EMPTY_HEATMAP = { version: 1, plan: null, scale: null, walls: [], devices: [], settings: DEFAULT_SETTINGS };

const materialById = new Map(WALL_MATERIALS.map((material) => [material.id, material]));
export const materialOf = (id) => materialById.get(id) || materialById.get(DEFAULT_MATERIAL);

export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function pixelsPerMetre(scale) {
  if (!scale || !(scale.metres > 0)) return null;
  const length = distance(scale.p1, scale.p2);
  return length > 0 ? length / scale.metres : null;
}

// True when segment p-q crosses segment a-b.
function crosses(px, py, qx, qy, wall) {
  const rx = qx - px;
  const ry = qy - py;
  const sx = wall.x2 - wall.x1;
  const sy = wall.y2 - wall.y1;
  const denominator = rx * sy - ry * sx;
  if (denominator === 0) return false;
  const t = ((wall.x1 - px) * sy - (wall.y1 - py) * sx) / denominator;
  const u = ((wall.x1 - px) * ry - (wall.y1 - py) * rx) / denominator;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function distanceToSegment(point, wall) {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - wall.x1) * dx + (point.y - wall.y1) * dy) / lengthSquared));
  return Math.hypot(point.x - (wall.x1 + t * dx), point.y - (wall.y1 + t * dy));
}

// Pre-resolves everything that does not depend on the point being measured.
// "All" keeps one model per band and shows the best signal a client could get on either.
export function prepareModel({ devices, walls, settings, scale }) {
  const pxPerMetre = pixelsPerMetre(scale);
  if (!pxPerMetre) return null;
  const exponent = (ENVIRONMENTS.find((item) => item.id === settings.environment) || ENVIRONMENTS[1]).n;
  const offset = settings.view === 'pessimistic' ? -settings.uncertainty : settings.view === 'optimistic' ? settings.uncertainty : 0;
  const forBand = (band) => ({
    pxPerMetre,
    exponent,
    offset,
    lossAt1m: band.lossAt1m,
    sources: devices.map((device) => ({
      x: device.x,
      y: device.y,
      power: Math.min(Number.isFinite(device.power?.[band.id]) ? device.power[band.id] : DEFAULT_POWER[band.id], PHONE_POWER_DBM),
    })),
    walls: walls.map((wall) => ({ ...wall, loss: materialOf(wall.material).loss[band.id] })),
  });
  if (settings.band === 'all') return { bands: BANDS.map(forBand) };
  return forBand(BANDS.find((item) => item.id === settings.band) || BANDS[0]);
}

// Strongest signal in dBm at a point, or null when no device is placed.
export function signalAt(model, x, y) {
  if (model.bands) {
    let top = null;
    for (const band of model.bands) {
      const level = signalAt(band, x, y);
      if (level !== null && (top === null || level > top)) top = level;
    }
    return top;
  }
  let best = null;
  for (const source of model.sources) {
    const metres = Math.max(1, Math.hypot(x - source.x, y - source.y) / model.pxPerMetre);
    let level = source.power - model.lossAt1m - 10 * model.exponent * Math.log10(metres) + model.offset;
    for (const wall of model.walls) {
      if (crosses(source.x, source.y, x, y, wall)) level -= wall.loss;
    }
    if (best === null || level > best) best = level;
  }
  return best;
}

export function colourFor(dbm) {
  return (LEGEND.find((step) => dbm >= step.min) || LEGEND[LEGEND.length - 1]).color;
}

// Samples the plan on a coarse grid; the canvas is scaled up by the browser.
export function computeGrid(model, width, height, maxCells = 30000) {
  const cell = Math.max(4, Math.ceil(Math.sqrt((width * height) / maxCells)));
  const columns = Math.max(1, Math.ceil(width / cell));
  const rows = Math.max(1, Math.ceil(height / cell));
  const data = new Uint8ClampedArray(columns * rows * 4);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const level = signalAt(model, (column + 0.5) * cell, (row + 0.5) * cell);
      if (level === null) continue;
      const [r, g, b] = colourFor(level);
      const index = (row * columns + column) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    }
  }
  return { columns, rows, cell, data };
}

// Access points use the chosen prefix plus a two digit number (KNXWAP01); other devices keep short names.
export function nextDeviceName(devices, type, prefix = '') {
  const named = type === 'ap' && prefix;
  const short = named ? prefix : DEVICE_TYPES.find((item) => item.id === type)?.short || 'Device';
  const label = (index) => (named ? `${short}${String(index).padStart(2, '0')}` : `${short} ${index}`);
  const used = new Set(devices.map((device) => device.name));
  let index = devices.filter((device) => device.type === type).length + 1;
  while (used.has(label(index))) index += 1;
  return label(index);
}
