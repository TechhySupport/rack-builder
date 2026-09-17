import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LayoutDashboard, LogOut, Settings } from 'lucide-react';

export default function Header({ rackName, children, user, onDashboard, onSettings, onSignOut, onRequireAuth, onRackNameChange }) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(rackName || 'New Rack');
  const nameInputRef = useRef(null);
  const accountMenuRef = useRef(null);
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Racked View user';
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  useEffect(() => {
    setEditedName(rackName || 'New Rack');
  }, [rackName]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  function saveName() {
    if (editedName.trim() && editedName !== rackName) {
      onRackNameChange?.(editedName.trim());
    }
    setIsEditingName(false);
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') saveName();
    if (e.key === 'Escape') {
      setEditedName(rackName || 'New Rack');
      setIsEditingName(false);
    }
  }

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
      <div className="header-brand">
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={saveName}
            onKeyDown={handleNameKeyDown}
            className="header-title-input"
          />
        ) : (
          <span className="header-title" onDoubleClick={() => setIsEditingName(true)} title="Double-click to edit">
            {rackName || 'New Rack'}
          </span>
        )}
      </div>
      <div className="header-actions">
        <label className="builder-global-search"><span>Search</span><input placeholder="Search devices, racks, templates..." /></label>
        {onRequireAuth && <button className="header-signout" onClick={onRequireAuth}>Sign in to save</button>}
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
