export default function Header() {
  return (
    <header className="app-header">
      <div className="header-brand">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="20" height="20" rx="3" stroke="#6366f1" strokeWidth="1.5"/>
          <rect x="3" y="4" width="16" height="3" rx="1" fill="#6366f1"/>
          <rect x="3" y="9" width="16" height="2" rx="1" fill="#818cf8" opacity="0.7"/>
          <rect x="3" y="13" width="16" height="2" rx="1" fill="#818cf8" opacity="0.7"/>
          <rect x="3" y="17" width="8" height="2" rx="1" fill="#818cf8" opacity="0.4"/>
        </svg>
        <span className="header-title">Rack Builder</span>
      </div>
      <div className="header-subtitle">Network Infrastructure Elevation Designer</div>
    </header>
  );
}
