// ─── Type Configuration ────────────────────────────────────────────────────────
export const typeConfig = {
  switch:        { label: 'Switch',        icon: '/assets/switch.svg',        className: 'type-switch' },
  patch_panel:   { label: 'Patch Panel',   icon: '/assets/patch-panel.svg',   className: 'type-patch' },
  cable_manager: { label: 'Cable Manager', icon: '/assets/cable-manager.svg', className: 'type-cable' },
  server:        { label: 'Server',        icon: '/assets/server.svg',        className: 'type-server' },
  ups:           { label: 'UPS',           icon: '/assets/ups.svg',           className: 'type-ups' },
  fibre:         { label: 'Fibre',         icon: '/assets/fibre.svg',         className: 'type-fibre' },
  voice:         { label: 'Voice',         icon: '/assets/voice.svg',         className: 'type-voice' },
  tray:          { label: 'Tray',          icon: '/assets/tray.svg',          className: 'type-tray' },
  shelf:         { label: 'Shelf',         icon: '/assets/shelf.svg',         className: 'type-shelf' },
  desktop:       { label: 'Desktop',       icon: '/assets/desktop.svg',       className: 'type-desktop' },
  pdu:           { label: 'PDU',           icon: '/assets/pdu.svg',           className: 'type-pdu' },
  monitor:       { label: 'Monitor',       icon: '/assets/monitor.svg',       className: 'type-monitor' },
  nvr:           { label: 'NVR',           icon: '/assets/nvr.svg',           className: 'type-nvr' },
  firewall:      { label: 'Firewall',      icon: '/assets/firewall.svg',      className: 'type-firewall' },
  generic:       { label: 'Generic',       icon: '/assets/generic.svg',       className: 'type-generic' },
  empty:         { label: 'Empty',         icon: null,                        className: 'type-empty' },
};

export const ALL_TYPES = Object.keys(typeConfig);

// ─── Normalise a single item's RU range so high >= low ─────────────────────────
export function normalizeItemRange(item) {
  const hi = Math.max(Number(item.startRU), Number(item.endRU));
  const lo = Math.min(Number(item.startRU), Number(item.endRU));
  return { ...item, startRU: hi, endRU: lo };
}

// ─── Normalise an entire rack object ───────────────────────────────────────────
export function normalizeRackData(rack) {
  return {
    ...rack,
    maxRU: Number(rack.maxRU) || 42,
    items: (rack.items || []).map(normalizeItemRange),
  };
}

// ─── Parse raw JSON text → { racks, errors } ──────────────────────────────────
export function parseJsonInput(text) {
  if (!text || !text.trim()) return { racks: null, errors: ['Input is empty.'] };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { racks: null, errors: [`Invalid JSON: ${e.message}`] };
  }

  // Accept either { racks: [...] } or a bare array
  let rawRacks = null;
  if (Array.isArray(parsed)) rawRacks = parsed;
  else if (parsed && Array.isArray(parsed.racks)) rawRacks = parsed.racks;

  if (!rawRacks) return { racks: null, errors: ['JSON must contain a "racks" array or be an array of rack objects.'] };

  const racks = rawRacks.map(normalizeRackData);
  return { racks, errors: [] };
}

// ─── Parse CSV text → { racks, errors } ───────────────────────────────────────
export function parseCsvRows(rows) {
  // rows is array of objects from PapaParse (header mode)
  const errors = [];
  const rackMap = new Map();

  rows.forEach((row, idx) => {
    const lineNum = idx + 2; // 1-based + header row
    const rackName = (row['Rack Name'] || row['rack_name'] || row['rackName'] || '').trim();
    const rackNumber = (row['Rack Number'] || row['rack_number'] || row['rackNumber'] || '').trim();
    const maxRU = parseInt(row['Max RU'] || row['max_ru'] || row['maxRU'] || '42', 10);
    const startRU = parseInt(row['Start RU'] || row['start_ru'] || row['startRU'] || '0', 10);
    const endRU = parseInt(row['End RU'] || row['end_ru'] || row['endRU'] || '0', 10);
    const type = (row['Type'] || row['type'] || 'generic').trim().toLowerCase().replace(/\s+/g, '_');
    const label = (row['Label'] || row['label'] || '').trim();

    if (!rackName) { errors.push(`Row ${lineNum}: Missing Rack Name.`); return; }
    if (!startRU || !endRU) { errors.push(`Row ${lineNum}: Missing Start RU or End RU.`); return; }

    const key = `${rackName}__${rackNumber}`;
    if (!rackMap.has(key)) {
      rackMap.set(key, { rackName, rackNumber: rackNumber || '', maxRU: isNaN(maxRU) ? 42 : maxRU, items: [] });
    }
    const rack = rackMap.get(key);
    // Update maxRU if this row specifies a larger one
    if (!isNaN(maxRU) && maxRU > rack.maxRU) rack.maxRU = maxRU;

    rack.items.push(normalizeItemRange({ startRU, endRU, type: ALL_TYPES.includes(type) ? type : 'generic', label }));
  });

  const racks = Array.from(rackMap.values());
  return { racks, errors };
}

