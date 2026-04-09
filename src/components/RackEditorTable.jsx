import { useState, useRef, useCallback } from 'react';
import { ALL_TYPES, typeConfig, normalizeItemRange, defaultLabel } from '../utils/rackUtils';

function newItemTemplate(maxRU) {
  return { startRU: maxRU, endRU: maxRU, type: 'generic', label: defaultLabel('generic') };
}

/** Draggable resize handle for <th> columns */
function ColResizeHandle({ onDragStart }) {
  return (
    <span
      className="col-resize-handle"
      onMouseDown={onDragStart}
    />
  );
}

export default function RackEditorTable({ rack, onChange }) {
  const [editingField, setEditingField] = useState(null);
  const [colWidths, setColWidths] = useState({ label: 110, type: 90, startRU: 72, endRU: 72 });
  const dragCol   = useRef(null);
  const dragStartX = useRef(0);
  const dragStartW = useRef(0);

  const startColResize = useCallback((col, e) => {
    e.preventDefault();
    dragCol.current   = col;
    dragStartX.current = e.clientX;
    dragStartW.current = colWidths[col];

    const onMove = (ev) => {
      const delta = ev.clientX - dragStartX.current;
      const newW  = Math.max(40, dragStartW.current + delta);
      setColWidths(prev => ({ ...prev, [dragCol.current]: newW }));
    };
    const onUp = () => {
      dragCol.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [colWidths]);

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
        <table className="editor-table" style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: colWidths.label }} />
            <col style={{ width: colWidths.type }} />
            <col style={{ width: colWidths.startRU }} />
            <col style={{ width: colWidths.endRU }} />
            <col style={{ width: 60 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ position: 'relative' }}>Label<ColResizeHandle onDragStart={e => startColResize('label', e)} /></th>
              <th style={{ position: 'relative' }}>Type<ColResizeHandle onDragStart={e => startColResize('type', e)} /></th>
              <th style={{ position: 'relative' }}>Start RU<ColResizeHandle onDragStart={e => startColResize('startRU', e)} /></th>
              <th style={{ position: 'relative' }}>End RU<ColResizeHandle onDragStart={e => startColResize('endRU', e)} /></th>
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
