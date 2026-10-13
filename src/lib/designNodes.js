export const NODE_SIZE = 64;

export const DESIGN_COLORS = ['#1f2937', '#1f694d', '#2563eb', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#6b7280'];

export const DESIGN_FONTS = [
  { id: 'sans', label: 'Sans', family: 'Manrope, system-ui, sans-serif' },
  { id: 'serif', label: 'Serif', family: "Georgia, 'Times New Roman', serif" },
  { id: 'mono', label: 'Mono', family: "'SF Mono', Menlo, Consolas, 'Courier New', monospace" },
  { id: 'rounded', label: 'Rounded', family: "ui-rounded, 'Arial Rounded MT Bold', 'Varela Round', sans-serif" },
  { id: 'hand', label: 'Handwritten', family: "'Bradley Hand', 'Segoe Print', 'Comic Sans MS', cursive" },
];

export function fontFamily(id) {
  return (DESIGN_FONTS.find((font) => font.id === id) || DESIGN_FONTS[0]).family;
}

// Glyphs are drawn on a 24x24 grid: a string is a path, [cx, cy, r] is a circle.
const SHIELD = 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z';
const MONITOR = 'M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z';
const CUBE = 'M12 2l9 5v10l-9 5-9-5V7z';

export const NODE_CATEGORIES = [
  {
    id: 'network',
    label: 'Network',
    kinds: [
      { id: 'internet', label: 'Internet', glyph: [[12, 12, 9], 'M3 12h18', 'M12 3a14 14 0 0 1 0 18', 'M12 3a14 14 0 0 0 0 18'] },
      { id: 'firewall', label: 'Firewall', glyph: ['M3 4h18v16H3z', 'M3 9.33h18', 'M3 14.67h18', 'M9 4v5.33', 'M15 9.33v5.34', 'M9 14.67V20'] },
      { id: 'router', label: 'Router', glyph: ['M4 14h16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z', 'M7 17h.01', 'M11 17h.01', 'M8 14V8', 'M16 14V8', 'M12 14v-4'] },
      { id: 'switch', label: 'Switch', glyph: ['M3 5h18a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M6 9h.01', 'M10 9h.01', 'M14 9h.01', 'M18 9h.01', 'M7 21h10', 'M9 18.5L6.5 21 9 23.5', 'M15 18.5l2.5 2.5-2.5 2.5'] },
      { id: 'loadbalancer', label: 'Load balancer', glyph: ['M12 3v5', 'M12 8L6 15', 'M12 8v7', 'M12 8l6 7', [6, 18, 3], [12, 18, 3], [18, 18, 3]] },
      { id: 'accesspoint', label: 'Access point', glyph: ['M5 11.5a10 10 0 0 1 14 0', 'M8.5 15a5 5 0 0 1 7 0', 'M12 19h.01'] },
      { id: 'vpn', label: 'VPN', glyph: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4', 'M12 15v2'] },
      { id: 'dns', label: 'DNS / DHCP', glyph: [[12, 5, 2.5], [5, 19, 2.5], [19, 19, 2.5], 'M12 7.5v4', 'M12 11.5H5v5', 'M12 11.5h7v5'] },
    ],
  },
  {
    id: 'compute',
    label: 'Servers & storage',
    kinds: [
      { id: 'server', label: 'Server', glyph: ['M4 3h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M4 13h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z', 'M7 7h.01', 'M7 17h.01'] },
      { id: 'hypervisor', label: 'VM host', glyph: ['M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M8 8h8v8H8z'] },
      { id: 'vm', label: 'Virtual machine', glyph: [CUBE, 'M12 12l9-5', 'M12 12L3 7', 'M12 12v10'] },
      { id: 'containers', label: 'Containers', glyph: [CUBE, [12, 12, 3]] },
      { id: 'storage', label: 'Storage', glyph: ['M4 6c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3z', 'M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6', 'M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3'] },
      { id: 'backup', label: 'Backup', glyph: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5', 'M12 8v4l3 2'] },
      { id: 'rack', label: 'Rack', glyph: ['M5 3h14v18H5z', 'M5 9h14', 'M5 15h14', 'M8 6h.01', 'M8 12h.01', 'M8 18h.01'] },
      { id: 'mail', label: 'Mail server', glyph: ['M3 5h18v14H3z', 'M3 6l9 7 9-7'] },
    ],
  },
  {
    id: 'cloud',
    label: 'Data centre & cloud',
    kinds: [
      { id: 'datacenter', label: 'Data centre', glyph: ['M3 21V9l9-6 9 6v12z', 'M8 13h8', 'M8 17h8'] },
      { id: 'cloud', label: 'Cloud', glyph: ['M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'] },
      { id: 'branch', label: 'Branch office', glyph: ['M4 21V4h10v17', 'M14 9h6v12', 'M2 21h20', 'M7 8h4', 'M7 12h4', 'M7 16h4'] },
    ],
  },
  {
    id: 'identity',
    label: 'Identity & directory',
    kinds: [
      { id: 'activedirectory', label: 'Active Directory', glyph: ['M9 3h6v5H9z', 'M3 16h6v5H3z', 'M15 16h6v5h-6z', 'M12 8v4', 'M6 16v-4h12v4'] },
      { id: 'identity', label: 'Entra ID / SSO', glyph: [SHIELD, [12, 10, 2.5], 'M8 16a4 4 0 0 1 8 0'] },
      { id: 'pki', label: 'PKI / Certificates', glyph: [[8, 15, 4], 'M11 12l9-9', 'M17 6l3 3', 'M14 9l2 2'] },
      { id: 'users', label: 'Users', glyph: [[12, 8, 4], 'M4 21a8 8 0 0 1 16 0'] },
    ],
  },
  {
    id: 'management',
    label: 'Endpoint management',
    kinds: [
      { id: 'sccm', label: 'SCCM / MECM', glyph: [MONITOR, 'M8 21h8', 'M12 16v5', 'M12 7v5', 'M9.5 10l2.5 2.5 2.5-2.5'] },
      { id: 'intune', label: 'Intune / MDM', glyph: ['M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z', 'M11 18h2', 'M9.5 10l2 2 3.5-4'] },
      { id: 'patching', label: 'WSUS / Patching', glyph: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 20h16'] },
      { id: 'monitoring', label: 'Monitoring', glyph: ['M3 12h4l3-8 4 16 3-8h4'] },
      { id: 'security', label: 'Security / EDR', glyph: [SHIELD, 'M9 12l2 2 4-4'] },
    ],
  },
  {
    id: 'endpoints',
    label: 'Endpoints',
    kinds: [
      { id: 'workstation', label: 'Workstation', glyph: [MONITOR, 'M8 21h8', 'M12 16v5'] },
      { id: 'laptop', label: 'Laptop', glyph: ['M4 5h16v11H4z', 'M2 20h20'] },
      { id: 'mobile', label: 'Mobile', glyph: ['M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z', 'M11 18h2'] },
      { id: 'phone', label: 'IP phone', glyph: ['M3 8c0-2 3-3.5 9-3.5s9 1.5 9 3.5v3H3z', 'M4 11h16v9H4z', 'M9 14h.01', 'M12 14h.01', 'M15 14h.01', 'M9 17h.01', 'M12 17h.01', 'M15 17h.01'] },
      { id: 'camera', label: 'Camera', glyph: ['M3 7h13v10H3z', 'M16 10l5-3v10l-5-3'] },
      { id: 'printer', label: 'Printer', glyph: ['M6 9V3h12v6', 'M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2', 'M6 14h12v7H6z'] },
    ],
  },
];

export const NODE_KINDS = NODE_CATEGORIES.flatMap((category) => category.kinds);

export function nodeKind(id) {
  return NODE_KINDS.find((kind) => kind.id === id) || NODE_KINDS[0];
}
