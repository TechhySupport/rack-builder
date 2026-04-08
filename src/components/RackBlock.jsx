import { typeConfig } from '../utils/rackUtils';

const RU_HEIGHT = 26; // px per RU unit

export default function RackBlock({ item, height }) {
  const cfg = typeConfig[item.type] || typeConfig.generic;
  const isEmpty = item.type === 'empty';
  const blockHeight = height * RU_HEIGHT - 2; // -2 for gap

  return (
    <div
      className={`rack-block ${cfg.className}${isEmpty ? ' rack-block--empty' : ''}`}
      style={{ height: blockHeight }}
    >
      {!isEmpty && cfg.icon && (
        <img
          src={cfg.icon}
          alt={cfg.label}
          className="rack-block-icon"
          onError={e => { e.target.style.display = 'none'; }}
        />
      )}
      <div className="rack-block-label">
        {!isEmpty && (
          <span className="rack-block-type-badge">{cfg.label}</span>
        )}
        <span className="rack-block-text">{item.label}</span>
      </div>
    </div>
  );
}
