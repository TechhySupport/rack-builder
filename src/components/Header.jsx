import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LayoutDashboard, LogOut, Settings } from 'lucide-react';

export default function Header({ rackName, children, user, onDashboard, onSettings, onSignOut, onSaveToWorkspace, onRequireAuth, savingWorkspace }) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Racked View user';
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    function closeAccountMenu(event) {
      if (event.key === 'Escape' || !accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
    }
    document.addEventListener('pointerdown', closeAccountMenu);
    document.addEventListener('keydown', closeAccountMenu);
    return () => {
      document.removeEventListener('pointerdown', closeAccountMenu);
      document.removeEventListener('keydown', closeAccountMenu);
    };
  }, [accountMenuOpen]);

  return (
    <header className="app-header builder-header">
      <div className="builder-header-controls">{children}</div>
      <div className="header-brand"><span className="header-title">{rackName || 'New Rack'}</span></div>
      <div className="header-actions">
        <label className="builder-global-search"><span>Search</span><input placeholder="Search devices, racks, templates..." /></label>
        {onSaveToWorkspace ? <button className="header-signout" onClick={onSaveToWorkspace} disabled={savingWorkspace}>{savingWorkspace ? 'Saving...' : 'Save to workspace'}</button> : onRequireAuth && <button className="header-signout" onClick={onRequireAuth}>Sign in to save</button>}
        {user && <div className="builder-account" ref={accountMenuRef}>
          <button className="builder-avatar" title={displayName} aria-label={`Open account menu for ${displayName}`} aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((isOpen) => !isOpen)}>{avatarUrl ? <img src={avatarUrl} alt="" /> : initials || 'U'}<ChevronDown size={12} /></button>
          {accountMenuOpen && <div className="builder-account-menu" role="menu">
            <div className="builder-account-identity"><strong>{displayName}</strong><span>{user.email}</span></div>
            <button role="menuitem" onClick={onDashboard}><LayoutDashboard size={16} />Dashboard</button>
            <button role="menuitem" onClick={onSettings}><Settings size={16} />Settings</button>
            <button role="menuitem" onClick={onSignOut}><LogOut size={16} />Sign out</button>
          </div>}
        </div>}
      </div>
    </header>
  );
}
