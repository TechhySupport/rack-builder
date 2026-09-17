export default function RackSelector({ racks, activeIndex, onChange, onAdd, onClose }) {
  if (!racks || racks.length === 0) return null;

  return (
    <div className="rack-selector">
      {racks.map((rack, i) => (
        <button
          key={i}
          className={`rack-tab${i === activeIndex ? ' rack-tab--active' : ''}`}
          onClick={() => onChange(i)}
        >
          <span className="rack-tab-name">{rack.rackName || `Rack ${i + 1}`}</span>
          {rack.rackNumber && <span className="rack-tab-num">#{rack.rackNumber}</span>}
          {onClose && racks.length > 1 && (
            <span
              className="rack-tab-close"
              role="button"
              tabIndex={0}
              title="Close rack"
              aria-label={`Close ${rack.rackName || `Rack ${i + 1}`}`}
              onClick={(event) => { event.stopPropagation(); onClose(i); }}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); onClose(i); } }}
            >
              ×
            </span>
          )}
        </button>
      ))}
      <button
        className="rack-tab rack-tab--add"
        onClick={onAdd}
        title="Add new rack"
        aria-label="Add new rack"
      >
        +
      </button>
    </div>
  );
}
