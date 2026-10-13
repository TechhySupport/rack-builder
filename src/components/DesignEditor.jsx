import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight, Cable, ChevronDown, ChevronLeft, ChevronRight, Circle, Copy, Download, FileText, Hand, ImagePlus, Lock, LockOpen,
  LogOut, Maximize, Minus, MousePointer2, Pencil, Plus, Redo2, Save, Server, Share2, Square, Trash2, Type, Undo2,
} from 'lucide-react';
import { DESIGN_COLORS, DESIGN_FONTS, NODE_CATEGORIES, NODE_SIZE, fontFamily, nodeKind } from '../lib/designNodes.js';
import { LAYER, bboxOf, boundsOf } from '../lib/designGeometry.js';
import { GlyphIcon, GlyphPaths } from './DesignGlyph.jsx';
import ElementView from './DesignElementView.jsx';
import DesignRackImport from './DesignRackImport.jsx';
import DesignShareDialog from './DesignShareDialog.jsx';

const FONT = 'Manrope, system-ui, sans-serif';
const INK = '#1f2937';
const ACCENT = '#2563eb';
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const MAX_IMAGE_SIDE = 2400;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

const TOOLS = [
  { id: 'select', label: 'Select', key: 'V', icon: MousePointer2 },
  { id: 'hand', label: 'Pan', key: 'H', icon: Hand },
  { id: 'pen', label: 'Pen', key: 'P', icon: Pencil },
  { id: 'line', label: 'Line', key: 'L', icon: Minus },
  { id: 'arrow', label: 'Arrow', key: 'A', icon: ArrowUpRight },
  { id: 'rect', label: 'Box', key: 'R', icon: Square },
  { id: 'ellipse', label: 'Ellipse', key: 'O', icon: Circle },
  { id: 'text', label: 'Text', key: 'T', icon: Type },
  { id: 'link', label: 'Connect devices', key: 'K', icon: Cable },
];
const READ_ONLY_TOOLS = new Set(['select', 'hand']);
const SHORTCUTS = Object.fromEntries(TOOLS.map((tool) => [tool.key.toLowerCase(), tool.id]));
const WIDTHS = [1, 2, 4, 6];
const TEXT_SIZES = [14, 18, 24, 32, 48];
const STYLE_KEYS = {
  image: [],
  node: ['color'],
  text: ['color', 'size', 'font'],
  link: ['color', 'width', 'dashed'],
  line: ['color', 'width', 'dashed'],
  path: ['color', 'width'],
  rect: ['color', 'width', 'dashed', 'fill'],
  ellipse: ['color', 'width', 'dashed', 'fill'],
};

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function translated(el, dx, dy) {
  if (el.type === 'line') return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
  if (el.type === 'path') return { ...el, points: el.points.map(([x, y]) => [x + dx, y + dy]) };
  return { ...el, x: el.x + dx, y: el.y + dy };
}

function snapAngle(x1, y1, x2, y2) {
  const angle = Math.round(Math.atan2(y2 - y1, x2 - x1) / (Math.PI / 4)) * (Math.PI / 4);
  const length = Math.hypot(x2 - x1, y2 - y1);
  return { x: x1 + length * Math.cos(angle), y: y1 + length * Math.sin(angle) };
}

async function imageFileToDataUrl(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return { src: canvas.toDataURL('image/jpeg', 0.85), width, height };
}

// Shared across designs so elements can be copied between them.
let clipboard = null;