// ─── Validate rack data → string[] of problems ────────────────────────────────
export function validateRackData(racks) {
  const messages = [];
  if (!Array.isArray(racks) || racks.length === 0) {
    return ['No racks found.'];
  }
  racks.forEach((rack, ri) => {
    const prefix = `Rack "${rack.rackName || `#${ri + 1}`}"`;
    if (!rack.rackName) messages.push(`${prefix}: Missing rack name.`);
    if (!rack.maxRU || rack.maxRU < 1) messages.push(`${prefix}: Missing or invalid maxRU.`);
    if (!Array.isArray(rack.items) || rack.items.length === 0) {
      messages.push(`${prefix}: No items defined.`);
      return;
    }
    rack.items.forEach((item, ii) => {
      const iPrefix = `${prefix} item #${ii + 1} ("${item.label || 'unlabelled'}")`;
      if (!item.label) messages.push(`${iPrefix}: Missing label.`);
      if (!item.type) messages.push(`${iPrefix}: Missing type.`);
      if (isNaN(item.startRU) || isNaN(item.endRU)) messages.push(`${iPrefix}: Invalid RU values.`);
      else {
        if (item.startRU > rack.maxRU) messages.push(`${iPrefix}: startRU (${item.startRU}) exceeds maxRU (${rack.maxRU}).`);
        if (item.endRU < 1) messages.push(`${iPrefix}: endRU (${item.endRU}) is below 1.`);
      }
    });

    const overlaps = detectOverlaps(rack);
    overlaps.forEach(msg => messages.push(`${prefix}: ${msg}`));
  });
  return messages;
}

// ─── Detect RU overlaps within a rack ─────────────────────────────────────────
export function detectOverlaps(rack) {
  const msgs = [];
  const occupied = new Map(); // ru → item label
  (rack.items || []).forEach(item => {
    const hi = Math.max(item.startRU, item.endRU);
    const lo = Math.min(item.startRU, item.endRU);
    for (let ru = lo; ru <= hi; ru++) {
      if (occupied.has(ru)) {
        msgs.push(`RU ${ru} is used by both "${occupied.get(ru)}" and "${item.label}".`);
      } else {
        occupied.set(ru, item.label);
      }
    }
  });
  return msgs;
}

// ─── Build an occupancy map for the rack (ru → item) ──────────────────────────
export function buildOccupancyMap(rack) {
  const map = new Map(); // ru → item
  (rack.items || []).forEach(item => {
    const hi = Math.max(item.startRU, item.endRU);
    const lo = Math.min(item.startRU, item.endRU);
    for (let ru = lo; ru <= hi; ru++) {
      if (!map.has(ru)) map.set(ru, item);
    }
  });
  return map;
}

// ─── Build display rows for RackFrame (top to bottom = maxRU to 1) ────────────
// Returns array of { type: 'item'|'empty', item?, ru?, ruStart?, ruEnd?, height }
export function buildRackRows(rack) {
  const maxRU = rack.maxRU || 42;
  const occupancy = buildOccupancyMap(rack);
  const rows = [];
  let ru = maxRU;

  while (ru >= 1) {
    if (occupancy.has(ru)) {
      const item = occupancy.get(ru);
      const hi = Math.max(item.startRU, item.endRU);
      const lo = Math.min(item.startRU, item.endRU);
      const height = hi - lo + 1;
      rows.push({ type: 'item', item, ruStart: hi, ruEnd: lo, height });
      ru = lo - 1;
    } else {
      rows.push({ type: 'empty', ru, height: 1 });
      ru--;
    }
  }
  return rows;
}
