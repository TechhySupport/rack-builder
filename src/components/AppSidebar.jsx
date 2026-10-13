import { useState } from 'react';
import { ChevronsLeft, ChevronsRight, ClipboardList, Flame, LayoutDashboard, MapPin, Network, PenTool, Server, Settings, Users, Wrench } from 'lucide-react';

const COLLAPSE_KEY = 'rackedview-sidebar-collapsed';

const PRIMARY_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'sites', label: 'Sites', icon: MapPin },
  { id: 'racks', label: 'Racks', icon: Server },
  { id: 'devices', label: 'Devices', icon: Network },
  { id: 'tasks', label: 'Tasks', icon: ClipboardList },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'builder', label: 'Rack builder', icon: Wrench },
  { id: 'design', label: 'Design', icon: PenTool },
  { id: 'heatmap', label: 'Heat map', icon: Flame },
];

const CONFIG_ITEMS = [
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function AppSidebar({ active, onNavigate }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');

  function toggleCollapsed() {
    const next = !collapsed;
    localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
    setCollapsed(next);
  }

  function renderLink({ id, label, icon: Icon }) {
    return (
      <button
        key={id}
        type="button"
        className="app-sidebar-link"
        aria-current={active === id ? 'page' : undefined}
        title={collapsed ? label : undefined}
        onClick={() => onNavigate?.(id)}
      >
        <Icon size={20} strokeWidth={1.6} />
        <span className="app-sidebar-label">{label}</span>
      </button>
    );
  }

  return (
    <nav className={`app-sidebar${collapsed ? ' is-collapsed' : ''}`} aria-label="Main navigation">
      <div className="app-sidebar-list">{PRIMARY_ITEMS.map(renderLink)}</div>

      <p className="app-sidebar-heading">Configuration</p>
      <div className="app-sidebar-list">{CONFIG_ITEMS.map(renderLink)}</div>

      <div className="app-sidebar-footer">
        <button type="button" className="app-sidebar-link" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand' : undefined}>
          {collapsed ? <ChevronsRight size={20} strokeWidth={1.6} /> : <ChevronsLeft size={20} strokeWidth={1.6} />}
          <span className="app-sidebar-label">Collapse</span>
        </button>
      </div>
    </nav>
  );
}