function isTyping(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

// Copies elements with fresh ids; links are kept only when both ends are copied too.
function cloneElements(list, dx, dy) {
  const idMap = new Map(list.map((el) => [el.id, uid()]));
  return list
    .filter((el) => el.type !== 'link' || (idMap.has(el.from) && idMap.has(el.to)))
    .map((el) => (el.type === 'link'
      ? { ...structuredClone(el), id: idMap.get(el.id), from: idMap.get(el.from), to: idMap.get(el.to) }
      : { ...translated(structuredClone(el), dx, dy), id: idMap.get(el.id) }));
}

// Elements touched by a selection rectangle; pictures must be fully inside, and links join when both ends are picked.
function idsInRect(list, rect) {
  const byElementId = Object.fromEntries(list.map((el) => [el.id, el]));
  const ids = list.filter((el) => el.type !== 'link' && !(el.type === 'image' && el.locked)).filter((el) => {
    const box = bboxOf(el, byElementId);
    if (!box) return false;
    if (el.type === 'image') return box.x >= rect.x && box.y >= rect.y && box.x + box.w <= rect.x + rect.w && box.y + box.h <= rect.y + rect.h;
    return box.x < rect.x + rect.w && box.x + box.w > rect.x && box.y < rect.y + rect.h && box.y + box.h > rect.y;
  }).map((el) => el.id);
  const picked = new Set(ids);
  list.forEach((el) => { if (el.type === 'link' && picked.has(el.from) && picked.has(el.to)) ids.push(el.id); });
  return ids;
}

export default function DesignEditor({ design, canEdit, canManage, currentUserId, onSave, onBack, onDelete, flushRef }) {
  const initialElements = useMemo(() => (Array.isArray(design.data?.elements) ? design.data.elements : []), [design.data]);
  const [elements, setElements] = useState(initialElements);
  const [name, setName] = useState(design.name);
  const [tool, setTool] = useState('select');
  const [selectedIds, setSelectedIds] = useState([]);
  const [marquee, setMarquee] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const [style, setStyle] = useState({ color: INK, width: 2, dashed: false, fill: false, size: 18, font: 'sans' });
  const [openCategories, setOpenCategories] = useState(() => new Set(['network']));
  const [tempLink, setTempLink] = useState(null);
  const [saveState, setSaveState] = useState('saved');
  const [canvasError, setCanvasError] = useState('');
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  const [focusRequest, setFocusRequest] = useState(0);
  const [rackDialog, setRackDialog] = useState(false);
  const [shareDialog, setShareDialog] = useState(false);
  const [fileMenu, setFileMenu] = useState(null);
  const [notice, setNotice] = useState('');

  const fileMenuRef = useRef(null);
  const svgRef = useRef(null);
  const fileRef = useRef(null);
  const labelRef = useRef(null);
  const elementsRef = useRef(initialElements);
  const viewRef = useRef(view);
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const gestureBeforeRef = useRef(null);
  const dragRef = useRef(null);
  const dirtyRef = useRef(false);
  const spaceRef = useRef(false);
  const actionsRef = useRef({});

  const byId = useMemo(() => Object.fromEntries(elements.map((el) => [el.id, el])), [elements]);
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const selected = selectedId ? byId[selectedId] : null;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selection = useMemo(() => selectedIds.map((id) => byId[id]).filter(Boolean), [selectedIds, byId]);
  const setSelectedId = (id) => setSelectedIds(id ? [id] : []);
  const activeTool = canEdit || READ_ONLY_TOOLS.has(tool) ? tool : 'hand';

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

  const setEls = useCallback((next) => {
    elementsRef.current = next;
    setElements(next);
  }, []);
  const applyView = useCallback((next) => {
    viewRef.current = next;
    setView(next);
  }, []);
  const syncHistory = () => setHistory({ undo: pastRef.current.length, redo: futureRef.current.length });
  const markDirty = () => {
    dirtyRef.current = true;
    setSaveState('dirty');
  };

  function pushHistory(before) {
    pastRef.current.push(before);
    if (pastRef.current.length > 100) pastRef.current.shift();
    futureRef.current = [];
    syncHistory();
  }
  function commit(next) {
    if (!canEdit) return;
    pushHistory(elementsRef.current);
    setEls(next);
    markDirty();
  }
  function beginGesture() {
    gestureBeforeRef.current = elementsRef.current;
  }
  function endGesture() {
    const before = gestureBeforeRef.current;
    gestureBeforeRef.current = null;
    if (before && before !== elementsRef.current) {
      pushHistory(before);
      markDirty();
    }
  }
  function cancelGesture() {
    if (gestureBeforeRef.current) setEls(gestureBeforeRef.current);
    gestureBeforeRef.current = null;
  }
  function undo() {
    const previous = pastRef.current.pop();
    if (!previous) return;
    futureRef.current.push(elementsRef.current);
    setEls(previous);
    syncHistory();
    markDirty();
  }
  function redo() {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(elementsRef.current);
    setEls(next);
    syncHistory();
    markDirty();
  }

  const zoomAt = useCallback((factor, cx, cy) => {
    const v = viewRef.current;
    const z = clamp(v.z * factor, MIN_ZOOM, MAX_ZOOM);
    const ratio = z / v.z;
    applyView({ z, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio });
  }, [applyView]);

  const fitView = useCallback((list) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const bounds = boundsOf(list);
    if (!bounds) {
      applyView({ x: 0, y: 0, z: 1 });
      return;
    }
    const pad = 70;
    const z = clamp(Math.min(rect.width / (bounds.w + pad * 2), rect.height / (bounds.h + pad * 2), 2), MIN_ZOOM, MAX_ZOOM);
    applyView({ z, x: (rect.width - bounds.w * z) / 2 - bounds.x * z, y: (rect.height - bounds.h * z) / 2 - bounds.y * z });
  }, [applyView]);

  // Frame existing content once the canvas has a size.
  useEffect(() => {
    const frame = requestAnimationFrame(() => fitView(elementsRef.current));
    return () => cancelAnimationFrame(frame);
  }, [fitView]);

  // Wheel: pinch / ctrl zooms, plain scroll pans.
  useEffect(() => {
    const svg = svgRef.current;
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
  }, [zoomAt, applyView]);

  function toWorld(event) {
    const rect = svgRef.current.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (event.clientX - rect.left - v.x) / v.z, y: (event.clientY - rect.top - v.y) / v.z };
  }

  function viewCenterWorld() {
    const rect = svgRef.current.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (rect.width / 2 - v.x) / v.z, y: (rect.height / 2 - v.y) / v.z, w: rect.width / v.z, h: rect.height / v.z };
  }

  async function addImageFile(file) {
    if (!canEdit || !file) return;
    setCanvasError('');
    if (!file.type.startsWith('image/')) { setCanvasError('That file is not an image.'); return; }
    if (file.size > MAX_IMAGE_BYTES) { setCanvasError('That image is larger than 25 MB.'); return; }
    try {
      placeImage(await imageFileToDataUrl(file));
    } catch {
      setCanvasError('Could not read that image.');
    }
  }

  function placeImage({ src, width, height }) {
    const center = viewCenterWorld();
    const scale = Math.min(1, (center.w * 0.7) / width, (center.h * 0.85) / height);
    const w = width * scale;
    const h = height * scale;
    const image = { id: uid(), type: 'image', src, x: center.x - w / 2, y: center.y - h / 2, w, h, locked: true };
    commit([image, ...elementsRef.current]);
    setSelectedId(image.id);
    setTool('select');
  }

  function chooseTool(id) {
    setTool(id);
    setTempLink(null);
  }
  function addDevice(id) {
    if (!canEdit) return;
    const kind = nodeKind(id);
    const rect = svgRef.current.getBoundingClientRect();
    const v = viewRef.current;
    let x = (rect.width / 2 - v.x) / v.z - NODE_SIZE / 2;
    let y = (rect.height / 2 - v.y) / v.z - NODE_SIZE / 2;
    // Cascade so repeated clicks do not stack devices on top of each other.
    while (elementsRef.current.some((el) => el.type === 'node' && Math.abs(el.x - x) < 20 && Math.abs(el.y - y) < 20)) {
      x += 28;
      y += 28;
    }
    const el = { id: uid(), type: 'node', kind: kind.id, x, y, label: kind.label, color: style.color === INK ? '#1f694d' : style.color };
    commit([...elementsRef.current, el]);
    setTool('select');
    setSelectedId(el.id);
  }

  function startPan(event) {
    const v = viewRef.current;
    dragRef.current = { type: 'pan', sx: event.clientX, sy: event.clientY, vx: v.x, vy: v.y };
  }

  function onPointerDown(event) {
    if (event.button === 1 || (event.button === 0 && spaceRef.current)) {
      svgRef.current.setPointerCapture(event.pointerId);
      startPan(event);
      return;
    }
    if (event.button !== 0) return;
    // Stops the browser moving focus off a field we focus during this gesture.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    event.preventDefault();
    const p = toWorld(event);
    const hitId = event.target.closest?.('[data-el]')?.getAttribute('data-el');
    const handle = event.target.closest?.('[data-handle]')?.getAttribute('data-handle');
    svgRef.current.setPointerCapture(event.pointerId);

    if (handle && selected && canEdit) {
      beginGesture();
      dragRef.current = { type: 'handle', handle, orig: selected };
      return;
    }

    switch (activeTool) {
      case 'hand':
        startPan(event);
        break;
      case 'select': {
        const hit = hitId ? byId[hitId] : null;
        if (!hit) {
          // Dragging on empty canvas draws a selection rectangle; Shift adds to the current selection.
          dragRef.current = { type: 'marquee', start: p, base: event.shiftKey ? selectedIds : [], rect: null };
          if (!event.shiftKey) setSelectedIds([]);
          break;
        }
        if (event.shiftKey) {
          setSelectedIds((current) => (current.includes(hit.id) ? current.filter((id) => id !== hit.id) : [...current, hit.id]));
          break;
        }
        const keep = selectedSet.has(hit.id);
        const ids = keep ? selectedIds : [hit.id];
        if (!keep) setSelectedIds(ids);
        if (canEdit && hit.type !== 'link' && !hit.locked) {
          const origs = ids.map((id) => byId[id]).filter((el) => el && el.type !== 'link' && !el.locked);
          beginGesture();
          dragRef.current = { type: 'move', start: p, origs, moved: false, collapseTo: keep && ids.length > 1 ? hit.id : null };
        } else {
          startPan(event);
        }
        break;
      }
      case 'pen': {
        const el = { id: uid(), type: 'path', points: [[p.x, p.y]], color: style.color, width: style.width };
        beginGesture();
        setEls([...elementsRef.current, el]);
        dragRef.current = { type: 'draw', id: el.id, tool: 'pen', start: p };
        break;
      }
      case 'line':
      case 'arrow': {
        const el = { id: uid(), type: 'line', x1: p.x, y1: p.y, x2: p.x, y2: p.y, arrow: activeTool === 'arrow', color: style.color, width: style.width, dashed: style.dashed };
        beginGesture();
        setEls([...elementsRef.current, el]);
        dragRef.current = { type: 'draw', id: el.id, tool: activeTool, start: p };
        break;
      }
      case 'rect':
      case 'ellipse': {
        const el = { id: uid(), type: activeTool, x: p.x, y: p.y, w: 0, h: 0, color: style.color, width: style.width, dashed: style.dashed, fill: style.fill };
        beginGesture();
        setEls([...elementsRef.current, el]);
        dragRef.current = { type: 'draw', id: el.id, tool: activeTool, start: p };
        break;
      }
      case 'text': {
        const el = { id: uid(), type: 'text', x: p.x, y: p.y, text: 'Text', size: style.size, font: style.font, color: style.color };
        commit([...elementsRef.current, el]);
        setSelectedId(el.id);
        setTool('select');
        setFocusRequest((n) => n + 1);
        break;
      }
      case 'link': {
        const hit = hitId ? byId[hitId] : null;
        if (hit?.type === 'node') {
          dragRef.current = { type: 'link', from: hit.id };
          setTempLink({ from: hit.id, x: p.x, y: p.y });
        } else {
          startPan(event);
        }
        break;
      }
      default:
        break;
    }
  }

  function onPointerMove(event) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.type === 'pan') {
      applyView({ ...viewRef.current, x: drag.vx + event.clientX - drag.sx, y: drag.vy + event.clientY - drag.sy });
      return;
    }
    const p = toWorld(event);
    const replace = (id, update) => setEls(elementsRef.current.map((el) => (el.id === id ? update(el) : el)));
    if (drag.type === 'move') {
      drag.moved = true;
      const originals = new Map(drag.origs.map((el) => [el.id, el]));
      const dx = p.x - drag.start.x;
      const dy = p.y - drag.start.y;
      setEls(elementsRef.current.map((el) => (originals.has(el.id) ? translated(originals.get(el.id), dx, dy) : el)));
    } else if (drag.type === 'marquee') {
      const rect = { x: Math.min(drag.start.x, p.x), y: Math.min(drag.start.y, p.y), w: Math.abs(p.x - drag.start.x), h: Math.abs(p.y - drag.start.y) };
      drag.rect = rect.w * viewRef.current.z > 3 || rect.h * viewRef.current.z > 3 ? rect : null;
      setMarquee(drag.rect);
    } else if (drag.type === 'draw') {
      if (drag.tool === 'pen') {
        replace(drag.id, (el) => {
          const last = el.points[el.points.length - 1];
          if (Math.hypot(p.x - last[0], p.y - last[1]) < 2 / viewRef.current.z) return el;
          return { ...el, points: [...el.points, [p.x, p.y]] };
        });
      } else if (drag.tool === 'line' || drag.tool === 'arrow') {
        const end = event.shiftKey ? snapAngle(drag.start.x, drag.start.y, p.x, p.y) : p;
        replace(drag.id, (el) => ({ ...el, x2: end.x, y2: end.y }));
      } else {
        replace(drag.id, (el) => ({ ...el, x: Math.min(drag.start.x, p.x), y: Math.min(drag.start.y, p.y), w: Math.abs(p.x - drag.start.x), h: Math.abs(p.y - drag.start.y) }));
      }
    } else if (drag.type === 'handle') {
      const { orig, handle } = drag;
      if (handle === 'p1' || handle === 'p2') {
        const fixed = handle === 'p1' ? { x: orig.x2, y: orig.y2 } : { x: orig.x1, y: orig.y1 };
        const end = event.shiftKey ? snapAngle(fixed.x, fixed.y, p.x, p.y) : p;
        replace(orig.id, (el) => (handle === 'p1' ? { ...el, x1: end.x, y1: end.y } : { ...el, x2: end.x, y2: end.y }));
      } else {
        const w = Math.max(12, p.x - orig.x);
        const h = orig.type === 'image' ? (w * orig.h) / orig.w : Math.max(12, p.y - orig.y);
        replace(orig.id, (el) => ({ ...el, w, h }));
      }
    } else if (drag.type === 'link') {
      setTempLink({ from: drag.from, x: p.x, y: p.y });
    }
  }

  function onPointerUp(event) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
    if (!drag || drag.type === 'pan') return;
    if (drag.type === 'marquee') {
      setMarquee(null);
      if (drag.rect) setSelectedIds([...new Set([...drag.base, ...idsInRect(elementsRef.current, drag.rect)])]);
      return;
    }
    if (drag.type === 'move' && !drag.moved && drag.collapseTo) setSelectedIds([drag.collapseTo]);
    if (drag.type === 'link') {
      setTempLink(null);
      const targetId = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-el]')?.getAttribute('data-el');
      const target = targetId ? byId[targetId] : null;
      if (target?.type === 'node' && target.id !== drag.from) {
        const link = { id: uid(), type: 'link', from: drag.from, to: target.id, label: '', color: style.color, width: style.width, dashed: style.dashed };
        commit([...elementsRef.current, link]);
        setSelectedId(link.id);
      }
      return;
    }
    if (drag.type === 'draw') {
      const el = elementsRef.current.find((item) => item.id === drag.id);
      const tiny = !el
        || (el.type === 'line' && Math.hypot(el.x2 - el.x1, el.y2 - el.y1) < 4)
        || ((el.type === 'rect' || el.type === 'ellipse') && (el.w < 4 || el.h < 4));
      if (tiny) cancelGesture();
      else {
        endGesture();
        if (el.type !== 'path') setSelectedId(el.id);
      }
      return;
    }
    endGesture();
  }

  function onDoubleClick(event) {
    const id = event.target.closest?.('[data-el]')?.getAttribute('data-el');
    const el = id ? byId[id] : null;
    if (el && canEdit && ['text', 'node', 'link'].includes(el.type)) {
      setSelectedId(el.id);
      setFocusRequest((n) => n + 1);
    }
  }

  function onDrop(event) {
    event.preventDefault();
    addImageFile(event.dataTransfer.files?.[0]);
  }

  useEffect(() => {
    if (focusRequest > 0) {
      labelRef.current?.focus();
      labelRef.current?.select();
    }
  }, [focusRequest]);

  function updateSelected(patch) {
    if (!selected) return;
    setEls(elementsRef.current.map((el) => (el.id === selected.id ? { ...el, ...patch } : el)));
  }
  function applyStyle(patch) {
    setStyle((current) => ({ ...current, ...patch }));
    const next = restyled(patch);
    if (next) commit(next);
  }
  // For continuous inputs (colour picker, size field): updates live and records one undo step per focus.
  function liveStyle(patch) {
    setStyle((current) => ({ ...current, ...patch }));
    const next = restyled(patch);
    if (next) setEls(next);
  }
  // Applies the style keys each selected element supports; null when nothing would change.
  function restyled(patch) {
    if (!canEdit || selection.length === 0) return null;
    const forType = (el) => Object.fromEntries(Object.entries(patch).filter(([key]) => (STYLE_KEYS[el.type] || []).includes(key)));
    if (!selection.some((el) => Object.keys(forType(el)).length > 0)) return null;
    return elementsRef.current.map((el) => (selectedSet.has(el.id) ? { ...el, ...forType(el) } : el));
  }
  function toggleCategory(id) {
    setOpenCategories((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function deleteSelected() {
    if (selection.length === 0 || !canEdit) return;
    commit(elementsRef.current.filter((el) => !selectedSet.has(el.id) && !(el.type === 'link' && (selectedSet.has(el.from) || selectedSet.has(el.to)))));
    setSelectedIds([]);
  }
  function duplicateSelected() {
    if (!canEdit || !selection.some((el) => el.type !== 'link')) return;
    const copies = cloneElements(selection, 28, 28);
    commit([...elementsRef.current, ...copies]);
    setSelectedIds(copies.map((el) => el.id));
  }
  function copySelected() {
    if (!selection.some((el) => el.type !== 'link')) return false;
    clipboard = { els: structuredClone(selection), offset: 28 };
    return true;
  }
  function selectAll() {
    setSelectedIds(elementsRef.current.filter((el) => !(el.type === 'image' && el.locked)).map((el) => el.id));
  }
  function cutSelected() {
    if (!canEdit || !copySelected()) return false;
    clipboard.offset = 0;
    deleteSelected();
    return true;
  }
  function pasteClipboard() {
    if (!canEdit || !clipboard) return false;
    const copies = cloneElements(clipboard.els, clipboard.offset, clipboard.offset);
    clipboard.offset += 28;
    commit([...elementsRef.current, ...copies]);
    setSelectedIds(copies.map((el) => el.id));
    setTool('select');
    return true;
  }

  async function flush() {
    if (!dirtyRef.current || !canEdit) return;
    dirtyRef.current = false;
    setSaveState('saving');
    const { error } = await onSave({ name: name.trim() || 'Untitled design', data: { version: 1, elements: elementsRef.current } });
    if (error) {
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

  async function leave() {
    setFileMenu(null);
    await flush();
    onBack();
  }

  async function leaveAndDelete() {
    setFileMenu(null);
    if (!window.confirm(`Delete "${name.trim() || 'Untitled design'}"? This cannot be undone.`)) return;
    dirtyRef.current = false;
    const { error } = await onDelete();
    if (error) setCanvasError(error.message || 'Could not delete the design.');
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

  function flashNotice(message) {
    setNotice(message);
    setTimeout(() => setNotice(''), 2600);
  }

  function saveBlob(blob, extension) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${(name.trim() || 'design').replace(/[^\w-]+/g, '-')}.${extension}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function downloadAs(format) {
    setFileMenu(null);
    const svg = svgRef.current;
    const bounds = boundsOf(elementsRef.current);
    if (!svg || !bounds) return;
    const pad = 40;
    const x = bounds.x - pad;
    const y = bounds.y - pad;
    const w = bounds.w + pad * 2;
    const h = bounds.h + pad * 2;
    const scale = clamp(2400 / Math.max(w, h), 0.5, 3);
    const world = svg.querySelector('#design-world').cloneNode(true);
    world.removeAttribute('transform');
    world.querySelectorAll('[data-ui]').forEach((node) => node.remove());
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * scale)}" height="${Math.round(h * scale)}" viewBox="${x} ${y} ${w} ${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>${new XMLSerializer().serializeToString(world)}</svg>`;
    const svgBlob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    if (format === 'svg') { saveBlob(svgBlob, 'svg'); return; }
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) { setCanvasError('Could not export the design.'); return; }
        saveBlob(blob, format === 'jpeg' ? 'jpg' : 'png');
      }, format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.92);
    };
    image.onerror = () => { URL.revokeObjectURL(url); setCanvasError('Could not export the design.'); };
    image.src = url;
  }

  useEffect(() => {
    if (!fileMenu) return undefined;
    function onDown(event) { if (fileMenuRef.current && !fileMenuRef.current.contains(event.target)) setFileMenu(null); }
    function onKey(event) { if (event.key === 'Escape') setFileMenu(null); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [fileMenu]);

  // Keyboard and paste handlers always see the latest actions through a ref.
  useEffect(() => {
    actionsRef.current = { undo, redo, deleteSelected, duplicateSelected, copySelected, cutSelected, pasteClipboard, selectAll, chooseTool, addImageFile, canEdit };
  });
  useEffect(() => {
    function onKeyDown(event) {
      if (isTyping(event.target)) return;
      const actions = actionsRef.current;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (event.key === ' ') { spaceRef.current = true; event.preventDefault(); return; }
      if (mod && key === 'z') { event.preventDefault(); if (event.shiftKey) actions.redo(); else actions.undo(); return; }
      if (mod && key === 'y') { event.preventDefault(); actions.redo(); return; }
      if (mod && key === 'd') { event.preventDefault(); actions.duplicateSelected(); return; }
      if (mod && key === 'a') { event.preventDefault(); actions.selectAll(); return; }
      if (mod || event.altKey) return;
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); actions.deleteSelected(); return; }
      if (event.key === 'Escape') { actions.chooseTool('select'); setSelectedIds([]); return; }
      const next = SHORTCUTS[key];
      if (next && (actions.canEdit || READ_ONLY_TOOLS.has(next))) actions.chooseTool(next);
    }
    function onKeyUp(event) {
      if (event.key === ' ') spaceRef.current = false;
    }
    function onPaste(event) {
      if (isTyping(event.target)) return;
      const file = [...(event.clipboardData?.files || [])].find((item) => item.type.startsWith('image/'));
      if (file) { event.preventDefault(); actionsRef.current.addImageFile(file); return; }
      if (actionsRef.current.pasteClipboard()) event.preventDefault();
    }
    function onCopy(event) {
      if (isTyping(event.target)) return;
      if (actionsRef.current.copySelected()) event.preventDefault();
    }
    function onCut(event) {
      if (isTyping(event.target)) return;
      if (actionsRef.current.cutSelected()) event.preventDefault();
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('paste', onPaste);
    window.addEventListener('copy', onCopy);
    window.addEventListener('cut', onCut);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('copy', onCopy);
      window.removeEventListener('cut', onCut);
    };
  }, []);

  const shown = selected || null;
  const STYLE_ORDER = ['color', 'size', 'font', 'width', 'dashed', 'fill'];
  const showKeys = selection.length > 0
    ? STYLE_ORDER.filter((key) => selection.some((el) => (STYLE_KEYS[el.type] || []).includes(key)))
    : ['color', 'width', 'dashed', 'fill'];
  const styleValue = (key) => {
    const source = selection.find((el) => el[key] !== undefined && (STYLE_KEYS[el.type] || []).includes(key));
    return source ? source[key] : style[key];
  };
  const frames = selection.filter((el) => ['image', 'rect', 'ellipse', 'node', 'text'].includes(el.type)).map((el) => ({ id: el.id, ...bboxOf(el, byId) }));
  const hasResize = shown && ['image', 'rect', 'ellipse'].includes(shown.type) && !shown.locked;
  const labelValue = shown?.type === 'text' ? shown.text : shown?.label ?? '';
  const labelKey = shown?.type === 'text' ? 'text' : 'label';
  const handle = 10 / view.z;
  const tempFrom = tempLink ? byId[tempLink.from] : null;
  const cursor = { hand: 'grab', select: 'default', text: 'text' }[activeTool] || 'crosshair';
  const saveLabel = { saved: 'All changes saved', saving: 'Saving...', dirty: 'Unsaved changes', error: 'Could not save. Retrying on next change.' }[saveState];

  return (
    <div className="design-editor">
      <div className="design-topbar">
        <div className="design-file" ref={fileMenuRef}>
          <button type="button" className="design-file-btn" aria-haspopup="menu" aria-expanded={Boolean(fileMenu)} onClick={() => setFileMenu(fileMenu ? null : 'main')}>
            <FileText size={16} />File<ChevronDown size={14} />
          </button>
          {fileMenu && (
            <div className="menu-popover design-file-menu" role="menu">
              {fileMenu === 'main' ? (
                <>
                  <button type="button" role="menuitem" className="menu-item design-menu-row" onClick={saveNow} disabled={!canEdit}><Save size={15} />Save</button>
                  <button type="button" role="menuitem" className="menu-item design-menu-row" onClick={() => setFileMenu('download')} disabled={elements.length === 0}><Download size={15} />Download as...<ChevronRight size={14} className="design-menu-end" /></button>
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
        <input
          className="design-name"
          value={name}
          onChange={(event) => { setName(event.target.value); markDirty(); }}
          readOnly={!canEdit}
          maxLength={120}
          aria-label="Design name"
        />
        <span className={`design-save design-save--${saveState}`} role="status">{canEdit ? saveLabel : 'View only'}</span>
        <div className="design-topbar-actions">
          <button type="button" className="design-icon-btn" onClick={undo} disabled={!canEdit || history.undo === 0} title="Undo (Cmd+Z)" aria-label="Undo"><Undo2 size={17} /></button>
          <button type="button" className="design-icon-btn" onClick={redo} disabled={!canEdit || history.redo === 0} title="Redo (Shift+Cmd+Z)" aria-label="Redo"><Redo2 size={17} /></button>
          {canEdit && <button type="button" className="dashboard-secondary design-btn" onClick={() => fileRef.current?.click()}><ImagePlus size={16} />Add picture</button>}
          {canEdit && <button type="button" className="dashboard-secondary design-btn" onClick={() => setRackDialog(true)}><Server size={16} />Import rack</button>}
          <button type="button" className="dashboard-secondary design-btn" onClick={() => downloadAs('png')} disabled={elements.length === 0}><Download size={16} />Export PNG</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => { addImageFile(event.target.files?.[0]); event.target.value = ''; }} />
        </div>
      </div>

      <div className="design-workspace">
        <aside className="design-tools" aria-label="Design tools">
          <p className="design-tools-heading">Tools</p>
          <div className="design-tool-grid">
            {TOOLS.map(({ id, label, key, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className="design-tool"
                aria-pressed={activeTool === id}
                disabled={!canEdit && !READ_ONLY_TOOLS.has(id)}
                title={`${label} (${key})`}
                aria-label={label}
                onClick={() => chooseTool(id)}
              ><Icon size={18} /></button>
            ))}
          </div>

          {canEdit && (
            <>
              <p className="design-tools-heading">Devices</p>
              {NODE_CATEGORIES.map((category) => {
                const open = openCategories.has(category.id);
                return (
                  <div key={category.id} className="design-category">
                    <button type="button" className="design-category-head" aria-expanded={open} onClick={() => toggleCategory(category.id)}>
                      <ChevronRight size={14} className="design-category-chevron" />{category.label}<span>{category.kinds.length}</span>
                    </button>
                    {open && (
                      <div className="design-node-grid">
                        {category.kinds.map((kind) => (
                          <button key={kind.id} type="button" className="design-node-btn" title={`Add ${kind.label.toLowerCase()}`} onClick={() => addDevice(kind.id)}>
                            <GlyphIcon glyph={kind.glyph} size={22} />
                            <span>{kind.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {showKeys.length > 0 && <p className="design-tools-heading">Style</p>}
              {showKeys.includes('color') && (
                <div className="design-swatches">
                  {DESIGN_COLORS.map((color) => (
                    <button key={color} type="button" className="design-swatch" style={{ background: color }} aria-pressed={styleValue('color') === color} aria-label={`Colour ${color}`} onClick={() => applyStyle({ color })} />
                  ))}
                  <label className="design-swatch design-swatch--custom" title="Custom colour">
                    <input type="color" value={styleValue('color')} aria-label="Custom colour" onFocus={beginGesture} onBlur={endGesture} onChange={(event) => liveStyle({ color: event.target.value })} />
                  </label>
                </div>
              )}
              {showKeys.includes('width') && (
                <div className="design-segment" role="group" aria-label="Line width">
                  {WIDTHS.map((width) => <button key={width} type="button" aria-pressed={styleValue('width') === width} onClick={() => applyStyle({ width })}><i style={{ height: width }} /></button>)}
                </div>
              )}
              {showKeys.includes('size') && (
                <div className="design-segment" role="group" aria-label="Text size">
                  {TEXT_SIZES.map((size) => <button key={size} type="button" aria-pressed={styleValue('size') === size} onClick={() => applyStyle({ size })}>{size}</button>)}
                </div>
              )}
              {showKeys.includes('size') && (
                <label className="design-field">Size
                  <input
                    type="number"
                    min="6"
                    max="300"
                    value={styleValue('size')}
                    onFocus={beginGesture}
                    onBlur={() => { liveStyle({ size: clamp(Number(styleValue('size')) || 18, 6, 300) }); endGesture(); }}
                    onChange={(event) => { const next = Number(event.target.value); if (next > 0) liveStyle({ size: Math.min(300, next) }); }}
                  />
                </label>
              )}
              {showKeys.includes('font') && (
                <label className="design-field">Font
                  <select value={styleValue('font') || 'sans'} onChange={(event) => applyStyle({ font: event.target.value })} style={{ fontFamily: fontFamily(styleValue('font')) }}>
                    {DESIGN_FONTS.map((font) => <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>{font.label}</option>)}
                  </select>
                </label>
              )}
              {showKeys.includes('dashed') && (
                <label className="design-check"><input type="checkbox" checked={Boolean(styleValue('dashed'))} onChange={(event) => applyStyle({ dashed: event.target.checked })} />Dashed</label>
              )}
              {showKeys.includes('fill') && (
                <label className="design-check"><input type="checkbox" checked={Boolean(styleValue('fill'))} onChange={(event) => applyStyle({ fill: event.target.checked })} />Tinted fill</label>
              )}
            </>
          )}
        </aside>

        <div
          className="design-canvas"
          style={{ backgroundSize: `${24 * view.z}px ${24 * view.z}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
        >
          <svg
            ref={svgRef}
            className="design-svg"
            style={{ cursor }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
          >
            <g id="design-world" transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
              {ordered.map((el) => <ElementView key={el.id} el={el} byId={byId} linkOffsets={linkOffsets} zoom={view.z} selected={selectedSet.has(el.id)} />)}

              {tempLink && tempFrom && (
                <line data-ui x1={tempFrom.x + NODE_SIZE / 2} y1={tempFrom.y + NODE_SIZE / 2} x2={tempLink.x} y2={tempLink.y} stroke={ACCENT} strokeWidth={2 / view.z} strokeDasharray={`${6 / view.z} ${4 / view.z}`} pointerEvents="none" />
              )}

              {frames.map((frame) => (
                <rect key={frame.id} data-ui x={frame.x - 6 / view.z} y={frame.y - 6 / view.z} width={frame.w + 12 / view.z} height={frame.h + 12 / view.z} fill="none" stroke={ACCENT} strokeWidth={1.5 / view.z} strokeDasharray={`${5 / view.z} ${4 / view.z}`} pointerEvents="none" />
              ))}
              {marquee && (
                <rect data-ui x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill={ACCENT} fillOpacity=".08" stroke={ACCENT} strokeWidth={1 / view.z} pointerEvents="none" />
              )}
              {canEdit && hasResize && (
                <rect data-ui data-handle="se" x={shown.x + shown.w - handle / 2} y={shown.y + shown.h - handle / 2} width={handle} height={handle} fill="#ffffff" stroke={ACCENT} strokeWidth={1.5 / view.z} style={{ cursor: 'nwse-resize' }} />
              )}
              {canEdit && shown?.type === 'line' && [['p1', shown.x1, shown.y1], ['p2', shown.x2, shown.y2]].map(([key, hx, hy]) => (
                <circle key={key} data-ui data-handle={key} cx={hx} cy={hy} r={handle * 0.6} fill="#ffffff" stroke={ACCENT} strokeWidth={1.5 / view.z} style={{ cursor: 'move' }} />
              ))}
            </g>
          </svg>

          {elements.length === 0 && (
            <div className="design-empty">
              <h2>Blank canvas</h2>
              <p>{canEdit ? 'Add a picture of a rack to draw over it, or click a device on the left to add it.' : 'This design is empty.'}</p>
              {canEdit && <button type="button" className="dashboard-primary" onClick={() => fileRef.current?.click()}><ImagePlus size={16} />Add rack picture</button>}
            </div>
          )}

          {canEdit && activeTool === 'link' && <div className="design-hint">Drag from one device to another to connect them.</div>}
          {canvasError && <div className="design-error" role="alert">{canvasError}<button type="button" onClick={() => setCanvasError('')}>Dismiss</button></div>}

          {(shown || selection.length > 1) && canEdit && (
            <div className="design-context">
              {!shown && <span className="design-context-count">{selection.length} selected</span>}
              {(shown?.type === 'node' || shown?.type === 'link' || shown?.type === 'text') && (
                shown.type === 'text'
                  ? <textarea ref={labelRef} rows={1} value={labelValue} aria-label="Text" onFocus={beginGesture} onBlur={endGesture} onChange={(event) => updateSelected({ [labelKey]: event.target.value })} />
                  : <input ref={labelRef} value={labelValue} placeholder={shown.type === 'link' ? 'Link label (VLAN, speed...)' : 'Device name'} aria-label="Label" maxLength={60} onFocus={beginGesture} onBlur={endGesture} onChange={(event) => updateSelected({ [labelKey]: event.target.value })} />
              )}
              {shown?.type === 'image' && (
                <button type="button" className="design-icon-btn" onClick={() => commit(elementsRef.current.map((el) => (el.id === shown.id ? { ...el, locked: !el.locked } : el)))} title={shown.locked ? 'Unlock to move or resize' : 'Lock in place'} aria-label={shown.locked ? 'Unlock picture' : 'Lock picture'}>
                  {shown.locked ? <Lock size={16} /> : <LockOpen size={16} />}
                </button>
              )}
              {shown?.type !== 'link' && <button type="button" className="design-icon-btn" onClick={duplicateSelected} title="Duplicate (Cmd+D)" aria-label="Duplicate"><Copy size={16} /></button>}
              <button type="button" className="design-icon-btn design-icon-btn--danger" onClick={deleteSelected} title="Delete" aria-label="Delete"><Trash2 size={16} /></button>
            </div>
          )}

          <div className="design-zoom">
            <button type="button" onClick={() => { const r = svgRef.current.getBoundingClientRect(); zoomAt(1 / 1.25, r.width / 2, r.height / 2); }} aria-label="Zoom out"><Minus size={15} /></button>
            <span>{Math.round(view.z * 100)}%</span>
            <button type="button" onClick={() => { const r = svgRef.current.getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); }} aria-label="Zoom in"><Plus size={15} /></button>
            <button type="button" onClick={() => fitView(elementsRef.current)} aria-label="Fit to content" title="Fit to content"><Maximize size={15} /></button>
          </div>
        </div>
      </div>
      {notice && <div className="design-hint design-notice" role="status">{notice}</div>}
      {shareDialog && (
        <DesignShareDialog
          design={{ ...design, name: name.trim() || 'Untitled design' }}
          canManage={canManage}
          currentUserId={currentUserId}
          onClose={() => setShareDialog(false)}
          onCopied={() => flashNotice('Link copied')}
        />
      )}
      {rackDialog && (
        <DesignRackImport
          organisationId={design.organisation_id}
          onClose={() => setRackDialog(false)}
          onImport={(picture) => { setRackDialog(false); placeImage(picture); }}
        />
      )}
    </div>
  );
}
