import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { BAND_OPTIONS, DEFAULT_SETTINGS, LEGEND, computeGrid, materialOf, prepareModel } from '../lib/heatmap.js';
import '../dashboard.css';
import '../design.css';
import '../heatmap.css';

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const DEVICE_LETTER = { ap: 'AP', repeater: 'M', das: 'D' };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const fmt = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, ''));

export default function HeatMapViewer({ token }) {
  const [heatmap, setHeatmap] = useState(null);
  const [state, setState] = useState('loading');
  const [band, setBand] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const canvasRef = useRef(null);
  const heatRef = useRef(null);
  const viewRef = useRef(view);
  const dragRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (!supabase) return undefined;
    supabase.rpc('get_heatmap_by_token', { p_token: token }).then(({ data, error }) => {
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row) { setState('missing'); return; }
      setHeatmap(row);
      setState('ready');
    });
    return () => { cancelled = true; };
  }, [token]);

  const plan = heatmap?.data?.plan || null;
  const walls = useMemo(() => heatmap?.data?.walls || [], [heatmap]);
  const devices = useMemo(() => heatmap?.data?.devices || [], [heatmap]);
  const scale = heatmap?.data?.scale || null;
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...heatmap?.data?.settings, ...(band ? { band } : {}) }), [heatmap, band]);
  const model = useMemo(() => prepareModel({ devices, walls, settings, scale }), [devices, walls, settings, scale]);
  const grid = useMemo(() => (plan && model && devices.length > 0 ? computeGrid(model, plan.width, plan.height) : null), [plan, model, devices.length]);

  useEffect(() => {
    const canvas = heatRef.current;
    if (!canvas || !grid) return;
    canvas.width = grid.columns;
    canvas.height = grid.rows;
    canvas.getContext('2d').putImageData(new ImageData(grid.data, grid.columns, grid.rows), 0, 0);
  }, [grid]);

  const applyView = useCallback((next) => {
    viewRef.current = next;
    setView(next);
  }, []);

  const zoomAt = useCallback((factor, cx, cy) => {
    const v = viewRef.current;
    const z = clamp(v.z * factor, MIN_ZOOM, MAX_ZOOM);
    const ratio = z / v.z;
    applyView({ z, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio });
  }, [applyView]);

  const fitView = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !plan) return;
    const pad = 30;
    const z = clamp(Math.min(rect.width / (plan.width + pad * 2), rect.height / (plan.height + pad * 2)), MIN_ZOOM, 2);
    applyView({ z, x: (rect.width - plan.width * z) / 2, y: (rect.height - plan.height * z) / 2 });
  }, [plan, applyView]);

  useEffect(() => {
    if (state !== 'ready') return undefined;
    const frame = requestAnimationFrame(fitView);
    return () => cancelAnimationFrame(frame);
  }, [state, fitView]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return undefined;
    function onWheel(event) {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = element.getBoundingClientRect();
        zoomAt(Math.exp(-event.deltaY * 0.01), event.clientX - rect.left, event.clientY - rect.top);
      } else {
        const v = viewRef.current;
        applyView({ ...v, x: v.x - event.deltaX, y: v.y - event.deltaY });
      }
    }
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [state, zoomAt, applyView]);

  function onPointerDown(event) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, view: viewRef.current };
  }
  function onPointerMove(event) {
    const drag = dragRef.current;
    if (!drag) return;
    applyView({ ...drag.view, x: drag.view.x + event.clientX - drag.x, y: drag.view.y + event.clientY - drag.y });
  }
  function onPointerUp() {
    dragRef.current = null;
  }
  function zoomCentre(factor) {
    const rect = canvasRef.current.getBoundingClientRect();
    zoomAt(factor, rect.width / 2, rect.height / 2);
  }

  if (state === 'loading') return <div className="session-loading">Loading heat map</div>;
  if (state === 'missing' || !plan) {
    return (
      <div className="design-viewer design-viewer--message dashboard-shell">
        <h1>This link is not available</h1>
        <p>The heat map may have been unshared or the link is incorrect.</p>
      </div>
    );
  }

  const z = view.z;
  const shownBand = band || settings.band;
  return (
    <div className="design-viewer dashboard-shell heatmap-viewer">
      <div className="heatmap-band-bar">
        <strong>{heatmap.name}</strong>
        <span>Show</span>
        <div className="design-segment" role="group" aria-label="Band">
          {BAND_OPTIONS.map((item) => <button key={item.id} type="button" aria-pressed={shownBand === item.id} onClick={() => setBand(item.id)}>{item.label}</button>)}
        </div>
      </div>
      <div
        ref={canvasRef}
        className="design-canvas heatmap-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="heatmap-stage" style={{ width: plan.width, height: plan.height, transform: `translate(${view.x}px, ${view.y}px) scale(${z})` }}>
          <img src={plan.src} alt="Floor plan" width={plan.width} height={plan.height} draggable={false} />
          {grid && <canvas ref={heatRef} className="heatmap-overlay" style={{ width: plan.width, height: plan.height }} />}
          <svg width={plan.width} height={plan.height} className="heatmap-svg">
            {walls.map((wall) => <line key={wall.id} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} stroke={materialOf(wall.material).color} strokeWidth={4 / z} strokeLinecap="round" />)}
            {scale && (
              <g stroke="#e11d8f" strokeWidth={2 / z} fill="#e11d8f">
                <line x1={scale.p1.x} y1={scale.p1.y} x2={scale.p2.x} y2={scale.p2.y} />
                <text x={(scale.p1.x + scale.p2.x) / 2} y={(scale.p1.y + scale.p2.y) / 2 - 8 / z} stroke="#ffffff" strokeWidth={3 / z} paintOrder="stroke" fontSize={13 / z} fontWeight="700" textAnchor="middle">{fmt(scale.metres)} m</text>
              </g>
            )}
            {devices.map((device) => (
              <g key={device.id} transform={`translate(${device.x} ${device.y})`}>
                <circle r={12 / z} fill="#1e293b" stroke="#ffffff" strokeWidth={2 / z} />
                <text y={3.5 / z} fill="#ffffff" fontSize={10 / z} fontWeight="800" textAnchor="middle">{DEVICE_LETTER[device.type] || 'AP'}</text>
                <text y={28 / z} fill="#111827" stroke="#ffffff" strokeWidth={3 / z} paintOrder="stroke" fontSize={12 / z} fontWeight="700" textAnchor="middle">{device.name}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="design-zoom">
          <button type="button" onClick={() => zoomCentre(1 / 1.25)} aria-label="Zoom out"><Minus size={15} /></button>
          <span>{Math.round(z * 100)}%</span>
          <button type="button" onClick={() => zoomCentre(1.25)} aria-label="Zoom in"><Plus size={15} /></button>
          <button type="button" onClick={fitView} aria-label="Fit to plan" title="Fit to plan"><Maximize size={15} /></button>
        </div>
      </div>
      <footer className="heatmap-footer">
        <p className="heatmap-accuracy">Accuracy: ±3–5 m (estimate only).</p>
        <ul className="heatmap-legend" aria-label="Signal strength legend">
          {LEGEND.map((step) => (
            <li key={step.id}><i style={{ background: `rgb(${step.color.join(',')})` }} /><strong>{step.label}</strong><span>{step.range}</span></li>
          ))}
        </ul>
      </footer>
    </div>
  );
}
