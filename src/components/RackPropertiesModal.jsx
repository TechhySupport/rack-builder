import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const FIELDS = [
  ['rackName', 'Rack name'],
  ['rackNumber', 'Rack identifier'],
  ['maxRU', 'Total rack units (U)', 'number'],
  ['level', 'Level / Floor'],
  ['notes', 'Notes', 'textarea'],
];

export default function RackPropertiesModal({ rack, onSave, onClose }) {
  const [values, setValues] = useState(rack || {});

  useEffect(() => setValues(rack || {}), [rack]);
  if (!rack) return null;

  return <div className="device-properties-backdrop" role="presentation" onPointerDown={onClose}>
    <form className="device-properties-modal" aria-label="Rack properties" onPointerDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); onSave(values); }}>
      <header><div><p>Rack</p><h2>Rack properties</h2></div><button type="button" title="Close rack properties" aria-label="Close rack properties" onClick={onClose}><X size={18} /></button></header>
      <div className="device-properties-fields">{FIELDS.map(([key, label, kind]) => <label key={key}>{label}{kind === 'textarea' ? <textarea value={values[key] || ''} onChange={(event) => setValues({ ...values, [key]: event.target.value })} /> : <input type={kind || 'text'} min={kind === 'number' ? 1 : undefined} value={values[key] || ''} onChange={(event) => setValues({ ...values, [key]: event.target.value })} />}</label>)}</div>
      <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit">Save rack</button></footer>
    </form>
  </div>;
}