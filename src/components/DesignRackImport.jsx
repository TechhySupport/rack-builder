import { useEffect, useState } from 'react';
import { Server, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { rackToSvgPicture } from '../lib/rackPicture.js';

export default function DesignRackImport({ organisationId, onImport, onClose }) {
  const [racks, setRacks] = useState(null);
  const [face, setFace] = useState('front');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('racks')
      .select('id, name, identifier, ru_capacity, sites(name)')
      .eq('organisation_id', organisationId)
      .order('name')
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) setError(loadError.message);
        setRacks(data || []);
      });
    return () => { cancelled = true; };
  }, [organisationId]);

  useEffect(() => {
    function onKey(event) { if (event.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function choose(rack) {
    setBusyId(rack.id);
    setError('');
    const { data, error: deviceError } = await supabase
      .from('devices')
      .select('name, device_type, model, ip_address, ru_height, starting_ru, face')
      .eq('rack_id', rack.id);
    if (deviceError) { setError(deviceError.message); setBusyId(null); return; }
    onImport(rackToSvgPicture(rack, data || [], face), rack.name);
  }

  return (
    <div className="dashboard-modal-backdrop" role="presentation">
      <section className="dashboard-modal dashboard-modal--wide" role="dialog" aria-modal="true" aria-labelledby="design-rack-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <p className="dashboard-kicker">Import rack</p>
        <h2 id="design-rack-title">Choose a rack to import</h2>
        <p className="design-rack-help">The rack is placed on the canvas as a locked picture. Draw over it; it is not edited.</p>
        <div className="design-segment design-rack-face" role="group" aria-label="Rack face">
          <button type="button" aria-pressed={face === 'front'} onClick={() => setFace('front')}>Front</button>
          <button type="button" aria-pressed={face === 'rear'} onClick={() => setFace('rear')}>Rear</button>
        </div>
        {error && <p className="dashboard-error dashboard-error--inline" role="alert">{error}</p>}
        {racks === null && <p className="design-rack-help">Loading racks</p>}
        {racks?.length === 0 && !error && <p className="design-rack-help">No racks found. Add a rack first.</p>}
        <ul className="design-rack-list">
          {(racks || []).map((rack) => (
            <li key={rack.id}>
              <button type="button" className="design-rack-item" disabled={busyId !== null} onClick={() => choose(rack)}>
                <Server size={17} />
                <span className="design-rack-name">{rack.name}</span>
                <span className="design-rack-meta">{[rack.sites?.name, rack.identifier ? `Rack ${rack.identifier}` : '', `${rack.ru_capacity}U`].filter(Boolean).join('  |  ')}</span>
                {busyId === rack.id && <span className="design-rack-meta">Importing</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
