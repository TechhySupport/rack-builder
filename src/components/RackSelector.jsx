export default function RackSelector({ racks, activeIndex, onChange, onAdd }) {
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
