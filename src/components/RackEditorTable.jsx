import { ALL_TYPES, typeConfig, normalizeItemRange, defaultLabel } from '../utils/rackUtils';

function newItemTemplate(rack) {
  const occupied = new Set();
  rack.items.forEach((item) => {
    for (let ru = item.endRU; ru <= item.startRU; ru += 1) occupied.add(ru);
  });
  const startRU = Array.from({ length: rack.maxRU || 42 }, (_, index) => (rack.maxRU || 42) - index)
    .find((ru) => !occupied.has(ru)) || 1;
  return { startRU, endRU: startRU, type: 'generic', label: defaultLabel('generic') };
}

export default function RackEditorTable({ rack, onChange }) {
  if (!rack) return null;

  // ── Rack-level fields ──────────────────────────────────────────────────────
  function updateRackField(field, value) {
    const updated = { ...rack, [field]: field === 'maxRU' ? Number(value) : value };
    onChange(updated);
  }

  // ── Item-level helpers ────────────────────────────────────────────────────
  function updateItem(idx, field, value) {
    const items = rack.items.map((item, i) => {
      if (i !== idx) return item;
      let updated = { ...item, [field]: ['startRU', 'endRU'].includes(field) ? Number(value) : value };
      // When type changes, auto-update label if it still matches the old type's default
      if (field === 'type') {
        const oldDefault = defaultLabel(item.type);
        if (!item.label || item.label === oldDefault) {
          updated = { ...updated, label: '' }; // let normalizeItemRange fill from new type
        }
      }
      return normalizeItemRange(updated);
    });
    onChange({ ...rack, items });
  }

  function addItem() {
    const items = [...rack.items, newItemTemplate(rack)];
    onChange({ ...rack, items });
  }

  function duplicateItem(idx) {
    const items = [...rack.items];
    items.splice(idx + 1, 0, { ...rack.items[idx] });
    onChange({ ...rack, items });
  }

  function deleteItem(idx) {
    const items = rack.items.filter((_, i) => i !== idx);
    onChange({ ...rack, items });
  }

  function sortItems() {
    const items = [...rack.items].sort((a, b) => b.startRU - a.startRU);
    onChange({ ...rack, items });
  }

  return (
    <div className="editor-section">
      <div className="rack-meta-row editor-rack-settings">
        <label className="meta-label">
          Rack Name
          <input
            className="meta-input"
            value={rack.rackName || ''}
            onChange={e => updateRackField('rackName', e.target.value)}
          />
        </label>
        <label className="meta-label">
          Rack #
          <input
            className="meta-input meta-input--sm"
            value={rack.rackNumber || ''}
            onChange={e => updateRackField('rackNumber', e.target.value)}
          />
        </label>
        <label className="meta-label">
          Max RU
          <input
            className="meta-input meta-input--sm"
            type="number"
            min="1"
            max="100"
            value={rack.maxRU || 42}
            onChange={e => updateRackField('maxRU', e.target.value)}
          />
        </label>
        <button className="btn btn-sm btn-ghost" onClick={sortItems}>Sort ↓ RU</button>
      </div>

      <div className="items-header">
        <div><strong>Rack items</strong><span>{rack.items.length} {rack.items.length === 1 ? 'item' : 'items'}</span></div>
        <button className="btn btn-sm btn-primary" onClick={addItem}>Add item</button>
      </div>

      <div className="item-card-list">
        {rack.items.length === 0 ? (
          <div className="items-empty"><strong>Start building your rack</strong><span>Add your first device, patch panel, or UPS to place it on the elevation.</span><button className="btn btn-sm btn-outline" onClick={addItem}>Add first item</button></div>
        ) : rack.items.map((item, idx) => (
          <section key={idx} className={`item-card${item.type === 'empty' ? ' item-card--empty' : ''}`}>
            <div className="item-card-topline"><span>Item {idx + 1}</span><div><button className="item-action" onClick={() => duplicateItem(idx)}>Duplicate</button><button className="item-action item-action--danger" onClick={() => deleteItem(idx)}>Remove</button></div></div>
            <label className="item-field item-field--wide">Device type
              <select className="item-control" value={item.type || 'generic'} onChange={e => updateItem(idx, 'type', e.target.value)}>{ALL_TYPES.map(t => <option key={t} value={t}>{typeConfig[t].label}</option>)}</select>
            </label>
            <label className="item-field item-field--wide">Label
              <input className="item-control" value={item.label || ''} placeholder="e.g. Core Switch 01" onChange={e => updateItem(idx, 'label', e.target.value)} />
            </label>
            <div className="item-ru-fields">
              <label className="item-field">Top RU<input className="item-control" type="number" min="1" max={rack.maxRU || 99} value={item.startRU} onChange={e => updateItem(idx, 'startRU', e.target.value)} /></label>
              <label className="item-field">Bottom RU<input className="item-control" type="number" min="1" max={rack.maxRU || 99} value={item.endRU} onChange={e => updateItem(idx, 'endRU', e.target.value)} /></label>
              <span className="ru-size">{Math.abs(item.startRU - item.endRU) + 1}U device</span>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
