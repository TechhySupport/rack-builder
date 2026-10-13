import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrickWall, ChevronDown, ChevronLeft, ChevronRight, Crop, Download, FileText, LogOut, Maximize, Minus, MousePointer2, Plus, Radio, Ruler, Save, Share2, Trash2, Upload, X } from 'lucide-react';
import {
  BANDS, BAND_OPTIONS, DEFAULT_MATERIAL, DEFAULT_POWER, DEVICE_TYPES, ENVIRONMENTS, LEGEND, VIEWS, WALL_MATERIALS,
  computeGrid, distance, distanceToSegment, materialOf, nextDeviceName, pixelsPerMetre, prepareModel,
} from '../lib/heatmap.js';
import { cropBox, cropFloorPlan, importFloorPlan } from '../lib/floorPlanImport.js';
import { downloadHeatmap } from '../lib/heatmapExport.js';
import DesignShareDialog from './DesignShareDialog.jsx';

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const SNAP_PX = 10;
const DEVICE_HIT_PX = 15;
const WALL_HIT_PX = 8;
const LEVELS = ['Basement', 'Ground floor', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Roof'];
const DEVICE_LETTER = { ap: 'AP', repeater: 'M', das: 'D' };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const isDeviceTool = (tool) => DEVICE_TYPES.some((type) => type.id === tool);
const fmt = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, ''));

