// ─── Type Configuration ────────────────────────────────────────────────────────
export const typeConfig = {
  switch:        { label: 'Switch',          icon: '/assets/switch.svg',        className: 'type-switch' },
  router:        { label: 'Router',          icon: '/assets/generic.svg',       className: 'type-generic' },
  catalyst_2960: { label: 'Cisco',          icon: '/assets/switch.svg',        className: 'type-switch' },
  extreme_switch: { label: 'Extreme Switch',  icon: '/assets/switch.svg',        className: 'type-switch' },
  patch_panel:   { label: 'Patch Panel',   icon: '/assets/patch-panel.svg',   className: 'type-patch' },
  cable_manager: { label: 'Cable Manager', icon: '/assets/cable-manager.svg', className: 'type-cable' },
  server:        { label: 'Server',        icon: '/assets/server.svg',        className: 'type-server' },
  nas:           { label: 'NAS',           icon: '/assets/server.svg',        className: 'type-server' },
  storage:       { label: 'Storage',       icon: '/assets/server.svg',        className: 'type-server' },
  appliance:     { label: 'Appliance',     icon: '/assets/generic.svg',       className: 'type-generic' },
  other:         { label: 'Other',         icon: '/assets/generic.svg',       className: 'type-generic' },
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

export function isVerticalPdu(item) {
  return item?.type === 'pdu' && item?.pduOrientation === 'vertical';
}

// ─── Convert a type key to a human-readable default label ─────────────────────
export function defaultLabel(type) {
  if (!type || type === 'empty') return '';
  // Use typeConfig display label if available, otherwise title-case the key
  if (typeConfig[type]) return typeConfig[type].label;
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const CONNECTION_DEFAULTS = {
  switch: [['Gi1/0/{n}', 'network', 'copper', 'bidirectional', 24], ['Te1/1/{n}', 'fibre', 'fibre', 'bidirectional', 4], ['Power input', 'power_input', 'power', 'input', 1]],
  catalyst_2960: [['Gi1/0/{n}', 'network', 'copper', 'bidirectional', 24], ['Te1/1/{n}', 'fibre', 'fibre', 'bidirectional', 2], ['Power input', 'power_input', 'power', 'input', 1]],
  extreme_switch: [['Eth1/{n}', 'network', 'copper', 'bidirectional', 24], ['Te1/1/{n}', 'fibre', 'fibre', 'bidirectional', 4], ['Power input', 'power_input', 'power', 'input', 1]],
  router: [['Network', 'network', 'copper', 'bidirectional', 4], ['WAN', 'wan', 'copper', 'bidirectional', 2], ['Power input', 'power_input', 'power', 'input', 1]],
  firewall: [['Network', 'network', 'copper', 'bidirectional', 8], ['WAN', 'wan', 'copper', 'bidirectional', 2], ['Power input', 'power_input', 'power', 'input', 1]],
  patch_panel: [['A', 'network', 'copper', 'bidirectional', 24]],
  fibre: [['Fibre', 'fibre', 'fibre', 'bidirectional', 24]],
  voice: [['Network', 'network', 'copper', 'bidirectional', 24]],
  server: [['Network', 'network', 'copper', 'bidirectional', 4], ['Fibre', 'fibre', 'fibre', 'bidirectional', 2], ['Power input', 'power_input', 'power', 'input', 2]],
  nas: [['Network', 'network', 'copper', 'bidirectional', 4], ['Power input', 'power_input', 'power', 'input', 2]],
  storage: [['Fibre', 'fibre', 'fibre', 'bidirectional', 4], ['Power input', 'power_input', 'power', 'input', 2]],
  nvr: [['Network', 'network', 'copper', 'bidirectional', 16], ['Power input', 'power_input', 'power', 'input', 1]],
  ups: [['Power input', 'power_input', 'power', 'input', 1], ['Power output', 'power_output', 'power', 'output', 8]],
  pdu: [['Power input', 'power_input', 'power', 'input', 1], ['Power output', 'power_output', 'power', 'output', 12]],
  desktop: [['Network', 'network', 'copper', 'bidirectional', 1], ['Power input', 'power_input', 'power', 'input', 1]],
  monitor: [['Other', 'other', 'other', 'input', 2], ['Power input', 'power_input', 'power', 'input', 1]],
  appliance: [['Network', 'network', 'copper', 'bidirectional', 2], ['Power input', 'power_input', 'power', 'input', 1]],
  generic: [['Network', 'network', 'copper', 'bidirectional', 1], ['Power input', 'power_input', 'power', 'input', 1]],
  other: [['Other', 'other', 'other', 'bidirectional', 1]],
};

export function defaultConnectionPointGroups(type) {
  return (CONNECTION_DEFAULTS[type] || []).map(([name, category, medium, direction, count], index) => ({
    id: `group-${type}-${index + 1}`,
    name,
    category,
    medium,
    direction,
    face: medium === 'power' ? 'rear' : 'front',
    count,
    startIndex: 1,
    appendIndex: true,
    points: [],
  }));
}

export function connectionPointName(pattern, number, appendIndex = true) {
  const value = String(pattern || 'Connection').trim();
  if (value.includes('{n}')) return value.replaceAll('{n}', String(number));
  if (!appendIndex) return value;
  if (/^[a-z]{1,3}$/i.test(value) || /[/:._-]$/.test(value)) return `${value}${number}`;
  return `${value} ${number}`;
}

function connectionPointPattern(point) {
  if (point.namePattern) return point.namePattern;
  const name = String(point.name || 'Connection');
  const match = name.match(/^(.*?)(\d+)$/);
  if (!match) return name;
  return match[1].endsWith(' ') ? match[1].trimEnd() : match[1];
}

export function groupConnectionPoints(points) {
  const groups = new Map();
  points.forEach((point) => {
    const name = connectionPointPattern(point);
    const key = [name, point.category, point.medium, point.direction, point.face || (point.medium === 'power' ? 'rear' : 'front'), point.templateKey, point.speedMbps, point.poeCapability, point.connectorType].join('|');
    if (!groups.has(key)) groups.set(key, {
      id: `group-${point.id}`,
      name,
      category: point.category,
      medium: point.medium,
      direction: point.direction,
      face: point.face || (point.medium === 'power' ? 'rear' : 'front'),
      count: 0,
      points: [],
      sourceTemplateId: point.sourceTemplateId || null,
      templateKey: point.templateKey || null,
      startIndex: point.startIndex ?? 1,
      appendIndex: point.appendIndex ?? true,
      speedMbps: point.speedMbps ?? null,
      poeCapability: point.poeCapability || 'unknown',
      connectorType: point.connectorType || null,
    });
    const group = groups.get(key);
    group.count += 1;
    group.points.push(point);
  });
  return [...groups.values()];
}

export function expandConnectionPointGroups(groups) {
  return groups.flatMap((group) => Array.from({ length: Math.max(0, Number(group.count) || 0) }, (_, index) => ({
    id: group.points?.[index]?.id || `${group.category}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: connectionPointName(group.name, (Number(group.startIndex) || 0) + index, group.appendIndex ?? true),
    namePattern: group.name || 'Connection',
    category: group.category,
    medium: group.medium,
    direction: group.direction,
    face: group.face || (group.medium === 'power' ? 'rear' : 'front'),
    sourceTemplateId: group.sourceTemplateId || null,
    templateKey: group.templateKey || null,
    startIndex: group.startIndex ?? 1,
    appendIndex: group.appendIndex ?? true,
    speedMbps: group.speedMbps ?? null,
    poeCapability: group.poeCapability || 'unknown',
    connectorType: group.connectorType || null,
  })));
}

export function connectionGroupsFromProfile(profile, currentGroups = []) {
  return (profile?.groups || []).map((template) => {
    const matchingGroup = currentGroups.find((group) => (
      group.templateKey === template.templateKey
      || (
        group.name === template.name
        && group.category === template.category
        && group.medium === template.medium
        && group.direction === template.direction
      )
    ));
    return {
      ...template,
      face: matchingGroup?.face || (template.medium === 'power' ? 'rear' : 'front'),
      id: `profile-group-${template.templateKey}`,
      sourceTemplateId: template.id,
      points: matchingGroup?.points || [],
    };
  });
}

export function connectionPointsForItem(item) {
  if (Array.isArray(item?.connectionPoints)) return item.connectionPoints;
  const groups = [
    ['networkPorts', 'Network', 'network', 'copper', 'bidirectional'],
    ['fibrePorts', 'Fibre', 'fibre', 'fibre', 'bidirectional'],
    ['wanPorts', 'WAN', 'wan', 'copper', 'bidirectional'],
    ['powerInputs', 'Power input', 'power_input', 'power', 'input'],
    ['powerOutputs', 'Power output', 'power_output', 'power', 'output'],
    ['otherPorts', 'Connection', 'other', 'other', 'bidirectional'],
  ];
  return groups.flatMap(([field, label, category, medium, direction]) => Array.from({ length: Math.max(0, Number(item?.[field]) || 0) }, (_, index) => ({ id: `${category}-${index + 1}`, name: `${label} ${index + 1}`, category, medium, direction, face: medium === 'power' ? 'rear' : 'front' })));
}

// ─── Normalise a single item’s RU range so high >= low ─────────────────────
export function normalizeItemRange(item) {
  const hi  = Math.max(Number(item.startRU), Number(item.endRU));
  const lo  = Math.min(Number(item.startRU), Number(item.endRU));
  // Auto-fill label from type if blank
  const label = (item.label && item.label.trim()) ? item.label.trim() : defaultLabel(item.type);
  return { ...item, startRU: hi, endRU: lo, label, connectionPoints: connectionPointsForItem(item) };
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

// ─── Fuzzy-match a user-entered type string → a known ALL_TYPES key ────────────
export function resolveType(raw) {
  if (!raw) return 'generic';
  const q = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  // 1. exact match
  if (ALL_TYPES.includes(q)) return q;
  // 2. starts-with (first win)
  const sw = ALL_TYPES.find(t => t.startsWith(q) || q.startsWith(t));
  if (sw) return sw;
  // 3. contains (first win)
  const ct = ALL_TYPES.find(t => t.includes(q) || q.includes(t));
  return ct || 'generic';
}

// ─── Parse CSV text → { racks, errors } ───────────────────────────────────────
export function parseCsvRows(rows) {
  // rows is array of objects from PapaParse (header mode)
  const errors  = [];
  const rackMap = new Map();
  // Tracks the last seen maxRU per rack key so later rows can omit it
  const maxRUByKey = new Map();

  rows.forEach((row, idx) => {
    const lineNum    = idx + 2; // 1-based + header row
    const rackName   = (row['Rack Name']   || row['rack_name']   || row['rackName']   || '').trim();
    const rackNumber = (row['Rack Number'] || row['rack_number'] || row['rackNumber'] || '').trim();
    const startRU    = parseInt(row['Start RU'] || row['start_ru'] || row['startRU'] || '0', 10);
    const label      = (row['Label'] || row['label'] || '').trim();

    // End RU: blank means same as Start RU (1 RU)
    const endRURaw = (row['End RU'] || row['end_ru'] || row['endRU'] || '').toString().trim();
    const endRU    = endRURaw === '' ? startRU : parseInt(endRURaw, 10);

    // Max RU: only needs to appear on the first row per rack; fill-forward otherwise
    const maxRURaw = (row['Max RU'] || row['max_ru'] || row['maxRU'] || '').toString().trim();
    const key      = `${rackName}__${rackNumber}`;
    if (maxRURaw !== '') {
      const parsed = parseInt(maxRURaw, 10);
      if (!isNaN(parsed)) maxRUByKey.set(key, parsed);
    }
    const maxRU = maxRUByKey.get(key) || 42;

    // Type: fuzzy-matched so partial input like "ca" → "cable_manager"
    const typeRaw = (row['Type'] || row['type'] || '').trim();
    const type    = resolveType(typeRaw);

    if (!rackName) { errors.push(`Row ${lineNum}: Missing Rack Name.`); return; }
    if (!startRU)  { errors.push(`Row ${lineNum}: Missing Start RU.`);  return; }

    if (!rackMap.has(key)) {
      rackMap.set(key, { rackName, rackNumber: rackNumber || '', maxRU, items: [] });
    }
    const rack = rackMap.get(key);
    // Update maxRU if this row specifies a value
    if (maxRURaw !== '' && maxRU > rack.maxRU) rack.maxRU = maxRU;

    rack.items.push(normalizeItemRange({ startRU, endRU, type, label }));
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
    if (!Array.isArray(rack.items) || rack.items.length === 0) return;
    rack.items.forEach((item, ii) => {
      const iPrefix = `${prefix} item #${ii + 1} ("${item.label || 'unlabelled'}")`;
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
    if (isVerticalPdu(item)) return;
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
    if (isVerticalPdu(item)) return;
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
