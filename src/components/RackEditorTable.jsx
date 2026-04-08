import { useState } from 'react';
import { ALL_TYPES, typeConfig, normalizeItemRange } from '../utils/rackUtils';

function newItemTemplate(maxRU) {
  return { startRU: maxRU, endRU: maxRU, type: 'generic', label: 'New Device' };
}

export default function RackEditorTable({ rack, onChange }) {
  const [editingField, setEditingField] = useState(null); // { row: idx, col: 'field' }

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
      const updated = { ...item, [field]: ['startRU', 'endRU'].includes(field) ? Number(value) : value };
      return normalizeItemRange(updated);
    });
    onChange({ ...rack, items });
  }

  function addItem() {
    const items = [...rack.items, newItemTemplate(rack.maxRU || 42)];
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

  const isEditing = (row, col) => editingField && editingField.row === row && editingField.col === col;

  return (
    <div className="editor-section">
      {/* Rack meta */}
      <div className="rack-meta-row">
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

      {/* Items table */}
      <div className="editor-table-wrap">
        <table className="editor-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Type</th>
              <th>Start RU</th>
              <th>End RU</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rack.items.map((item, idx) => (
              <tr key={idx} className={item.type === 'empty' ? 'row-empty' : ''}>
                <td>
                  <input
                    className="table-input"
                    value={item.label || ''}
                    onChange={e => updateItem(idx, 'label', e.target.value)}
                  />
                </td>
                <td>
                  <select
                    className="table-select"
                    value={item.type || 'generic'}
                    onChange={e => updateItem(idx, 'type', e.target.value)}
                  >
                    {ALL_TYPES.map(t => (
                      <option key={t} value={t}>{typeConfig[t].label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="table-input table-input--num"
                    type="number"
                    min="1"
                    max={rack.maxRU || 99}
                    value={item.startRU}
                    onChange={e => updateItem(idx, 'startRU', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="table-input table-input--num"
                    type="number"
                    min="1"
                    max={rack.maxRU || 99}
                    value={item.endRU}
                    onChange={e => updateItem(idx, 'endRU', e.target.value)}
                  />
                </td>
                <td className="col-actions">
                  <button
                    className="btn-icon btn-icon--copy"
                    title="Duplicate"
                    onClick={() => duplicateItem(idx)}
                  >⊕</button>
                  <button
                    className="btn-icon btn-icon--delete"
                    title="Delete"
                    onClick={() => deleteItem(idx)}
                  >✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="editor-footer">
        <button className="btn btn-sm btn-outline" onClick={addItem}>+ Add Item</button>
      </div>
    </div>
  );
}