export default function HeatMapEditor({ heatmap, sites, canEdit, canManage, currentUserId, onSave, onBack, onDelete, flushRef }) {
  const initial = heatmap.data || {};
  const [name, setName] = useState(heatmap.name);
  const [siteId, setSiteId] = useState(heatmap.site_id);
  const [level, setLevel] = useState(heatmap.level);
  const [plan, setPlan] = useState(initial.plan || null);
  const [scale, setScale] = useState(initial.scale || null);
  const [walls, setWalls] = useState(initial.walls || []);
  const [devices, setDevices] = useState(initial.devices || []);
  const [settings, setSettings] = useState({ band: 'all', view: 'expected', environment: 'house', uncertainty: 6, ...initial.settings });
  const [saveState, setSaveState] = useState('saved');
  const [tool, setTool] = useState('select');
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const [scaleDraft, setScaleDraft] = useState(null);
  const [scaleMetres, setScaleMetres] = useState('');
  const [cropDraft, setCropDraft] = useState(null);
  const [pendingAp, setPendingAp] = useState(null);
  const [prefixDraft, setPrefixDraft] = useState('');
  const [wallDraft, setWallDraft] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [wallMaterial, setWallMaterial] = useState(DEFAULT_MATERIAL);
  const [fileMenu, setFileMenu] = useState(null);
  const [shareDialog, setShareDialog] = useState(false);
  const [notice, setNotice] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const canvasRef = useRef(null);
  const heatRef = useRef(null);
  const fileRef = useRef(null);
  const menuRef = useRef(null);
  const viewRef = useRef(view);
  const gestureRef = useRef(null);
  const dirtyRef = useRef(false);
  const latestRef = useRef({});
  useEffect(() => {
    latestRef.current = { name, siteId, level, plan, scale, walls, devices, settings };
  });

  const markDirty = () => {
    dirtyRef.current = true;
    setSaveState('dirty');
  };
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

  const fitView = useCallback((size) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !size) return;
    const pad = 30;
    const z = clamp(Math.min(rect.width / (size.width + pad * 2), rect.height / (size.height + pad * 2)), MIN_ZOOM, 2);
    applyView({ z, x: (rect.width - size.width * z) / 2, y: (rect.height - size.height * z) / 2 });
  }, [applyView]);

  const planKey = plan ? `${plan.width}x${plan.height}` : '';
  useEffect(() => {
    const frame = requestAnimationFrame(() => fitView(latestRef.current.plan));
    return () => cancelAnimationFrame(frame);
  }, [fitView, planKey]);

  // Wheel: pinch / ctrl zooms, plain scroll pans.
  useEffect(() => {
    const element = canvasRef.current;
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
  }, [zoomAt, applyView]);

  useEffect(() => {
    if (!fileMenu) return undefined;
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setFileMenu(null); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [fileMenu]);

  const pxPerMetre = pixelsPerMetre(scale);
  const model = useMemo(() => prepareModel({ devices, walls, settings, scale }), [devices, walls, settings, scale]);
  const grid = useMemo(() => (plan && model && devices.length > 0 ? computeGrid(model, plan.width, plan.height) : null), [plan, model, devices.length]);

  useEffect(() => {
    const canvas = heatRef.current;
    if (!canvas || !grid) return;
    canvas.width = grid.columns;
    canvas.height = grid.rows;
    canvas.getContext('2d').putImageData(new ImageData(grid.data, grid.columns, grid.rows), 0, 0);
  }, [grid]);

  function toPlan(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (event.clientX - rect.left - v.x) / v.z, y: (event.clientY - rect.top - v.y) / v.z };
  }
  const inPlan = (point) => plan && point.x >= 0 && point.y >= 0 && point.x <= plan.width && point.y <= plan.height;

  // Snaps to nearby wall ends, and to 45 degree steps from the wall being drawn when Shift is held.
  function snapped(point, event) {
    const z = viewRef.current.z;
    let best = null;
    for (const wall of walls) {
      for (const end of [{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }]) {
        const d = distance(point, end);
        if (d * z <= SNAP_PX && (!best || d < best.d)) best = { ...end, d };
      }
    }
    if (best) return { x: best.x, y: best.y };
    if (event.shiftKey && wallDraft) {
      const length = distance(wallDraft, point);
      const angle = Math.round(Math.atan2(point.y - wallDraft.y, point.x - wallDraft.x) / (Math.PI / 4)) * (Math.PI / 4);
      return { x: wallDraft.x + Math.cos(angle) * length, y: wallDraft.y + Math.sin(angle) * length };
    }
    return point;
  }

  function hitTest(point) {
    const z = viewRef.current.z;
    let device = null;
    for (const item of devices) {
      const d = distance(point, item);
      if (d * z <= DEVICE_HIT_PX && (!device || d < device.d)) device = { id: item.id, d };
    }
    if (device) return { kind: 'device', id: device.id };
    let wall = null;
    for (const item of walls) {
      const d = distanceToSegment(point, item);
      if (d * z <= WALL_HIT_PX && (!wall || d < wall.d)) wall = { id: item.id, d };
    }
    return wall ? { kind: 'wall', id: wall.id } : null;
  }

  function changeTool(next) {
    setTool(next);
    setWallDraft(null);
    setScaleDraft(null);
    setScaleMetres('');
    setCropDraft(null);
    setSelected(null);
    setError('');
  }

  function commitWall(from, to) {
    if (distance(from, to) < 3 / viewRef.current.z) return;
    setWalls((current) => [...current, { id: uid(), x1: from.x, y1: from.y, x2: to.x, y2: to.y, material: wallMaterial }]);
    markDirty();
  }

  function onPointerDown(event) {
    if (!plan) return;
    const point = toPlan(event);
    const pan = event.button === 1 || (tool === 'select' && event.button === 0 && !hitTest(point));
    if (pan) {
      if (tool === 'select') setSelected(null);
      gestureRef.current = { kind: 'pan', sx: event.clientX, sy: event.clientY, v: viewRef.current };
      canvasRef.current.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
    if (tool === 'select') {
      const hit = hitTest(point);
      setSelected(hit);
      if (hit.kind === 'device' && canEdit) {
        const device = devices.find((item) => item.id === hit.id);
        gestureRef.current = { kind: 'device', id: hit.id, dx: device.x - point.x, dy: device.y - point.y, moved: false };
        canvasRef.current.setPointerCapture(event.pointerId);
      }
      return;
    }
    if (!canEdit) return;
    if (tool === 'crop') {
      const start = { x: clamp(point.x, 0, plan.width), y: clamp(point.y, 0, plan.height) };
      setCropDraft({ p1: start, p2: start });
      gestureRef.current = { kind: 'crop' };
      canvasRef.current.setPointerCapture(event.pointerId);
      return;
    }
    if (!inPlan(point)) return;
    if (tool === 'scale') {
      setScaleDraft((current) => (current && !current.p2 ? { ...current, p2: point } : { p1: point, p2: null }));
      return;
    }
    if (tool === 'wall') {
      const target = snapped(point, event);
      if (wallDraft) {
        commitWall(wallDraft, target);
        setWallDraft(target);
      } else {
        setWallDraft(target);
        gestureRef.current = { kind: 'wall-start', sx: event.clientX, sy: event.clientY };
        canvasRef.current.setPointerCapture(event.pointerId);
      }
      return;
    }
    if (isDeviceTool(tool)) {
      if (tool === 'ap' && settings.apPrefix == null) {
        setPrefixDraft('');
        setPendingAp(point);
        return;
      }
      placeDevice(point, settings.apPrefix);
    }
  }

  function placeDevice(point, prefix) {
    const device = { id: uid(), type: tool, name: nextDeviceName(devices, tool, prefix), x: point.x, y: point.y, power: { ...DEFAULT_POWER } };
    setDevices((current) => [...current, device]);
    setSelected({ kind: 'device', id: device.id });
    markDirty();
  }

  function confirmPrefix(prefix) {
    const point = pendingAp;
    const clean = prefix.trim().slice(0, 30);
    setPendingAp(null);
    updateSettings({ apPrefix: clean });
    if (point) placeDevice(point, clean);
  }

  function onPointerMove(event) {
    if (!plan) return;
    const gesture = gestureRef.current;
    const point = toPlan(event);
    if (gesture?.kind === 'pan') {
      applyView({ ...gesture.v, x: gesture.v.x + event.clientX - gesture.sx, y: gesture.v.y + event.clientY - gesture.sy });
    } else if (gesture?.kind === 'device') {
      gesture.moved = true;
      const x = clamp(point.x + gesture.dx, 0, plan.width);
      const y = clamp(point.y + gesture.dy, 0, plan.height);
      setDevices((current) => current.map((item) => (item.id === gesture.id ? { ...item, x, y } : item)));
    } else if (gesture?.kind === 'crop') {
      const p2 = { x: clamp(point.x, 0, plan.width), y: clamp(point.y, 0, plan.height) };
      setCropDraft((current) => (current ? { ...current, p2 } : current));
    }
    if (tool === 'wall' || tool === 'scale') setCursor(tool === 'wall' ? snapped(point, event) : point);
  }

  function onPointerUp(event) {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (gesture?.kind === 'device' && gesture.moved) markDirty();
    if (gesture?.kind === 'wall-start' && wallDraft && Math.hypot(event.clientX - gesture.sx, event.clientY - gesture.sy) > 8) {
      const target = snapped(toPlan(event), event);
      commitWall(wallDraft, target);
      setWallDraft(null);
    }
  }

  const autoName = (forSite, forLevel) => `${sites.find((site) => site.id === forSite)?.name || 'Site'} - ${forLevel.trim() || 'Ground floor'}`.slice(0, 120);
  // The name follows site and level until the user renames it.
  function changeLocation(nextSite, nextLevel) {
    if (name === autoName(siteId, level)) setName(autoName(nextSite, nextLevel));
    setSiteId(nextSite);
    setLevel(nextLevel);
    markDirty();
  }
  function patchDevice(id, patch) {
    setDevices((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    markDirty();
  }
  function patchWall(id, patch) {
    setWalls((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    markDirty();
  }
  function deleteSelected() {
    if (!selected || !canEdit) return;
    if (selected.kind === 'device') setDevices((current) => current.filter((item) => item.id !== selected.id));
    else setWalls((current) => current.filter((item) => item.id !== selected.id));
    setSelected(null);
    markDirty();
  }
  function updateSettings(patch) {
    setSettings((current) => ({ ...current, ...patch }));
    markDirty();
  }

  function applyScale() {
    const metres = Number(scaleMetres);
    if (!scaleDraft?.p2 || !(metres > 0)) return;
    setScale({ p1: scaleDraft.p1, p2: scaleDraft.p2, metres });
    setScaleDraft(null);
    setScaleMetres('');
    setTool('select');
    markDirty();
  }

  async function applyCrop() {
    const box = cropDraft && cropBox(cropDraft.p1, cropDraft.p2, plan);
    if (!box || box.w < 20 || box.h < 20) return;
    const inside = (point) => point.x >= box.x && point.y >= box.y && point.x <= box.x + box.w && point.y <= box.y + box.h;
    const keptDevices = devices.filter(inside);
    const keptWalls = walls.filter((wall) => inside({ x: wall.x1, y: wall.y1 }) || inside({ x: wall.x2, y: wall.y2 }));
    const keepScale = scale && inside(scale.p1) && inside(scale.p2);
    const dropped = devices.length - keptDevices.length + walls.length - keptWalls.length + (scale && !keepScale ? 1 : 0);
    if (dropped > 0 && !window.confirm('Cropping removes the scale, walls and devices that fall outside the crop. Continue?')) return;
    setError('');
    try {
      const next = await cropFloorPlan(plan, box);
      const cx = (value) => clamp(value - box.x, 0, box.w);
      const cy = (value) => clamp(value - box.y, 0, box.h);
      setPlan({ ...plan, ...next });
      setDevices(keptDevices.map((item) => ({ ...item, x: cx(item.x), y: cy(item.y) })));
      setWalls(keptWalls.map((wall) => ({ ...wall, x1: cx(wall.x1), y1: cy(wall.y1), x2: cx(wall.x2), y2: cy(wall.y2) })));
      setScale(keepScale ? { ...scale, p1: { x: cx(scale.p1.x), y: cy(scale.p1.y) }, p2: { x: cx(scale.p2.x), y: cy(scale.p2.y) } } : null);
      setCropDraft(null);
      setSelected(null);
      setTool('select');
      markDirty();
    } catch (cropError) {
      setError(cropError.message || 'The floor plan could not be cropped.');
    }
  }

  async function chooseFile(file) {
    if (!file) return;
    if ((scale || walls.length || devices.length) && !window.confirm('Replacing the floor plan clears the scale, walls and devices. Continue?')) return;
    setError('');
    setImporting(true);
    try {
      const next = await importFloorPlan(file);
      setPlan(next);
      setScale(null);
      setWalls([]);
      setDevices([]);
      setSelected(null);
      setTool('scale');
      markDirty();
    } catch (importError) {
      setError(importError.message || 'That file could not be imported.');
    }
    setImporting(false);
  }

  async function flush() {
    if (!dirtyRef.current || !canEdit) return;
    dirtyRef.current = false;
    setSaveState('saving');
    const current = latestRef.current;
    const { error: saveError } = await onSave({
      name: current.name.trim() || 'Untitled heat map',
      site_id: current.siteId,
      level: current.level.trim() || 'Ground floor',
      data: { version: 1, plan: current.plan, scale: current.scale, walls: current.walls, devices: current.devices, settings: current.settings },
    });
    if (saveError) {
      dirtyRef.current = true;
      setSaveState('error');
    } else if (!dirtyRef.current) {
      setSaveState('saved');
    }
  }

  useEffect(() => {
    if (saveState !== 'dirty') return undefined;
    const timer = setTimeout(flush, 1200);
    return () => clearTimeout(timer);
  });
  useEffect(() => {
    if (flushRef) flushRef.current = flush;
  });

  const keysRef = useRef({});
  useEffect(() => {
    keysRef.current = { deleteSelected, wallDraft, tool, selected };
  });
  useEffect(() => {
    function onKeyDown(event) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
      const current = keysRef.current;
      if ((event.key === 'Delete' || event.key === 'Backspace') && current.selected) { event.preventDefault(); current.deleteSelected(); }
      if (event.key === 'Escape') {
        if (current.wallDraft) setWallDraft(null);
        else { setTool('select'); setScaleDraft(null); setCropDraft(null); setSelected(null); }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function leave() {
    setFileMenu(null);
    await flush();
    onBack();
  }
  async function leaveAndDelete() {
    setFileMenu(null);
    if (!window.confirm(`Delete "${name.trim() || 'Untitled heat map'}"? This cannot be undone.`)) return;
    dirtyRef.current = false;
    const { error: deleteError } = await onDelete();
    if (deleteError) setError(deleteError.message || 'Could not delete the heat map.');
  }

  function flashNotice(message) {
    setNotice(message);
    setTimeout(() => setNotice(''), 2600);
  }
  async function saveNow() {
    setFileMenu(null);
    await flush();
    flashNotice('Saved');
  }
  async function shareLink() {
    setFileMenu(null);
    await flush();
    setShareDialog(true);
  }
  async function downloadAs(format) {
    setFileMenu(null);
    if (!plan) return;
    const bandLabel = BAND_OPTIONS.find((item) => item.id === settings.band)?.label || '';
    const viewLabel = VIEWS.find((item) => item.id === settings.view)?.label || '';
    const caption = `${bandLabel}${settings.band === 'all' ? ' (best of either band)' : ''}, ${viewLabel} view. Accuracy: ±3–5 m (estimate only).`;
    try {
      await downloadHeatmap(format, name, { plan, grid, walls, devices, scale, caption });
    } catch (exportError) {
      setError(exportError.message || 'Could not export the heat map.');
    }
  }

  const z = view.z;
  const selectedDevice = selected?.kind === 'device' ? devices.find((item) => item.id === selected.id) : null;
  const selectedWall = selected?.kind === 'wall' ? walls.find((item) => item.id === selected.id) : null;
  const saveLabel = { saved: 'All changes saved', saving: 'Saving...', dirty: 'Unsaved changes', error: 'Could not save. Retrying on next change.' }[saveState];
  const cursorClass = tool === 'select' ? '' : ' is-drawing';
  const cropRect = plan && cropDraft ? cropBox(cropDraft.p1, cropDraft.p2, plan) : null;
  const cropReady = cropRect && cropRect.w >= 20 && cropRect.h >= 20 ? cropRect : null;

  let hint = '';
  if (!plan) hint = '';
  else if (tool === 'crop') hint = 'Drag over the part of the plan to keep, then choose Apply crop.';
  else if (tool === 'scale') hint = !scaleDraft ? 'Click one end of a distance you know, such as a wall.' : !scaleDraft.p2 ? 'Click the other end.' : 'Enter the real distance between the two points in the panel.';
  else if (tool === 'wall') hint = wallDraft ? 'Click to end this wall and continue. Double-click or Esc to stop. Hold Shift for straight angles.' : 'Click a wall start point, or drag to draw a wall.';
  else if (isDeviceTool(tool)) hint = 'Click the plan to place a device. Esc when finished.';
  else if (!pxPerMetre) hint = 'Set the scale to see coverage.';
  else if (devices.length === 0) hint = 'Place a device to see coverage.';

  return (
    <div className="design-editor heatmap-editor">
      <div className="design-topbar">
        <div className="design-file" ref={menuRef}>
          <button type="button" className="design-file-btn" aria-haspopup="menu" aria-expanded={Boolean(fileMenu)} onClick={() => setFileMenu(fileMenu ? null : 'main')}>
            <FileText size={16} />File<ChevronDown size={14} />
          </button>
          {fileMenu && (
            <div className="menu-popover design-file-menu" role="menu">
              {fileMenu === 'main' ? (
                <>
                  <button type="button" role="menuitem" className="menu-item design-menu-row" onClick={saveNow} disabled={!canEdit}><Save size={15} />Save</button>
                  <button type="button" role="menuitem" className="menu-item design-menu-row" onClick={() => setFileMenu('download')} disabled={!plan}><Download size={15} />Download as...<ChevronRight size={14} className="design-menu-end" /></button>
                  <button type="button" role="menuitem" className="menu-item design-menu-row" onClick={shareLink}><Share2 size={15} />Share</button>
                  <div className="design-menu-sep" />
                  <button type="button" role="menuitem" className="menu-item design-menu-row" onClick={leave}><LogOut size={15} />Exit</button>
                  <button type="button" role="menuitem" className="menu-item design-menu-row is-danger" onClick={leaveAndDelete} disabled={!canManage}><Trash2 size={15} />Exit and delete</button>
                </>
              ) : (
                <>
                  <button type="button" className="menu-item design-menu-row" onClick={() => setFileMenu('main')}><ChevronLeft size={15} />Download as</button>
                  <div className="design-menu-sep" />
                  <button type="button" role="menuitem" className="menu-item" onClick={() => downloadAs('png')}>PNG image</button>
                  <button type="button" role="menuitem" className="menu-item" onClick={() => downloadAs('jpeg')}>JPEG image</button>
                  <button type="button" role="menuitem" className="menu-item" onClick={() => downloadAs('svg')}>SVG vector</button>
                </>
              )}
            </div>
          )}
        </div>
        <input className="design-name" value={name} onChange={(event) => { setName(event.target.value); markDirty(); }} readOnly={!canEdit} maxLength={120} aria-label="Heat map name" />
        <span className={`design-save design-save--${saveState}`} role="status">{canEdit ? saveLabel : 'View only'}</span>
      </div>

      <div className="design-workspace">
        <aside className="design-tools heatmap-tools" aria-label="Heat map settings">
          <details className="heatmap-step" open>
          <summary>1. Level</summary>
          <div className="heatmap-step-body">
          <label className="heatmap-field">Site
            <select value={siteId} disabled={!canEdit} onChange={(event) => changeLocation(event.target.value, level)}>
              {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
          </label>
          <label className="heatmap-field">Floor or level
            <input list="heatmap-levels" value={level} disabled={!canEdit} maxLength={80} onChange={(event) => changeLocation(siteId, event.target.value)} />
            <datalist id="heatmap-levels">{LEVELS.map((item) => <option key={item} value={item} />)}</datalist>
          </label>
          </div>
          </details>

          <details className="heatmap-step" open>
          <summary>2. Floor plan</summary>
          <div className="heatmap-step-body">
          <button type="button" className="dashboard-secondary design-btn heatmap-wide" disabled={!canEdit || importing} onClick={() => fileRef.current?.click()}>
            <Upload size={16} />{importing ? 'Importing...' : plan ? 'Replace floor plan' : 'Import image or PDF'}
          </button>
          {plan && <p className="heatmap-note">{plan.name} ({plan.width} x {plan.height}px)</p>}
          {plan && (
            <button type="button" className="design-node-btn heatmap-tool" aria-pressed={tool === 'crop'} disabled={!canEdit} onClick={() => changeTool(tool === 'crop' ? 'select' : 'crop')}>
              <Crop size={18} /><span>Crop plan</span>
            </button>
          )}
          {tool === 'crop' && (
            <div className="heatmap-scale-form">
              <p className="heatmap-note">{cropReady ? `Keeping ${cropReady.w} x ${cropReady.h}px.` : 'Drag on the plan to choose the area to keep.'}</p>
              <button type="button" className="dashboard-primary design-btn" disabled={!cropReady} onClick={applyCrop}>Apply crop</button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(event) => { chooseFile(event.target.files?.[0]); event.target.value = ''; }} />
          </div>
          </details>

          <details className="heatmap-step" open>
          <summary>3. Scale</summary>
          <div className="heatmap-step-body">
          <button type="button" className="design-node-btn heatmap-tool" aria-pressed={tool === 'scale'} disabled={!canEdit || !plan} onClick={() => changeTool(tool === 'scale' ? 'select' : 'scale')}>
            <Ruler size={18} /><span>{scale ? 'Redraw scale' : 'Set scale'}</span>
          </button>
          {pxPerMetre
            ? <p className="heatmap-note">{fmt(scale.metres)} m measured. 1 m = {Math.round(pxPerMetre)} px.</p>
            : <p className="heatmap-note heatmap-note--warn">Required. Click two points on the plan, then enter the real distance.</p>}
          {scaleDraft?.p2 && (
            <div className="heatmap-scale-form">
              <label className="heatmap-field">Real distance (metres)
                <input type="number" min="0" step="any" value={scaleMetres} autoFocus onChange={(event) => setScaleMetres(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') applyScale(); }} />
              </label>
              <button type="button" className="dashboard-primary design-btn" disabled={!(Number(scaleMetres) > 0)} onClick={applyScale}>Apply scale</button>
            </div>
          )}
          </div>
          </details>

          <details className="heatmap-step" open>
          <summary>4. Walls</summary>
          <div className="heatmap-step-body">
          <button type="button" className="design-node-btn heatmap-tool" aria-pressed={tool === 'wall'} disabled={!canEdit || !plan} onClick={() => changeTool(tool === 'wall' ? 'select' : 'wall')}>
            <BrickWall size={18} /><span>Draw walls</span>
          </button>
          <label className="heatmap-field">Material for new walls
            <select value={wallMaterial} disabled={!canEdit} onChange={(event) => setWallMaterial(event.target.value)}>
              {WALL_MATERIALS.map((item) => <option key={item.id} value={item.id}>{item.label} ({item.loss[24]} / {item.loss[5]} dB)</option>)}
            </select>
          </label>
          <p className="heatmap-note">{walls.length} {walls.length === 1 ? 'wall' : 'walls'}. Loss shown for 2.4 / 5 GHz. Optional, but they make the map more accurate.</p>
          </div>
          </details>

          <details className="heatmap-step" open>
          <summary>5. Devices</summary>
          <div className="heatmap-step-body">
          <div className="design-node-grid heatmap-devices">
            {DEVICE_TYPES.map((type) => (
              <button key={type.id} type="button" className="design-node-btn" aria-pressed={tool === type.id} disabled={!canEdit || !plan} onClick={() => changeTool(tool === type.id ? 'select' : type.id)}>
                <Radio size={18} /><span>{type.label}</span>
              </button>
            ))}
          </div>
          <button type="button" className="design-node-btn heatmap-tool" aria-pressed={tool === 'select'} disabled={!plan} onClick={() => changeTool('select')}>
            <MousePointer2 size={18} /><span>Select and move</span>
          </button>
          <label className="heatmap-field">Access point name prefix
            <input value={settings.apPrefix ?? ''} disabled={!canEdit} maxLength={30} placeholder="For example KNXWAP" onChange={(event) => updateSettings({ apPrefix: event.target.value })} />
          </label>
          <p className="heatmap-note">New access points are named with this prefix and a number. Existing names do not change.</p>
          </div>
          </details>

          <details className="heatmap-step" open>
          <summary>6. Heat map</summary>
          <div className="heatmap-step-body">
          <div className="design-segment" role="group" aria-label="View">
            {VIEWS.map((item) => <button key={item.id} type="button" aria-pressed={settings.view === item.id} onClick={() => updateSettings({ view: item.id })}>{item.label}</button>)}
          </div>
          <label className="heatmap-field">Environment
            <select value={settings.environment} onChange={(event) => updateSettings({ environment: event.target.value })}>
              {ENVIRONMENTS.map((item) => <option key={item.id} value={item.id}>{item.label} (n = {item.n})</option>)}
            </select>
          </label>
          <label className="heatmap-field">Uncertainty: {fmt(settings.uncertainty)} dB
            <input type="range" min="4" max="8" step="0.5" value={settings.uncertainty} disabled={settings.view === 'expected'} onChange={(event) => updateSettings({ uncertainty: Number(event.target.value) })} />
          </label>
          </div>
          </details>
        </aside>

        <div className="heatmap-main">
          <div className="heatmap-band-bar">
            <span>Show</span>
            <div className="design-segment" role="group" aria-label="Band">
              {BAND_OPTIONS.map((band) => <button key={band.id} type="button" aria-pressed={settings.band === band.id} onClick={() => updateSettings({ band: band.id })}>{band.label}</button>)}
            </div>
            {settings.band === 'all' && <span className="heatmap-band-note">Best signal on either band</span>}
          </div>
          <div
            ref={canvasRef}
            className={`design-canvas heatmap-canvas${cursorClass}`}
            data-tool={tool}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDoubleClick={() => { if (tool === 'wall') setWallDraft(null); }}
            onContextMenu={(event) => { if (tool === 'wall' || tool === 'scale') { event.preventDefault(); setWallDraft(null); } }}
          >
            {plan ? (
              <div className="heatmap-stage" style={{ width: plan.width, height: plan.height, transform: `translate(${view.x}px, ${view.y}px) scale(${z})` }}>
                <img src={plan.src} alt="Floor plan" width={plan.width} height={plan.height} draggable={false} />
                {grid && <canvas ref={heatRef} className="heatmap-overlay" style={{ width: plan.width, height: plan.height }} />}
                <svg width={plan.width} height={plan.height} className="heatmap-svg">
                  {walls.map((wall) => (
                    <g key={wall.id}>
                      {selected?.id === wall.id && <line x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} stroke="#ffffff" strokeWidth={10 / z} strokeLinecap="round" opacity=".85" />}
                      <line x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} stroke={materialOf(wall.material).color} strokeWidth={4 / z} strokeLinecap="round" />
                    </g>
                  ))}
                  {tool === 'wall' && wallDraft && cursor && (
                    <line x1={wallDraft.x} y1={wallDraft.y} x2={cursor.x} y2={cursor.y} stroke={materialOf(wallMaterial).color} strokeWidth={4 / z} strokeDasharray={`${8 / z} ${6 / z}`} strokeLinecap="round" />
                  )}
                  {scale && (
                    <g stroke="#e11d8f" strokeWidth={2 / z} fill="#e11d8f">
                      <line x1={scale.p1.x} y1={scale.p1.y} x2={scale.p2.x} y2={scale.p2.y} />
                      <circle cx={scale.p1.x} cy={scale.p1.y} r={4 / z} stroke="none" />
                      <circle cx={scale.p2.x} cy={scale.p2.y} r={4 / z} stroke="none" />
                      <text x={(scale.p1.x + scale.p2.x) / 2} y={(scale.p1.y + scale.p2.y) / 2 - 8 / z} stroke="#ffffff" strokeWidth={3 / z} paintOrder="stroke" fontSize={13 / z} fontWeight="700" textAnchor="middle">{fmt(scale.metres)} m</text>
                    </g>
                  )}
                  {scaleDraft && (
                    <g stroke="#e11d8f" strokeWidth={2 / z} fill="#e11d8f">
                      {(scaleDraft.p2 || cursor) && <line x1={scaleDraft.p1.x} y1={scaleDraft.p1.y} x2={(scaleDraft.p2 || cursor).x} y2={(scaleDraft.p2 || cursor).y} strokeDasharray={`${6 / z} ${5 / z}`} />}
                      <circle cx={scaleDraft.p1.x} cy={scaleDraft.p1.y} r={5 / z} stroke="none" />
                      {scaleDraft.p2 && <circle cx={scaleDraft.p2.x} cy={scaleDraft.p2.y} r={5 / z} stroke="none" />}
                    </g>
                  )}
                  {cropRect && (
                    <g>
                      <path fillRule="evenodd" fill="rgba(15, 23, 42, .55)" d={`M0 0H${plan.width}V${plan.height}H0Z M${cropRect.x} ${cropRect.y}h${cropRect.w}v${cropRect.h}h${-cropRect.w}Z`} />
                      <rect x={cropRect.x} y={cropRect.y} width={cropRect.w} height={cropRect.h} fill="none" stroke="#ffffff" strokeWidth={2 / z} strokeDasharray={`${8 / z} ${5 / z}`} />
                    </g>
                  )}
                  {devices.map((device) => (
                    <g key={device.id} transform={`translate(${device.x} ${device.y})`}>
                      {selected?.id === device.id && <circle r={17 / z} fill="none" stroke="#2563eb" strokeWidth={2.5 / z} />}
                      <circle r={12 / z} fill="#1e293b" stroke="#ffffff" strokeWidth={2 / z} />
                      <text y={3.5 / z} fill="#ffffff" fontSize={10 / z} fontWeight="800" textAnchor="middle">{DEVICE_LETTER[device.type]}</text>
                      <text y={28 / z} fill="#111827" stroke="#ffffff" strokeWidth={3 / z} paintOrder="stroke" fontSize={12 / z} fontWeight="700" textAnchor="middle">{device.name}</text>
                    </g>
                  ))}
                </svg>
              </div>
            ) : (
              <div className="design-empty">
                <h2>Import a floor plan</h2>
                <p>Upload an image or PDF of the floor, then set the scale, draw walls and place devices.</p>
                {canEdit && <button type="button" className="dashboard-primary design-btn" disabled={importing} onClick={() => fileRef.current?.click()}><Upload size={16} />{importing ? 'Importing...' : 'Import image or PDF'}</button>}
              </div>
            )}

            {(selectedDevice || selectedWall) && canEdit && (
              <div className="design-context heatmap-context">
                {selectedDevice && (
                  <>
                    <input value={selectedDevice.name} aria-label="Device name" maxLength={40} onChange={(event) => patchDevice(selectedDevice.id, { name: event.target.value })} />
                    <select aria-label="Device type" value={selectedDevice.type} onChange={(event) => patchDevice(selectedDevice.id, { type: event.target.value })}>
                      {DEVICE_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                    </select>
                    {BANDS.map((band) => (
                      <label key={band.id} className="heatmap-power">{band.label}
                        <input type="number" step="1" value={selectedDevice.power?.[band.id] ?? DEFAULT_POWER[band.id]} aria-label={`Transmit power ${band.label}`} onChange={(event) => patchDevice(selectedDevice.id, { power: { ...selectedDevice.power, [band.id]: event.target.value === '' ? DEFAULT_POWER[band.id] : Number(event.target.value) } })} />
                        dBm
                      </label>
                    ))}
                  </>
                )}
                {selectedWall && (
                  <select aria-label="Wall material" value={materialOf(selectedWall.material).id} onChange={(event) => patchWall(selectedWall.id, { material: event.target.value })}>
                    {WALL_MATERIALS.map((item) => <option key={item.id} value={item.id}>{item.label} ({item.loss[24]} / {item.loss[5]} dB)</option>)}
                  </select>
                )}
                <button type="button" className="design-icon-btn design-icon-btn--danger" onClick={deleteSelected} title="Delete" aria-label="Delete"><Trash2 size={16} /></button>
              </div>
            )}

            {hint && <div className="design-hint heatmap-hint" role="status">{hint}</div>}
            {error && <div className="design-error" role="alert">{error}<button type="button" onClick={() => setError('')}>Dismiss</button></div>}

            {plan && (
              <div className="design-zoom">
                <button type="button" onClick={() => { const r = canvasRef.current.getBoundingClientRect(); zoomAt(1 / 1.25, r.width / 2, r.height / 2); }} aria-label="Zoom out"><Minus size={15} /></button>
                <span>{Math.round(z * 100)}%</span>
                <button type="button" onClick={() => { const r = canvasRef.current.getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); }} aria-label="Zoom in"><Plus size={15} /></button>
                <button type="button" onClick={() => fitView(plan)} aria-label="Fit to plan" title="Fit to plan"><Maximize size={15} /></button>
              </div>
            )}
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
      </div>

      {notice && <div className="design-hint design-notice" role="status">{notice}</div>}
      {shareDialog && (
        <DesignShareDialog
          kind="heatmap"
          design={{ ...heatmap, name }}
          canManage={canManage}
          currentUserId={currentUserId}
          onClose={() => setShareDialog(false)}
          onCopied={() => flashNotice('Link copied')}
        />
      )}
      {pendingAp && (
        <div className="dashboard-modal-backdrop" role="presentation">
          <section className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="heatmap-prefix-title">
            <button type="button" className="modal-close" onClick={() => setPendingAp(null)} aria-label="Close"><X size={19} /></button>
            <p className="dashboard-kicker">Access points</p>
            <h2 id="heatmap-prefix-title">Add naming convention</h2>
            <form onSubmit={(event) => { event.preventDefault(); confirmPrefix(prefixDraft); }} onKeyDown={(event) => { if (event.key === 'Escape') setPendingAp(null); }}>
              <label>Name prefix
                <input value={prefixDraft} autoFocus maxLength={30} placeholder="For example KNXWAP" onChange={(event) => setPrefixDraft(event.target.value)} />
              </label>
              <p className="heatmap-note">{prefixDraft.trim() ? `Access points will be named ${prefixDraft.trim()}01, ${prefixDraft.trim()}02, ${prefixDraft.trim()}03 and so on.` : 'Every access point you add uses this prefix followed by a number.'}</p>
              <button type="submit" className="dashboard-primary" disabled={!prefixDraft.trim()}>Save and place access point</button>
              <button type="button" className="dashboard-secondary" onClick={() => confirmPrefix('')}>Skip and use default names</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
