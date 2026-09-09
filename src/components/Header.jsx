export default function Header({ onSignOut, onSaveToWorkspace, savingWorkspace }) {
  return (
    <header className="app-header">
      <div className="header-brand"><img src="/assets/racked-view-logo.png" alt="" /><span className="header-title">RackedView</span></div>
      <nav className="builder-nav" aria-label="Builder navigation"><button className="active">Racks</button><button>Devices</button><button>Documentation</button><button>Templates</button><button>Reports</button></nav>
      <div className="header-actions">
        <label className="builder-global-search"><span>Search</span><input placeholder="Search devices, racks, templates..." /></label>
        {onSaveToWorkspace && <button className="header-signout" onClick={onSaveToWorkspace} disabled={savingWorkspace}>{savingWorkspace ? 'Saving...' : 'Save to workspace'}</button>}
        {onSignOut && <button className="header-signout" onClick={onSignOut}>Sign out</button>}
        <span className="builder-avatar">RV</span>
      </div>
    </header>
  );
}
