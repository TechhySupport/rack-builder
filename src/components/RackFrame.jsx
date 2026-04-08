import { buildRackRows } from '../utils/rackUtils';
import RackBlock from './RackBlock';
import EmptySlot from './EmptySlot';

const RU_HEIGHT = 26;

export default function RackFrame({ rack, innerRef }) {
  if (!rack) return null;
  const rows = buildRackRows(rack);
  const maxRU = rack.maxRU || 42;

  return (
    <div className="rack-frame" ref={innerRef}>
      <div className="rack-frame-header">
        <div className="rack-frame-title">{rack.rackName || 'Unnamed Rack'}</div>
        {rack.rackNumber && (
          <div className="rack-frame-subtitle">Rack {rack.rackNumber} &mdash; {maxRU}U</div>
        )}
      </div>
      <div className="rack-body">
        {/* RU numbers stripe + content side by side */}
        <div className="rack-ru-col">
          {Array.from({ length: maxRU }, (_, i) => maxRU - i).map(ru => (
            <div key={ru} className="rack-ru-cell" style={{ height: RU_HEIGHT }}>
              {ru}
            </div>
          ))}
        </div>
        <div className="rack-slots-col">
          {rows.map((row, i) => {
            if (row.type === 'item') {
              return (
                <RackBlock key={i} item={row.item} height={row.height} />
              );
            }
            return <EmptySlot key={i} ru={row.ru} />;
          })}
        </div>
      </div>
      <div className="rack-footer">
        <span>{maxRU}U Rack</span>
      </div>
    </div>
  );
}
