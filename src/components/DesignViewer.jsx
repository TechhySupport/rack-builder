import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import ElementView from './DesignElementView.jsx';
import { LAYER, boundsOf } from '../lib/designGeometry.js';
import '../dashboard.css';
import '../design.css';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function DesignViewer({ token }) {
  const [design, setDesign] = useState(null);
  const [state, setState] = useState('loading');
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const svgRef = useRef(null);
  const viewRef = useRef(view);
  const dragRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (!supabase) return undefined;
    supabase.rpc('get_design_by_token', { p_token: token }).then(({ data, error }) => {
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row) { setState('missing'); return; }
      setDesign(row);
      setState('ready');
    });
    return () => { cancelled = true; };
  }, [token]);

  const elements = useMemo(() => (Array.isArray(design?.data?.elements) ? design.data.elements : []), [design]);
  const byId = useMemo(() => Object.fromEntries(elements.map((el) => [el.id, el])), [elements]);
  const ordered = useMemo(() => [...elements].sort((a, b) => LAYER[a.type] - LAYER[b.type]), [elements]);
  const linkOffsets = useMemo(() => {
    const groups = {};
    elements.filter((el) => el.type === 'link').forEach((link) => {
      const key = [link.from, link.to].sort().join(':');
      (groups[key] ||= []).push(link.id);
    });
    const offsets = {};
    Object.values(groups).forEach((ids) => ids.forEach((id, index) => { offsets[id] = { index, count: ids.length }; }));
    return offsets;
  }, [elements]);

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
    const rect = svgRef.current?.getBoundingClientRect();
    const bounds = boundsOf(elements);
    if (!rect || !bounds) return;
    const pad = 70;
    const z = clamp(Math.min(rect.width / (bounds.w + pad * 2), rect.height / (bounds.h + pad * 2), 2), MIN_ZOOM, MAX_ZOOM);
    applyView({ z, x: (rect.width - bounds.w * z) / 2 - bounds.x * z, y: (rect.height - bounds.h * z) / 2 - bounds.y * z });
  }, [elements, applyView]);

  useEffect(() => {
    if (state !== 'ready') return undefined;
    const frame = requestAnimationFrame(fitView);
    return () => cancelAnimationFrame(frame);
  }, [state, fitView]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    function onWheel(event) {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = svg.getBoundingClientRect();
        zoomAt(Math.exp(-event.deltaY * 0.01), event.clientX - rect.left, event.clientY - rect.top);
      } else {
        const v = viewRef.current;
        applyView({ ...v, x: v.x - event.deltaX, y: v.y - event.deltaY });
      }
    }
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
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
    const rect = svgRef.current.getBoundingClientRect();
    zoomAt(factor, rect.width / 2, rect.height / 2);
  }

  if (state === 'loading') return <div className="session-loading">Loading design</div>;
  if (state === 'missing') {
    return (
      <div className="design-viewer design-viewer--message dashboard-shell">
        <h1>This link is not available</h1>
        <p>The design may have been unshared or the link is incorrect.</p>
      </div>
    );
  }

  return (
    <div className="design-viewer dashboard-shell">
      <div
        className="design-canvas"
        style={{ backgroundSize: `${24 * view.z}px ${24 * view.z}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
      >
        <svg
          ref={svgRef}
          className="design-svg"
          style={{ cursor: dragRef.current ? 'grabbing' : 'grab' }}
          role="img"
          aria-label={design.name || 'Design'}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
            {ordered.map((el) => <ElementView key={el.id} el={el} byId={byId} linkOffsets={linkOffsets} zoom={view.z} selected={false} />)}
          </g>
        </svg>
        {elements.length === 0 && (
          <div className="design-empty"><h2>This design is empty</h2></div>
        )}
        <div className="design-viewer-title">{design.name || 'Untitled design'}</div>
        <div className="design-zoom">
          <button type="button" onClick={() => zoomCentre(1 / 1.25)} aria-label="Zoom out"><Minus size={15} /></button>
          <span>{Math.round(view.z * 100)}%</span>
          <button type="button" onClick={() => zoomCentre(1.25)} aria-label="Zoom in"><Plus size={15} /></button>
          <button type="button" onClick={fitView} aria-label="Fit to content" title="Fit to content"><Maximize size={15} /></button>
        </div>
      </div>
    </div>
  );
}
