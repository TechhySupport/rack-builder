import { useState, useRef, useCallback, useEffect } from 'react';
import Header from './components/Header';
import ValidationPanel from './components/ValidationPanel';
import RackSelector from './components/RackSelector';
import RackPreviewPanel from './components/RackPreviewPanel';
import FileMenu from './components/FileMenu';
import SampleSelector from './components/SampleSelector';
import DevicePropertiesModal from './components/DevicePropertiesModal';
import RackPropertiesModal from './components/RackPropertiesModal';
import { RackElevation } from './components/RackElevation';
import RackFrame from './components/RackFrame';
import { sampleData } from './data/sampleRacks';
import { connectionPointsForItem, defaultConnectionPointGroups, expandConnectionPointGroups, isVerticalPdu, validateRackData, normalizeRackData } from './utils/rackUtils';
import { exportAllRacksAsZip, exportCurrentRackBothViews } from './utils/exportAllPng';
import { supabase } from './lib/supabase.js';
import { ArrowRight, Cable, ChevronDown, Circle, Copy, Eraser, Eye, FileText, Highlighter, Image, LayoutTemplate, LineChart, Maximize, MousePointer2, Network, PenTool, Pencil, Redo2, Search, Shapes, SlidersHorizontal, Sparkles, Square, Trash2, Type, Undo2, Upload, Wrench, ZoomIn, ZoomOut } from 'lucide-react';
import { defaultLabel } from './utils/rackUtils';
import './styles.css';

function normalizeAll(racks) {
  return (racks || []).map(normalizeRackData);
}

const STORAGE_KEY_RACKS  = 'rack-builder-racks';
const STORAGE_KEY_INDEX  = 'rack-builder-active';
const DEFAULT_LEFT_WIDTH = 470;

function createEmptyRack() {
  return normalizeRackData({
    rackName: 'New Rack 1',
    rackNumber: '1',
    maxRU: 42,
    items: [],
  });
}

function databaseDeviceType(type) {
  if (['switch', 'catalyst_2960', 'extreme_switch'].includes(type)) return 'network_switch';
  if (type === 'fibre') return 'fibre_tray';
  if (['patch_panel', 'cable_manager', 'server', 'ups', 'pdu', 'nvr', 'shelf'].includes(type)) return type;
  return 'custom';
}

function ToolList({ title, items, onAdd, kind }) {
  return <section className="tool-list"><h3>{title}</h3>{items.map(([name, Icon]) => <button key={name} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('rack-canvas-element', JSON.stringify({ kind, label: name })); }} onClick={() => onAdd(name)}><Icon size={18} /><span>{name}</span><b>+</b></button>)}</section>;
}

function CanvasElement({ element, onRemove }) {
  const style = { left: `${element.x}%`, top: `${element.y}%` };
  if (element.kind === 'image') return <figure className="canvas-object canvas-image" style={style}><button onClick={onRemove}>x</button><img src={element.src} alt={element.label} /></figure>;
  if (element.kind === 'wire') return <div className="canvas-object canvas-wire" style={style}><button onClick={onRemove}>x</button><i /><span>{element.label}</span></div>;
  if (element.kind === 'shape') return <div className={`canvas-object canvas-shape canvas-shape--${element.label.toLowerCase()}`} style={style}><button onClick={onRemove}>x</button>{element.label === 'Arrow' && <ArrowRight size={32} />}</div>;
  return <div className={`canvas-object canvas-${element.kind}`} style={style}><button onClick={onRemove}>x</button><span>{element.value || element.label}</span></div>;
}

