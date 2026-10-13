const RU_H = 26;
const WIDTH = 460;
const RAIL = 34;
const TITLE_H = 54;

const TYPE_STYLE = {
  network_switch: { label: 'Switch', fill: '#1f5f8b' },
  router: { label: 'Router', fill: '#2f6b4f' },
  firewall: { label: 'Firewall', fill: '#b45309' },
  server: { label: 'Server', fill: '#374151' },
  patch_panel: { label: 'Patch panel', fill: '#64748b' },
  ups: { label: 'UPS', fill: '#7c3aed' },
  pdu: { label: 'PDU', fill: '#9a3412' },
  fibre_tray: { label: 'Fibre tray', fill: '#0e7490' },
  nvr: { label: 'NVR', fill: '#4b5563' },
  storage_array: { label: 'Storage', fill: '#334155' },
  modem: { label: 'Modem', fill: '#475569' },
  kvm: { label: 'KVM', fill: '#52525b' },
  shelf: { label: 'Shelf', fill: '#78716c' },
  blanking_panel: { label: 'Blanking panel', fill: '#94a3b8' },
  cable_manager: { label: 'Cable manager', fill: '#6b7280' },
  custom: { label: 'Device', fill: '#475569' },
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function fit(text, maxChars) {
  const value = String(text ?? '');
  return value.length > maxChars ? `${value.slice(0, maxChars - 1)}...` : value;
}

// Draws a rack elevation as a standalone SVG image from database rows.
export function rackToSvgPicture(rack, devices, face = 'front') {
  const capacity = rack.ru_capacity || 42;
  const bodyH = capacity * RU_H;
  const height = TITLE_H + bodyH + 24;
  const left = RAIL;
  const inner = WIDTH - RAIL * 2;
  const shown = devices.filter((d) => d.face === face);
  const occupied = new Set();
  shown.forEach((d) => { for (let ru = d.starting_ru; ru > d.starting_ru - d.ru_height; ru -= 1) occupied.add(ru); });

  const parts = [];
  parts.push(`<rect width="${WIDTH}" height="${height}" fill="#ffffff"/>`);
  parts.push(`<text x="${WIDTH / 2}" y="24" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="17" font-weight="700" fill="#18221f">${esc(fit(rack.name, 40))}</text>`);
  const sub = [rack.identifier ? `Rack ${rack.identifier}` : '', `${capacity}U`, face === 'rear' ? 'Rear' : 'Front'].filter(Boolean).join('  |  ');
  parts.push(`<text x="${WIDTH / 2}" y="43" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#5b6762">${esc(sub)}</text>`);
  parts.push(`<rect x="${left - 10}" y="${TITLE_H - 8}" width="${inner + 20}" height="${bodyH + 16}" rx="4" fill="#2b3430"/>`);
  parts.push(`<rect x="${left}" y="${TITLE_H}" width="${inner}" height="${bodyH}" fill="#f1f4f2"/>`);

  for (let ru = capacity; ru >= 1; ru -= 1) {
    const y = TITLE_H + (capacity - ru) * RU_H;
    parts.push(`<line x1="${left}" y1="${y}" x2="${left + inner}" y2="${y}" stroke="#d3dad6" stroke-width="1"/>`);
    parts.push(`<text x="${left - 14}" y="${y + RU_H / 2 + 4}" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="#5b6762">${ru}</text>`);
    if (!occupied.has(ru)) {
      parts.push(`<text x="${left + 10}" y="${y + RU_H / 2 + 4}" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="#aab4af">Empty</text>`);
    }
  }

  shown.forEach((d) => {
    const style = TYPE_STYLE[d.device_type] || TYPE_STYLE.custom;
    const y = TITLE_H + (capacity - d.starting_ru) * RU_H;
    const h = d.ru_height * RU_H;
    parts.push(`<rect x="${left + 2}" y="${y + 1.5}" width="${inner - 4}" height="${h - 3}" rx="3" fill="${style.fill}" stroke="#0f172a" stroke-opacity=".35"/>`);
    const detail = [style.label, d.model, d.ip_address].filter(Boolean).join('  |  ');
    if (d.ru_height === 1) {
      parts.push(`<text x="${left + 12}" y="${y + h / 2 + 4}" font-family="Helvetica, Arial, sans-serif" font-size="11.5" font-weight="700" fill="#ffffff">${esc(fit(d.name, 34))}</text>`);
    } else {
      parts.push(`<text x="${left + 12}" y="${y + h / 2 - 1}" font-family="Helvetica, Arial, sans-serif" font-size="12.5" font-weight="700" fill="#ffffff">${esc(fit(d.name, 34))}</text>`);
      parts.push(`<text x="${left + 12}" y="${y + h / 2 + 14}" font-family="Helvetica, Arial, sans-serif" font-size="10.5" fill="#e2e8f0">${esc(fit(detail, 52))}</text>`);
    }
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">${parts.join('')}</svg>`;
  return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width: WIDTH, height };
}
