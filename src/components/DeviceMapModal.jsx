import { useEffect, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { materialOf } from '../lib/heatmap.js';
import '../heatmap.css';

export default function DeviceMapModal({ device, onClose, onOpenHeatmap }) {
  const [state, setState] = useState({ status: 'loading', heatmap: null });

  useEffect(() => {
    let cancelled = false;
    supabase.from('heatmaps').select('id, name, data').eq('id', device.heatmap_id).maybeSingle().then(({ data }) => {
      if (cancelled) return;
      setState(data?.data?.plan ? { status: 'ready', heatmap: data } : { status: 'missing', heatmap: null });
    });
    return () => { cancelled = true; };
  }, [device.heatmap_id]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const plan = state.heatmap?.data?.plan;
  const walls = state.heatmap?.data?.walls || [];
  const others = (state.heatmap?.data?.devices || []).filter((item) => item.id !== device.heatmap_device_id);
  const unit = plan ? Math.max(plan.width, plan.height) / 100 : 1;

  return (
    <div className="dashboard-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dashboard-modal dashboard-modal--xwide device-map-modal" role="dialog" aria-modal="true" aria-labelledby="device-map-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <p className="dashboard-kicker">Location</p>
        <h2 id="device-map-title">{device.name}</h2>
        <p className="device-map-sub">{device.map_label || state.heatmap?.name || 'Heat map'}</p>

        {state.status === 'loading' && <p className="device-map-note">Loading map</p>}
        {state.status === 'missing' && <p className="device-map-note">The floor plan is not available. You may not have access to this heat map.</p>}
        {state.status === 'ready' && (
          <div className="device-map-frame">
            <svg viewBox={`0 0 ${plan.width} ${plan.height}`} role="img" aria-label={`Location of ${device.name} on the floor plan`}>
              <image href={plan.src} x="0" y="0" width={plan.width} height={plan.height} />
              {walls.map((wall) => <line key={wall.id} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} stroke={materialOf(wall.material).color} strokeWidth={unit * 0.35} strokeLinecap="round" />)}
              {others.map((item) => <circle key={item.id} cx={item.x} cy={item.y} r={unit * 0.9} fill="#64748b" stroke="#ffffff" strokeWidth={unit * 0.25} opacity=".75" />)}
              <circle className="device-map-pulse" cx={device.map_x} cy={device.map_y} r={unit * 2.4} fill="none" stroke="#2563eb" strokeWidth={unit * 0.4} />
              <circle cx={device.map_x} cy={device.map_y} r={unit * 1.3} fill="#2563eb" stroke="#ffffff" strokeWidth={unit * 0.35} />
              <text x={device.map_x} y={Number(device.map_y) - unit * 3.2} textAnchor="middle" fontSize={unit * 2.2} fontWeight="800" fill="#0f172a" stroke="#ffffff" strokeWidth={unit * 0.6} paintOrder="stroke" fontFamily="Manrope, Arial, sans-serif">{device.name}</text>
            </svg>
          </div>
        )}

        <div className="device-map-actions">
          <button type="button" className="dashboard-secondary" onClick={onClose}>Close</button>
          {state.status === 'ready' && <button type="button" className="dashboard-primary" onClick={() => onOpenHeatmap(device.heatmap_id)}><MapPin size={16} />Open heat map</button>}
        </div>
      </section>
    </div>
  );
}