export default function App({ isGuest = false, onRequireAuth, onDashboard, onSettings, onSignOut, session }) {
  const [racks, setRacks] = useState(() => {
    if (isGuest) return [createEmptyRack()];
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RACKS);
      if (saved) return normalizeAll(JSON.parse(saved));
    } catch {}
    return normalizeAll(sampleData.racks);
  });
  const [activeIndex, setActiveIndex] = useState(() => {
    const v = parseInt(localStorage.getItem(STORAGE_KEY_INDEX) || '0', 10);
    return isNaN(v) ? 0 : v;
  });
  const [validationMsgs, setValidationMsgs] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [workspaceSaveMessage, setWorkspaceSaveMessage] = useState('');
  const [activeTool, setActiveTool] = useState('devices');
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [canvasElements, setCanvasElements] = useState([]);
  const [dropRU, setDropRU] = useState(null);
  const [movingItemIndex, setMovingItemIndex] = useState(null);
  const [patchMedium, setPatchMedium] = useState(null);
  const [patchSource, setPatchSource] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [viewSide, setViewSide] = useState('front');
  const [propertiesItemIndex, setPropertiesItemIndex] = useState(null);
  const [rackPropertiesOpen, setRackPropertiesOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [sites, setSites] = useState([]);
  const frameRef             = useRef(null);
  const canvasRackRef        = useRef(null);
  const allRacksContainerRef = useRef(null);
  const allRacksSimpleRef    = useRef(null);
  const resizerDragging      = useRef(false);
  const dragStartX           = useRef(0);
  const dragStartW           = useRef(0);

  // ── Persist racks to localStorage ───────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_RACKS, JSON.stringify(racks)); } catch {}
  }, [racks]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_INDEX, String(activeIndex)); } catch {}
  }, [activeIndex]);

  // ── Load from Supabase if localStorage is empty ─────────────────────────────
  useEffect(() => {
    const loadInitialData = async () => {
      if (!session || !supabase) return;
      const savedRacks = localStorage.getItem(STORAGE_KEY_RACKS);
      if (!savedRacks) await loadFromWorkspace();
    };
    loadInitialData();
  }, [session?.user?.id]);

  // ── Load sites for the site dropdown ─────────────────────────────────────────
  useEffect(() => {
    const loadSites = async () => {
      if (!session || !supabase) return;
      try {
        const { data, error } = await supabase
          .from('sites')
          .select('id, name')
          .order('name', { ascending: true });
        if (!error && data) {
          setSites(data);
        }
      } catch (err) {
        console.error('Failed to load sites:', err);
      }
    };
    loadSites();
  }, [session?.user?.id]);

  // ── Load specific rack from URL parameter ────────────────────────────────────
  useEffect(() => {
    const loadSpecificRack = async () => {
      if (!session || !supabase) return;
      const params = new URLSearchParams(window.location.search);
      const rackId = params.get('rackId');
      if (!rackId) return;

      try {
        const { data: dbRack, error: rackError } = await supabase
          .from('racks')
          .select('id, ru_capacity, name, identifier, doc_status')
          .eq('id', rackId)
          .single();
        if (rackError || !dbRack) return;

        const { data: devices, error: devicesError } = await supabase
          .from('devices')
          .select('*')
          .eq('rack_id', rackId)
          .order('starting_ru', { ascending: false });
        if (devicesError || !devices) return;

        const loadedRack = normalizeRackData({
          rackName: dbRack.name || `Rack ${dbRack.identifier || ''}`,
          rackNumber: dbRack.identifier,
          maxRU: dbRack.ru_capacity,
          items: devices.map((dev) => ({
            startRU: dev.starting_ru,
            endRU: dev.starting_ru - dev.ru_height + 1,
            type: dev.device_type === 'network_switch' ? 'switch' : dev.device_type,
            label: dev.name,
          })),
        });

        setRacks([loadedRack]);
        setActiveIndex(0);
      } catch (error) {
        console.error('Error loading rack:', error);
      }
    };

    loadSpecificRack();
  }, [session?.user?.id]);

  // ── Auto-save to Supabase (silent, debounced) ──────────────────────────────────
  useEffect(() => {
    if (!session || !supabase) return;
    const autoSaveTimer = setTimeout(() => {
      silentSaveToWorkspace();
    }, 3000);
    return () => clearTimeout(autoSaveTimer);
  }, [racks]);

  // ── Panel resize drag handlers ───────────────────────────────────────────
  const onResizerMouseDown = useCallback((e) => {
    e.preventDefault();
    resizerDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartW.current = leftWidth;

    const onMove = (ev) => {
      if (!resizerDragging.current) return;
      const delta = ev.clientX - dragStartX.current;
      const newW  = Math.max(260, Math.min(700, dragStartW.current + delta));
      setLeftWidth(newW);
    };
    const onUp = () => {
      resizerDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [leftWidth]);

  const activeRackData = racks[activeIndex] || null;
  const activeRack = activeRackData ? { ...activeRackData, viewSide } : null;

  useEffect(() => {
    if (movingItemIndex === null) return undefined;
    const onPointerMove = (event) => setDropRU(getDropRU(event, canvasRackRef.current));
    const onPointerUp = (event) => {
      moveDevice(movingItemIndex, getDropRU(event, canvasRackRef.current));
      setMovingItemIndex(null);
      setDropRU(null);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [movingItemIndex, activeRack]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', closeMenu);
    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', closeMenu);
    };
  }, [contextMenu]);

  function applyRacks(newRacks) {
    const normalized = normalizeAll(newRacks);
    setRacks(normalized);
    setActiveIndex(0);
    setValidationMsgs(validateRackData(normalized));
  }

  function handleImport(newRacks, errors) {
    setImportErrors(errors || []);
    applyRacks(newRacks);
  }

  function handleLoadSample(sampleRacks) {
    setImportErrors([]);
    applyRacks(sampleRacks);
  }

  function handleClear() {
    setRacks([]);
    setActiveIndex(0);
    setValidationMsgs([]);
    setImportErrors([]);
  }

  function handleRackChange(updatedRack, recordHistory = true) {
    const updated = racks.map((r, i) =>
      i === activeIndex ? normalizeRackData(updatedRack) : r
    );
    if (recordHistory) {
      setUndoStack((history) => [...history.slice(-29), racks]);
      setRedoStack([]);
    }
    setRacks(updated);
    setValidationMsgs(validateRackData(updated));
  }

  function undoRackChange() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setRedoStack((history) => [...history.slice(-29), racks]);
    setRacks(previous);
    setUndoStack((history) => history.slice(0, -1));
    setValidationMsgs(validateRackData(previous));
  }

  function redoRackChange() {
    const next = redoStack.at(-1);
    if (!next) return;
    setUndoStack((history) => [...history.slice(-29), racks]);
    setRacks(next);
    setRedoStack((history) => history.slice(0, -1));
    setValidationMsgs(validateRackData(next));
  }

  function handleAddRack() {
    const newRack = normalizeRackData({
      rackName: `New Rack ${racks.length + 1}`,
      rackNumber: String(racks.length + 1),
      maxRU: 42,
      items: [],
    });
    const updated = [...racks, newRack];
    setRacks(updated);
    setActiveIndex(updated.length - 1);
    setValidationMsgs([]);
  }

  function addDevice(type, preferredRU) {
    if (!activeRack) return;
    const occupied = new Set();
    activeRack.items.forEach((item) => {
      if (isVerticalPdu(item)) return;
      for (let ru = item.endRU; ru <= item.startRU; ru += 1) occupied.add(ru);
    });
    const maxRU = activeRack.maxRU || 42;
    const candidates = preferredRU ? [preferredRU, ...Array.from({ length: maxRU }, (_, index) => maxRU - index)] : Array.from({ length: maxRU }, (_, index) => maxRU - index);
    const placement = candidates.find((ru) => ru >= 1 && ru <= maxRU && !occupied.has(ru)) || 1;
    handleRackChange({ ...activeRack, items: [...activeRack.items, { startRU: placement, endRU: placement, type, label: defaultLabel(type), connectionPointsCustomized: false, connectionPoints: expandConnectionPointGroups(defaultConnectionPointGroups(type)) }] });
  }

  function getDropRU(event, rackRoot = event.currentTarget) {
    const rackSvg = rackRoot?.querySelector('svg[aria-label^="Rack elevation"]');
    if (!rackSvg || !activeRack) return null;
    const rect = rackSvg.getBoundingClientRect();
    const viewBox = rackSvg.viewBox.baseVal;
    const x = ((event.clientX - rect.left) / rect.width) * viewBox.width;
    const y = ((event.clientY - rect.top) / rect.height) * viewBox.height;
    if (x < 48 || x > 500 || y < 44 || y > 44 + (activeRack.maxRU || 42) * 28) return null;
    return Math.max(1, Math.min(activeRack.maxRU || 42, (activeRack.maxRU || 42) - Math.floor((y - 44) / 28)));
  }

  function getDropGuideStyle(ru) {
    const rackRoot = canvasRackRef.current;
    const rackSvg = rackRoot?.querySelector('svg[aria-label^="Rack elevation"]');
    if (!rackRoot || !rackSvg || !activeRack) return null;
    const rootRect = rackRoot.getBoundingClientRect();
    const svgRect = rackSvg.getBoundingClientRect();
    const viewBox = rackSvg.viewBox.baseVal;
    const maxRU = activeRack.maxRU || 42;
    return {
      left: `${svgRect.left - rootRect.left + (48 / viewBox.width) * svgRect.width}px`,
      top: `${svgRect.top - rootRect.top + ((44 + (maxRU - ru) * 28) / viewBox.height) * svgRect.height}px`,
      width: `${(452 / viewBox.width) * svgRect.width}px`,
      height: `${(28 / viewBox.height) * svgRect.height}px`,
      transform: 'none',
    };
  }

  function moveDevice(itemIndex, targetRU) {
    if (!activeRack || itemIndex < 0 || !targetRU) return;
    const item = activeRack.items[itemIndex];
    if (!item) return;
    const height = Math.abs(item.startRU - item.endRU) + 1;
    const startRU = Math.min(activeRack.maxRU || 42, targetRU + height - 1);
    const endRU = startRU - height + 1;
    const overlap = activeRack.items.some((candidate, index) => index !== itemIndex && !isVerticalPdu(candidate) && candidate.endRU <= startRU && candidate.startRU >= endRU);
    if (overlap) return;
    const items = activeRack.items.map((candidate, index) => index === itemIndex ? { ...candidate, startRU, endRU } : candidate);
    handleRackChange({ ...activeRack, items });
  }

  function isPatchCompatible(sourcePoint, targetPoint, medium) {
    if (!sourcePoint || !targetPoint || sourcePoint.medium !== medium || targetPoint.medium !== medium) return false;
    if (medium === 'power') return new Set([sourcePoint.direction, targetPoint.direction]).size === 2 && [sourcePoint.direction, targetPoint.direction].every((direction) => direction === 'input' || direction === 'output');
    return !(sourcePoint.direction === 'input' && targetPoint.direction === 'input') && !(sourcePoint.direction === 'output' && targetPoint.direction === 'output');
  }

  function handlePatchDevice(itemIndex, port) {
    if (!patchMedium || !activeRack) return;
    if (patchSource === null) {
      setPatchSource({ itemIndex, port });
      return;
    }
    if (patchSource.itemIndex === itemIndex && patchSource.port === port) {
      return;
    }
    const source = activeRack.items[patchSource.itemIndex];
    const target = activeRack.items[itemIndex];
    const sourcePoint = connectionPointsForItem(source).find((point) => point.id === patchSource.port);
    const targetPoint = connectionPointsForItem(target).find((point) => point.id === port);
    if (!isPatchCompatible(sourcePoint, targetPoint, patchMedium)) {
      setWorkspaceSaveMessage(patchMedium === 'power'
        ? 'Connect a blue power output to an orange power input.'
        : `${patchMedium[0].toUpperCase() + patchMedium.slice(1)} patches require compatible connection-point media and direction.`);
      return;
    }
    const outputSelectedSecond = patchMedium === 'power' && targetPoint.direction === 'output';
    const fromItemIndex = outputSelectedSecond ? itemIndex : patchSource.itemIndex;
    const fromPort = outputSelectedSecond ? port : patchSource.port;
    const toItemIndex = outputSelectedSecond ? patchSource.itemIndex : itemIndex;
    const toPort = outputSelectedSecond ? patchSource.port : port;
    const connections = [...(activeRack.connections || []), {
      id: `patch-${Date.now()}`,
      medium: patchMedium,
      from: fromItemIndex,
      fromPort,
      fromPortId: fromPort,
      to: toItemIndex,
      toPort,
      toPortId: toPort,
    }];
    handleRackChange({ ...activeRack, connections });
    setPatchSource(null);
  }

  function beginPatch(medium) {
    setPatchMedium(medium);
    setPatchSource(null);
  }

  function cancelPatch() {
    setPatchMedium(null);
    setPatchSource(null);
  }

  useEffect(() => {
    if (!patchMedium) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape') cancelPatch();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [patchMedium]);

  function saveDeviceProperties(values) {
    if (!activeRack || propertiesItemIndex === null) return;
    const items = activeRack.items.map((item, index) => {
      if (index !== propertiesItemIndex) return item;
      const { ruHeight, ...properties } = values;
      const height = Math.max(1, Number(ruHeight) || 1);
      return { ...item, ...properties, startRU: item.endRU + height - 1 };
    });
    handleRackChange({ ...activeRack, items });
    setPropertiesItemIndex(null);
  }

  async function saveRackProperties(values) {
    if (!activeRack || !supabase || !session) return;
    const updatedRack = { ...activeRack, ...values, maxRU: Math.max(1, Number(values.maxRU) || 1) };
    handleRackChange(updatedRack);
    setRackPropertiesOpen(false);

    // Save to Supabase
    try {
      const builderRackKey = `local-rack-${updatedRack.rackNumber || activeIndex + 1}`;
      console.log('[saveRackProperties] Saving rack:', {
        builderRackKey,
        rackId: updatedRack.id,
        name: updatedRack.rackName,
        site_id: updatedRack.site_id,
        level: updatedRack.level,
        notes: updatedRack.notes
      });

      // If no ID (loaded from localStorage), fetch it first
      let rackId = updatedRack.id;
      if (!rackId) {
        const { data: existingRack } = await supabase
          .from('racks')
          .select('id')
          .eq('builder_rack_key', builderRackKey)
          .single();
        rackId = existingRack?.id;
        console.log('[saveRackProperties] Fetched rackId from Supabase:', rackId);
      }

      if (!rackId) {
        setWorkspaceSaveMessage('Rack properties save failed: Could not find rack in database');
        setSavingWorkspace(false);
        return;
      }

      const { error: updateError, data: updateData } = await supabase
        .from('racks')
        .update({
          name: updatedRack.rackName,
          identifier: updatedRack.rackNumber || null,
          ru_capacity: updatedRack.maxRU,
          site_id: updatedRack.site_id || null,
          level: updatedRack.level || null,
          notes: updatedRack.notes || null,
        })
        .eq('id', rackId)
        .select();

      console.log('[saveRackProperties] Response:', { updateError, updateData });
      if (updateData && updateData.length > 0) {
        console.log('[saveRackProperties] Updated record:', updateData[0]);
      }

      if (updateError) {
        console.error('[saveRackProperties] Error:', updateError);
        setWorkspaceSaveMessage(`Rack properties save failed: ${updateError.code || 'unknown'} - ${updateError.message}`);
        return;
      }

      // Verify the update actually worked by fetching fresh data
      const { data: freshData, error: freshError } = await supabase
        .from('racks')
        .select('*')
        .eq('id', rackId)
        .single();
      console.log('[saveRackProperties] Fresh verification:', { freshError, freshData });
      console.log('[saveRackProperties] site_id comparison:', {
        sent: updatedRack.site_id,
        returned_from_select: updateData?.[0]?.site_id,
        fresh_from_db: freshData?.site_id,
        match: freshData?.site_id === updatedRack.site_id
      });
      if (freshData?.site_id !== updatedRack.site_id) {
        console.warn('[saveRackProperties] ⚠️ SITE_ID DID NOT SAVE! Likely RLS policy blocking the update.', {
          expected: updatedRack.site_id,
          actual: freshData?.site_id
        });
      }

      setWorkspaceSaveMessage('Rack properties saved to workspace!');
      setTimeout(() => setWorkspaceSaveMessage(''), 3000);
    } catch (err) {
      console.error('[saveRackProperties] Exception:', err);
      setWorkspaceSaveMessage(`Rack properties save failed: ${err.message}`);
    }
  }

  function removeDevice(itemIndex) {
    if (!activeRack) return;
    const items = activeRack.items.filter((_, index) => index !== itemIndex);
    const connections = (activeRack.connections || [])
      .filter((connection) => connection.from !== itemIndex && connection.to !== itemIndex)
      .map((connection) => ({
        ...connection,
        from: connection.from > itemIndex ? connection.from - 1 : connection.from,
        to: connection.to > itemIndex ? connection.to - 1 : connection.to,
      }));
    handleRackChange({ ...activeRack, items, connections });
    setPropertiesItemIndex(null);
  }

  function duplicateDevice(itemIndex) {
    if (!activeRack) return;
    const source = activeRack.items[itemIndex];
    if (!source) return;
    const maxRU = activeRack.maxRU || 42;

    if (isVerticalPdu(source)) {
      handleRackChange({ ...activeRack, items: [...activeRack.items, { ...source }] });
      return;
    }

    const height = Math.abs(source.startRU - source.endRU) + 1;
    const occupied = new Set();
    activeRack.items.forEach((item) => {
      if (isVerticalPdu(item)) return;
      for (let ru = item.endRU; ru <= item.startRU; ru += 1) occupied.add(ru);
    });
    let endRU = null;
    for (let candidate = 1; candidate <= maxRU - height + 1; candidate += 1) {
      let free = true;
      for (let ru = candidate; ru < candidate + height; ru += 1) {
        if (occupied.has(ru)) { free = false; break; }
      }
      if (free) { endRU = candidate; break; }
    }
    if (endRU === null) {
      setWorkspaceSaveMessage('No free rack space to duplicate this device.');
      return;
    }
    const clone = { ...source, startRU: endRU + height - 1, endRU, label: source.label ? `${source.label} (copy)` : source.label };
    handleRackChange({ ...activeRack, items: [...activeRack.items, clone] });
  }

  function openDeviceContextMenu(itemIndex, event) {
    setContextMenu({ itemIndex, x: event.clientX, y: event.clientY });
  }

  function requestConfirm(message, onConfirm) {
    setConfirmDialog({ message, onConfirm });
  }

  function addCanvasElement(kind, label, extra = {}) {
    if (kind === 'wire' && label === 'Fibre') {
      beginPatch('fibre');
      return;
    }
    if (kind === 'wire' && (label === 'Ethernet' || label === 'Patch Cable')) {
      beginPatch('copper');
      return;
    }
    if (kind === 'wire' && label === 'Power Cable') {
      beginPatch('power');
      return;
    }
    setCanvasElements((elements) => [...elements, { id: `${kind}-${Date.now()}-${elements.length}`, kind, label, x: 14 + (elements.length * 11) % 55, y: 16 + (elements.length * 13) % 62, ...extra }]);
  }

  function canvasPosition(event) {
    const bounds = canvasRackRef.current?.getBoundingClientRect();
    if (!bounds) return {};
    return { x: Math.max(0, Math.min(94, ((event.clientX - bounds.left) / bounds.width) * 100)), y: Math.max(0, Math.min(92, ((event.clientY - bounds.top) / bounds.height) * 100)) };
  }

  function addCanvasElementAt(kind, label, event, extra = {}) {
    const position = canvasPosition(event);
    setCanvasElements((elements) => [...elements, { id: `${kind}-${Date.now()}-${elements.length}`, kind, label, ...position, ...extra }]);
  }

  function addImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addCanvasElement('image', file.name, { src: reader.result });
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  function addDroppedImage(file, event) {
    const reader = new FileReader();
    reader.onload = () => addCanvasElementAt('image', file.name, event, { src: reader.result });
    reader.readAsDataURL(file);
  }

  // Store the RefObject itself so FileMenu always reads the live DOM element
  const captureFrameRef = useCallback((refObj) => {
    frameRef.current = refObj ?? null;
  }, []);

  async function handleExportCurrentPng() {
    const diagramEl = allRacksContainerRef.current?.children[activeIndex];
    const simpleEl  = allRacksSimpleRef.current?.children[activeIndex];
    await exportCurrentRackBothViews(diagramEl, simpleEl, activeRack?.rackName);
  }

  async function handleExportAllPng() {
    await exportAllRacksAsZip(racks, allRacksContainerRef.current, allRacksSimpleRef.current);
  }

  async function silentSaveToWorkspace() {
    // Silent auto-save - no state updates, no UI interruption
    if (!supabase || !session || !racks.length) return;
    try {
      const { data: memberships } = await supabase
        .from('organisation_members')
        .select('organisation_id')
        .eq('user_id', session.user.id)
        .eq('status', 'active');
      if (!memberships?.length) return;

      const organisationIds = memberships.map((m) => m.organisation_id);
      let { data: site } = await supabase
        .from('sites')
        .select('id, organisation_id')
        .in('organisation_id', organisationIds)
        .limit(1)
        .maybeSingle();
      if (!site) return;

      for (const [rackIndex, rack] of racks.entries()) {
        const builderRackKey = `local-rack-${rack.rackNumber || rackIndex + 1}`;
        await supabase
          .from('racks')
          .upsert({ organisation_id: site.organisation_id, site_id: site.id, name: rack.rackName || `Rack ${rackIndex + 1}`, identifier: rack.rackNumber || null, ru_capacity: rack.maxRU, doc_status: 'current', created_by: session.user.id, builder_rack_key: builderRackKey }, { onConflict: 'organisation_id,builder_rack_key' })
          .select('id')
          .single();
      }
    } catch (err) {
      // Silently fail - no UI disruption
      console.error('Auto-save:', err.message);
    }
  }

  async function loadFromWorkspace() {
    if (!supabase || !session) return;
    try {
      const { data: memberships, error: membershipError } = await supabase
        .from('organisation_members')
        .select('organisation_id')
        .eq('user_id', session.user.id)
        .eq('status', 'active');
      if (membershipError || !memberships?.length) return;

      const organisationIds = memberships.map((m) => m.organisation_id);
      const { data: sites, error: sitesError } = await supabase
        .from('sites')
        .select('id, organisation_id')
        .in('organisation_id', organisationIds)
        .order('created_at', { ascending: true });
      if (sitesError || !sites?.length) return;

      const { data: dbRacks, error: racksError } = await supabase
        .from('racks')
        .select('id, ru_capacity, name, identifier, doc_status')
        .in('site_id', sites.map((s) => s.id))
        .eq('doc_status', 'current');
      if (racksError || !dbRacks?.length) return;

      const loadedRacks = await Promise.all(
        dbRacks.map(async (dbRack) => {
          const { data: devices, error: devicesError } = await supabase
            .from('devices')
            .select('*')
            .eq('rack_id', dbRack.id)
            .order('starting_ru', { ascending: false });
          if (devicesError || !devices) return null;

          return normalizeRackData({
            rackName: dbRack.name || `Rack ${dbRack.identifier || ''}`,
            rackNumber: dbRack.identifier,
            maxRU: dbRack.ru_capacity,
            items: devices.map((dev) => ({
              startRU: dev.starting_ru,
              endRU: dev.starting_ru - dev.ru_height + 1,
              type: dev.device_type === 'network_switch' ? 'switch' : dev.device_type,
              label: dev.name,
            })),
          });
        })
      );

      const validRacks = loadedRacks.filter(Boolean);
      if (validRacks.length > 0) {
        setRacks(validRacks);
        setActiveIndex(0);
      }
    } catch (error) {
      console.error('Error loading from workspace:', error);
    }
  }

  async function saveToWorkspace() {
    if (!supabase || !session) return;
    setSavingWorkspace(true);
    setWorkspaceSaveMessage('Saving to workspace...');
    let provisionedWorkspace = false;
    console.log('saveToWorkspace: starting...');

    const { data: memberships, error: membershipError } = await supabase
      .from('organisation_members')
      .select('organisation_id')
      .eq('user_id', session.user.id)
      .eq('status', 'active');
    console.log('memberships:', { memberships, membershipError });

    if (membershipError) {
      const msg = `Membership error: ${membershipError.message}`;
      console.error(msg);
      setWorkspaceSaveMessage(msg);
      setSavingWorkspace(false);
      return;
    }

    let organisationIds = (memberships || []).map((membership) => membership.organisation_id);
    if (organisationIds.length === 0) {
      const accountName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'My';
      const { data: organisation, error: organisationError } = await supabase
        .from('organisations')
        .insert({ name: `${accountName}'s Workspace`, owner_id: session.user.id })
        .select('id')
        .single();
      if (organisationError || !organisation) {
        setWorkspaceSaveMessage(organisationError?.message || 'Unable to create your workspace.');
        setSavingWorkspace(false);
        return;
      }
      const { error: newMembershipError } = await supabase.from('organisation_members').insert({
        organisation_id: organisation.id,
        user_id: session.user.id,
        role: 'owner',
        status: 'active',
      });
      if (newMembershipError) {
        setWorkspaceSaveMessage(newMembershipError.message);
        setSavingWorkspace(false);
        return;
      }
      organisationIds = [organisation.id];
      provisionedWorkspace = true;
    }

    let { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, organisation_id')
      .in('organisation_id', organisationIds)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (siteError) {
      setWorkspaceSaveMessage(siteError.message);
      setSavingWorkspace(false);
      return;
    }
    if (!site) {
      const siteResponse = await supabase
        .from('sites')
        .insert({ organisation_id: organisationIds[0], name: 'Default Site', address: null, created_by: session.user.id })
        .select('id, organisation_id')
        .single();
      site = siteResponse.data;
      siteError = siteResponse.error;
      if (siteError || !site) {
        setWorkspaceSaveMessage(siteError?.message || 'Unable to create a default site.');
        setSavingWorkspace(false);
        return;
      }
      provisionedWorkspace = true;
    }

    for (const [rackIndex, rack] of racks.entries()) {
      const builderRackKey = `local-rack-${rack.rackNumber || rackIndex + 1}`;
      const { data: savedRack, error: rackError } = await supabase
        .from('racks')
        .upsert({ organisation_id: site.organisation_id, site_id: site.id, name: rack.rackName || `Rack ${rackIndex + 1}`, identifier: rack.rackNumber || null, ru_capacity: rack.maxRU, doc_status: 'current', created_by: session.user.id, builder_rack_key: builderRackKey }, { onConflict: 'organisation_id,builder_rack_key' })
        .select('id')
        .single();
      if (rackError || !savedRack) {
        const errorMsg = rackError?.message || 'Unknown error';
        setWorkspaceSaveMessage(`Rack save failed: ${rack.rackName || 'Rack'} - ${errorMsg}`);
        setSavingWorkspace(false);
        return;
      }
      const deviceEntries = rack.items.filter((item) => item.type !== 'empty').map((item, itemIndex) => ({ item, builderDeviceKey: `${builderRackKey}-item-${itemIndex + 1}` }));
      const deviceRows = deviceEntries.map(({ item, builderDeviceKey }, itemIndex) => ({
        organisation_id: site.organisation_id,
        rack_id: savedRack.id,
        name: item.label || `Device ${itemIndex + 1}`,
        device_type: databaseDeviceType(item.type),
        manufacturer: item.brand || null,
        switch_brand_id: item.switchBrandId || null,
        device_catalog_brand_id: item.catalogBrandId || null,
        custom_manufacturer: item.customManufacturer || null,
        model: item.model || null,
        switch_model_id: item.switchModelId || null,
        device_catalog_model_id: item.catalogModelId || null,
        custom_model: item.customModel || null,
        connection_profile_id: item.connectionProfileId || null,
        connection_profile_version: item.connectionProfileVersion || null,
        connection_points_customized: Boolean(item.connectionPointsCustomized),
        ru_height: Math.abs(item.startRU - item.endRU) + 1,
        starting_ru: item.startRU,
        created_by: session.user.id,
        builder_device_key: builderDeviceKey,
      }));
      if (deviceRows.length > 0) {
        const { data: savedDevices, error: deviceError } = await supabase
          .from('devices')
          .upsert(deviceRows, { onConflict: 'organisation_id,builder_device_key' })
          .select('id, builder_device_key');
        if (deviceError) {
          setWorkspaceSaveMessage(`Device save failed: ${deviceError.message || 'Unknown error'}`);
          setSavingWorkspace(false);
          return;
        }

        const savedDeviceByKey = new Map((savedDevices || []).map((device) => [device.builder_device_key, device.id]));
        const savedDeviceIds = [...savedDeviceByKey.values()];
        const { error: clearPointsError } = await supabase
          .from('device_connection_points')
          .delete()
          .in('device_id', savedDeviceIds);
        if (clearPointsError) {
          setWorkspaceSaveMessage(clearPointsError.message);
          setSavingWorkspace(false);
          return;
        }

        const connectionPointRows = deviceEntries.flatMap(({ item, builderDeviceKey }) => {
          const deviceId = savedDeviceByKey.get(builderDeviceKey);
          if (!deviceId) return [];
          return connectionPointsForItem(item).map((point, pointIndex) => ({
            organisation_id: site.organisation_id,
            device_id: deviceId,
            client_point_id: point.id,
            name: point.name,
            name_pattern: point.namePattern || null,
            category: point.category,
            medium: point.medium,
            direction: point.direction,
            face: point.face || (point.medium === 'power' ? 'rear' : 'front'),
            speed_mbps: point.speedMbps || null,
            poe: point.poeCapability || 'unknown',
            connector_type: point.connectorType || null,
            source_template_id: point.sourceTemplateId || null,
            sort_order: pointIndex,
          }));
        });
        if (connectionPointRows.length > 0) {
          const { error: connectionPointsError } = await supabase.from('device_connection_points').upsert(connectionPointRows, { onConflict: 'device_id,client_point_id' });
          if (connectionPointsError) {
            setWorkspaceSaveMessage(`Connection points save failed: ${connectionPointsError.message || 'Unknown error'}`);
            setSavingWorkspace(false);
            return;
          }
        }
      }
    }
    setWorkspaceSaveMessage(provisionedWorkspace ? 'Workspace created and rack devices saved.' : 'Rack devices saved to your workspace. You can now assign them to tasks.');
    setSavingWorkspace(false);
  }

  const allMessages = [...importErrors, ...validationMsgs];
  const dropGuideStyle = dropRU ? getDropGuideStyle(dropRU) : null;

  return (
    <div className="app-shell">
      <Header rackName={activeRack?.rackName} user={session?.user} onDashboard={onDashboard} onSettings={onSettings} onSignOut={onSignOut} onSaveToWorkspace={session ? saveToWorkspace : undefined} onRequireAuth={isGuest ? onRequireAuth : undefined} savingWorkspace={savingWorkspace}><div className="builder-controls"><FileMenu racks={racks} activeRack={activeRack} frameRef={frameRef} onImport={handleImport} onNewRack={handleAddRack} onRequireAuth={onRequireAuth} onExportCurrentPng={handleExportCurrentPng} onExportAllPng={handleExportAllPng} /><button title="Undo rack change" aria-label="Undo" onClick={undoRackChange} disabled={!undoStack.length}><Undo2 size={16} /></button><button title="Redo rack change" aria-label="Redo" onClick={redoRackChange} disabled={!redoStack.length}><Redo2 size={16} /></button></div></Header>
      {workspaceSaveMessage && <div className="validation-bar"><div className="validation-panel">{workspaceSaveMessage}</div></div>}
      {allMessages.length > 0 && (
        <div className="validation-bar">
          <ValidationPanel messages={allMessages} />
        </div>
      )}

      <div className={`canva-workspace${libraryOpen ? ' canva-workspace--library-open' : ''}`}>
        <aside className="tool-rail">{[{ id: 'devices', icon: Network, label: 'Devices' }, { id: 'elements', icon: Sparkles, label: 'Elements' }, { id: 'wiring', icon: Cable, label: 'Wiring' }, { id: 'text', icon: Type, label: 'Text' }, { id: 'shapes', icon: Shapes, label: 'Shapes' }, { id: 'images', icon: Image, label: 'Images' }, { id: 'tools', icon: Wrench, label: 'Tools' }, { id: 'templates', icon: LayoutTemplate, label: 'Templates' }].map(({ id, icon: Icon, label }) => <button key={id} className={activeTool === id ? 'active' : ''} onClick={() => { if (activeTool === id) setLibraryOpen((isOpen) => !isOpen); else { setActiveTool(id); setLibraryOpen(true); } }}><Icon size={20} /><span>{label}</span></button>)}</aside>
        {libraryOpen && <aside className="element-library"><div className="library-title"><h2>{activeTool === 'devices' ? 'Devices' : activeTool[0].toUpperCase() + activeTool.slice(1)}</h2><button aria-label="Close library" onClick={() => setLibraryOpen(false)}>x</button></div><div className="library-search"><Search size={16} /><input value={deviceSearch} onChange={(event) => setDeviceSearch(event.target.value)} placeholder={activeTool === 'devices' ? 'Search devices...' : `Search ${activeTool}...`} /><SlidersHorizontal size={16} /></div>{activeTool === 'devices' ? <div className="device-groups">{[{ title: 'Network', types: ['switch', 'router', 'firewall', 'patch_panel'] }, { title: 'Compute & Storage', types: ['server', 'nas', 'storage', 'nvr'] }, { title: 'Power', types: ['ups', 'pdu'] }, { title: 'Other', types: ['appliance', 'generic', 'other', 'cable_manager'] }].map(({ title, types }) => <section key={title}><h3>{title}</h3><div>{types.filter((type) => defaultLabel(type).toLowerCase().includes(deviceSearch.toLowerCase())).map((type) => <button key={type} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('rack-device-type', type); }} onClick={() => addDevice(type)}><span className={`device-art device-art--${type}`} /><b>{defaultLabel(type)}</b></button>)}</div></section>)}</div> : activeTool === 'wiring' ? <ToolList title="Network" kind="wire" items={[['Ethernet', Cable], ['Fibre', LineChart], ['Patch Cable', Cable], ['Power Cable', Cable], ['Connection Line', ArrowRight]]} onAdd={(name) => addCanvasElement('wire', name)} /> : activeTool === 'text' ? <ToolList title="Add text" kind="text" items={[['Heading', Type], ['Subheading', Type], ['Label', Type], ['Note', FileText]]} onAdd={(name) => addCanvasElement('text', name, { value: name === 'Heading' ? 'Rack heading' : name === 'Note' ? 'Add a note' : name })} /> : activeTool === 'shapes' ? <ToolList title="Shapes" kind="shape" items={[['Rectangle', Square], ['Circle', Circle], ['Line', LineChart], ['Arrow', ArrowRight]]} onAdd={(name) => addCanvasElement('shape', name)} /> : activeTool === 'images' ? <label className="image-upload"><Upload size={24} /><b>Upload image</b><span>Drag an image here or choose an image</span><input type="file" accept="image/*" onChange={addImage} /></label> : activeTool === 'tools' ? <ToolList title="Tools" kind="annotation" items={[['Select', MousePointer2], ['Pen', PenTool], ['Highlighter', Highlighter], ['Eraser', Eraser], ['Measure', Wrench]]} onAdd={(name) => name === 'Eraser' ? setCanvasElements([]) : addCanvasElement('annotation', name)} /> : <div className="template-list">{['Standard Network Rack', 'Server Rack', 'Office Rack', 'Core Switch Rack', 'Small Cabinet'].map((name) => <button key={name} onClick={() => handleLoadSample(sampleData.racks)}><span className="template-art" /><b>{name}</b><small>Use layout</small></button>)}</div>}</aside>}
        <main className="rack-canvas"><div className="canvas-hint"><Eye size={15} />{patchMedium ? ` ${patchSource === null ? `Select the ${patchMedium} source port.` : `Select the destination port for port ${patchSource.port}.`}` : ` ${viewSide === 'rear' ? 'Rear view. Drag devices between rack units.' : 'Double-click the rack header for rack properties, or a device to edit it.'}`}{patchMedium && <button type="button" className="canvas-hint-cancel" onClick={cancelPatch}>Cancel (Esc)</button>}</div><div ref={canvasRackRef} className={`canvas-rack${viewSide === 'rear' ? ' canvas-rack--rear' : ''}`} style={{ '--canvas-zoom': canvasZoom }} onPointerCancel={() => { setMovingItemIndex(null); setDropRU(null); }} onDragOver={(event) => { if (event.dataTransfer.types.includes('rack-device-type') || event.dataTransfer.types.includes('rack-canvas-element') || event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; if (event.dataTransfer.types.includes('rack-device-type')) setDropRU(getDropRU(event)); } }} onDragLeave={() => setDropRU(null)} onDrop={(event) => { event.preventDefault(); const type = event.dataTransfer.getData('rack-device-type'); const rawElement = event.dataTransfer.getData('rack-canvas-element'); const image = [...event.dataTransfer.files].find((file) => file.type.startsWith('image/')); const ru = getDropRU(event); if (type && ru) addDevice(type, ru); else if (rawElement) { try { const { kind, label } = JSON.parse(rawElement); addCanvasElementAt(kind, label, event, kind === 'text' ? { value: label === 'Heading' ? 'Rack heading' : label === 'Note' ? 'Add a note' : label } : {}); } catch {} } else if (image) addDroppedImage(image, event); setDropRU(null); }}>{activeRack ? <RackPreviewPanel rack={activeRack} onExportRef={captureFrameRef} onStartMoveItem={patchMedium ? undefined : setMovingItemIndex} onPatchDevice={patchMedium ? handlePatchDevice : undefined} patchSource={patchSource} onOpenProperties={setPropertiesItemIndex} onOpenRackProperties={() => setRackPropertiesOpen(true)} onContextMenuItem={openDeviceContextMenu} /> : <button className="canvas-empty" onClick={handleAddRack}>Create your first rack</button>}{dropRU && dropGuideStyle && <div className="rack-drop-guide" style={dropGuideStyle}>U{dropRU}</div>}<div className="canvas-overlays">{canvasElements.map((element) => <CanvasElement key={element.id} element={element} onRemove={() => setCanvasElements((elements) => elements.filter(({ id }) => id !== element.id))} />)}</div></div><div className="canvas-viewport-controls"><div className="view-toggle" aria-label="Rack view"><button className={viewSide === 'front' ? 'active' : ''} onClick={() => setViewSide('front')}>Front</button><button className={viewSide === 'rear' ? 'active' : ''} onClick={() => setViewSide('rear')}>Rear</button></div><div className="zoom-control"><button title="Select zoom level" aria-label="Select zoom level" aria-expanded={zoomMenuOpen} onClick={() => setZoomMenuOpen((isOpen) => !isOpen)}>{Math.round(canvasZoom * 100)}% <ChevronDown size={14} /></button>{zoomMenuOpen && <div className="zoom-menu">{[50, 75, 100, 125, 150].map((percent) => <button key={percent} className={Math.round(canvasZoom * 100) === percent ? 'active' : ''} onClick={() => { setCanvasZoom(percent / 100); setZoomMenuOpen(false); }}>{percent}%</button>)}</div>}</div><button title="Zoom out" aria-label="Zoom out" onClick={() => setCanvasZoom((zoom) => Math.max(0.5, zoom - 0.1))}><ZoomOut size={16} /></button><button title="Zoom in" aria-label="Zoom in" onClick={() => setCanvasZoom((zoom) => Math.min(1.5, zoom + 0.1))}><ZoomIn size={16} /></button><button title="Fit rack to canvas" aria-label="Fit rack to canvas" onClick={() => setCanvasZoom(1)}><Maximize size={16} /></button></div></main>
      </div>
      {propertiesItemIndex !== null && <DevicePropertiesModal key={`${activeIndex}-${propertiesItemIndex}`} item={activeRack?.items[propertiesItemIndex]} user={session?.user} onSave={saveDeviceProperties} onClose={() => setPropertiesItemIndex(null)} onDelete={() => requestConfirm('Delete this device from the rack? This cannot be undone.', () => removeDevice(propertiesItemIndex))} />}
      {contextMenu && (
        <div
          className="rack-item-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button type="button" onClick={() => { setPropertiesItemIndex(contextMenu.itemIndex); setContextMenu(null); }}><Pencil size={14} />Edit</button>
          <button type="button" onClick={() => { duplicateDevice(contextMenu.itemIndex); setContextMenu(null); }}><Copy size={14} />Duplicate</button>
          <button type="button" className="rack-item-context-menu-delete" onClick={() => { requestConfirm('Delete this device from the rack? This cannot be undone.', () => removeDevice(contextMenu.itemIndex)); setContextMenu(null); }}><Trash2 size={14} />Delete</button>
        </div>
      )}
      {confirmDialog && (
        <div className="app-confirm-backdrop" role="presentation" onPointerDown={() => setConfirmDialog(null)}>
          <div className="app-confirm-dialog" role="alertdialog" aria-modal="true" onPointerDown={(event) => event.stopPropagation()}>
            <p>{confirmDialog.message}</p>
            <div className="app-confirm-actions">
              <button type="button" onClick={() => setConfirmDialog(null)}>Cancel</button>
              <button type="button" className="app-confirm-danger" onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
      <RackPropertiesModal rack={rackPropertiesOpen ? activeRack : null} sites={sites} onSave={saveRackProperties} onClose={() => setRackPropertiesOpen(false)} />

      {/* ── Hidden off-screen container: diagram mode ZIP export ── */}
      <div
        ref={allRacksContainerRef}
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
        aria-hidden="true"
      >
        {racks.map((rack, i) => (
          <RackElevation key={`zip-${i}-${rack.rackName}`} rack={rack} />
        ))}
      </div>

      {/* ── Hidden off-screen container: simple mode ZIP export ── */}
      <div
        ref={allRacksSimpleRef}
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
        aria-hidden="true"
      >
        {racks.map((rack, i) => (
          <RackFrame key={`zip-simple-${i}-${rack.rackName}`} rack={rack} />
        ))}
      </div>
    </div>
  );
}
