import { useState, useRef, useCallback, useEffect } from 'react';
import Header from './components/Header';
import ValidationPanel from './components/ValidationPanel';
import RackSelector from './components/RackSelector';
import RackPreviewPanel from './components/RackPreviewPanel';
import RackEditorTable from './components/RackEditorTable';
import FileMenu from './components/FileMenu';
import SampleSelector from './components/SampleSelector';
import { RackElevation } from './components/RackElevation';
import RackFrame from './components/RackFrame';
import { sampleData } from './data/sampleRacks';
import { validateRackData, normalizeRackData } from './utils/rackUtils';
import { exportAllRacksAsZip, exportCurrentRackBothViews } from './utils/exportAllPng';
import { supabase } from './lib/supabase.js';
import { ArrowRight, Cable, ChevronDown, Circle, Eraser, Eye, FileText, Highlighter, Image, LayoutTemplate, LineChart, Maximize, MousePointer2, Network, PenTool, Redo2, Search, Shapes, SlidersHorizontal, Sparkles, Square, Type, Undo2, Upload, Wrench, ZoomIn } from 'lucide-react';
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

function ToolList({ title, items, onAdd }) {
  return <section className="tool-list"><h3>{title}</h3>{items.map(([name, Icon]) => <button key={name} onClick={() => onAdd(name)}><Icon size={18} /><span>{name}</span><b>+</b></button>)}</section>;
}

function CanvasElement({ element, onRemove }) {
  const style = { left: `${element.x}%`, top: `${element.y}%` };
  if (element.kind === 'image') return <figure className="canvas-object canvas-image" style={style}><button onClick={onRemove}>x</button><img src={element.src} alt={element.label} /></figure>;
  if (element.kind === 'wire') return <div className="canvas-object canvas-wire" style={style}><button onClick={onRemove}>x</button><i /><span>{element.label}</span></div>;
  if (element.kind === 'shape') return <div className={`canvas-object canvas-shape canvas-shape--${element.label.toLowerCase()}`} style={style}><button onClick={onRemove}>x</button>{element.label === 'Arrow' && <ArrowRight size={32} />}</div>;
  return <div className={`canvas-object canvas-${element.kind}`} style={style}><button onClick={onRemove}>x</button><span>{element.value || element.label}</span></div>;
}

export default function App({ isGuest = false, onRequireAuth, onSignOut, session }) {
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
  const [deviceSearch, setDeviceSearch] = useState('');
  const [canvasElements, setCanvasElements] = useState([]);
  const [dropRU, setDropRU] = useState(null);
  const [movingItemIndex, setMovingItemIndex] = useState(null);
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

  const activeRack = racks[activeIndex] || null;

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

  function handleRackChange(updatedRack) {
    const updated = racks.map((r, i) =>
      i === activeIndex ? normalizeRackData(updatedRack) : r
    );
    setRacks(updated);
    setValidationMsgs(validateRackData(updated));
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
      for (let ru = item.endRU; ru <= item.startRU; ru += 1) occupied.add(ru);
    });
    const maxRU = activeRack.maxRU || 42;
    const candidates = preferredRU ? [preferredRU, ...Array.from({ length: maxRU }, (_, index) => maxRU - index)] : Array.from({ length: maxRU }, (_, index) => maxRU - index);
    const placement = candidates.find((ru) => ru >= 1 && ru <= maxRU && !occupied.has(ru)) || 1;
    handleRackChange({ ...activeRack, items: [...activeRack.items, { startRU: placement, endRU: placement, type, label: defaultLabel(type) }] });
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

  function moveDevice(itemIndex, targetRU) {
    if (!activeRack || itemIndex < 0 || !targetRU) return;
    const item = activeRack.items[itemIndex];
    if (!item) return;
    const height = Math.abs(item.startRU - item.endRU) + 1;
    const startRU = Math.min(activeRack.maxRU || 42, targetRU + height - 1);
    const endRU = startRU - height + 1;
    const overlap = activeRack.items.some((candidate, index) => index !== itemIndex && candidate.endRU <= startRU && candidate.startRU >= endRU);
    if (overlap) return;
    const items = activeRack.items.map((candidate, index) => index === itemIndex ? { ...candidate, startRU, endRU } : candidate);
    handleRackChange({ ...activeRack, items });
  }

  function addCanvasElement(kind, label, extra = {}) {
    setCanvasElements((elements) => [...elements, { id: `${kind}-${Date.now()}-${elements.length}`, kind, label, x: 14 + (elements.length * 11) % 55, y: 16 + (elements.length * 13) % 62, ...extra }]);
  }

  function addImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addCanvasElement('image', file.name, { src: reader.result });
    reader.readAsDataURL(file);
    event.target.value = '';
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

  async function saveToWorkspace() {
    if (!supabase || !session) return;
    setSavingWorkspace(true);
    setWorkspaceSaveMessage('');
    const { data: memberships, error: membershipError } = await supabase
      .from('organisation_members')
      .select('organisation_id')
      .eq('user_id', session.user.id)
      .eq('status', 'active');
    const organisationIds = (memberships || []).map((membership) => membership.organisation_id);
    if (membershipError || organisationIds.length === 0) {
      setWorkspaceSaveMessage(membershipError?.message || 'Create a workspace before saving rack devices.');
      setSavingWorkspace(false);
      return;
    }
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, organisation_id')
      .in('organisation_id', organisationIds)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (siteError || !site) {
      setWorkspaceSaveMessage(siteError?.message || 'Add a site from the dashboard before saving rack devices.');
      setSavingWorkspace(false);
      return;
    }

    for (const [rackIndex, rack] of racks.entries()) {
      const builderRackKey = `local-rack-${rack.rackNumber || rackIndex + 1}`;
      const { data: savedRack, error: rackError } = await supabase
        .from('racks')
        .upsert({ organisation_id: site.organisation_id, site_id: site.id, name: rack.rackName || `Rack ${rackIndex + 1}`, identifier: rack.rackNumber || null, ru_capacity: rack.maxRU, doc_status: 'documented', created_by: session.user.id, builder_rack_key: builderRackKey }, { onConflict: 'organisation_id,builder_rack_key' })
        .select('id')
        .single();
      if (rackError || !savedRack) {
        setWorkspaceSaveMessage(rackError?.message || 'Unable to save this rack.');
        setSavingWorkspace(false);
        return;
      }
      const deviceRows = rack.items.filter((item) => item.type !== 'empty').map((item, itemIndex) => ({
        organisation_id: site.organisation_id,
        rack_id: savedRack.id,
        name: item.label || `Device ${itemIndex + 1}`,
        device_type: databaseDeviceType(item.type),
        ru_height: Math.abs(item.startRU - item.endRU) + 1,
        starting_ru: item.endRU,
        created_by: session.user.id,
        builder_device_key: `${builderRackKey}-item-${itemIndex + 1}`,
      }));
      if (deviceRows.length > 0) {
        const { error: deviceError } = await supabase
          .from('devices')
          .upsert(deviceRows, { onConflict: 'organisation_id,builder_device_key' });
        if (deviceError) {
          setWorkspaceSaveMessage(deviceError.message);
          setSavingWorkspace(false);
          return;
        }
      }
    }
    setWorkspaceSaveMessage('Rack devices saved to your workspace. You can now assign them to tasks.');
    setSavingWorkspace(false);
  }

  const allMessages = [...importErrors, ...validationMsgs];

  return (
    <div className="app-shell">
      <Header onSignOut={onSignOut} onSaveToWorkspace={session ? saveToWorkspace : undefined} savingWorkspace={savingWorkspace} />
      {workspaceSaveMessage && <div className="validation-bar"><div className="validation-panel">{workspaceSaveMessage}</div></div>}
      {allMessages.length > 0 && (
        <div className="validation-bar">
          <ValidationPanel messages={allMessages} />
        </div>
      )}

      <section className="builder-titlebar"><div><p>Racks <span>/</span> {activeRack?.rackName || 'New Rack'}</p><h1>{activeRack?.rackName || 'New Rack'}</h1><small>Design, visualise and document your rack layout.</small></div><div className="builder-controls"><button title="Undo"><Undo2 size={16} /></button><button title="Redo"><Redo2 size={16} /></button><button>100% <ChevronDown size={14} /></button><button title="Zoom"><ZoomIn size={16} /></button><button title="Fit canvas"><Maximize size={16} /></button><button className="active">Front View</button><button>Rear View</button><FileMenu racks={racks} activeRack={activeRack} frameRef={frameRef} onImport={handleImport} onRequireAuth={onRequireAuth} onExportCurrentPng={handleExportCurrentPng} onExportAllPng={handleExportAllPng} /></div></section>
      <div className="canva-workspace">
        <aside className="tool-rail">{[{ id: 'devices', icon: Network, label: 'Devices' }, { id: 'elements', icon: Sparkles, label: 'Elements' }, { id: 'wiring', icon: Cable, label: 'Wiring' }, { id: 'text', icon: Type, label: 'Text' }, { id: 'shapes', icon: Shapes, label: 'Shapes' }, { id: 'images', icon: Image, label: 'Images' }, { id: 'tools', icon: Wrench, label: 'Tools' }, { id: 'templates', icon: LayoutTemplate, label: 'Templates' }].map(({ id, icon: Icon, label }) => <button key={id} className={activeTool === id ? 'active' : ''} onClick={() => setActiveTool(id)}><Icon size={20} /><span>{label}</span></button>)}</aside>
        <aside className="element-library"><div className="library-title"><h2>{activeTool === 'devices' ? 'Devices' : activeTool[0].toUpperCase() + activeTool.slice(1)}</h2><button aria-label="Close library">x</button></div><div className="library-search"><Search size={16} /><input value={deviceSearch} onChange={(event) => setDeviceSearch(event.target.value)} placeholder={activeTool === 'devices' ? 'Search devices...' : `Search ${activeTool}...`} /><SlidersHorizontal size={16} /></div>{activeTool === 'devices' ? <div className="device-groups">{[{ title: 'Network', types: ['switch', 'catalyst_2960', 'patch_panel', 'firewall'] }, { title: 'Compute', types: ['server', 'nvr'] }, { title: 'Power', types: ['ups', 'pdu'] }, { title: 'Other', types: ['generic', 'cable_manager'] }].map(({ title, types }) => <section key={title}><h3>{title}</h3><div>{types.filter((type) => defaultLabel(type).toLowerCase().includes(deviceSearch.toLowerCase())).map((type) => <button key={type} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('rack-device-type', type); }} onClick={() => addDevice(type)}><span className={`device-art device-art--${type}`} /><b>{defaultLabel(type)}</b></button>)}</div></section>)}</div> : activeTool === 'wiring' ? <ToolList title="Network" items={[['Ethernet', Cable], ['Fibre', LineChart], ['Patch Cable', Cable], ['Power Cable', Cable], ['Connection Line', ArrowRight]]} onAdd={(name) => addCanvasElement('wire', name)} /> : activeTool === 'text' ? <ToolList title="Add text" items={[['Heading', Type], ['Subheading', Type], ['Label', Type], ['Note', FileText]]} onAdd={(name) => addCanvasElement('text', name, { value: name === 'Heading' ? 'Rack heading' : name === 'Note' ? 'Add a note' : name })} /> : activeTool === 'shapes' ? <ToolList title="Shapes" items={[['Rectangle', Square], ['Circle', Circle], ['Line', LineChart], ['Arrow', ArrowRight]]} onAdd={(name) => addCanvasElement('shape', name)} /> : activeTool === 'images' ? <label className="image-upload"><Upload size={24} /><b>Upload image</b><span>Drag an image here or choose an image</span><input type="file" accept="image/*" onChange={addImage} /></label> : activeTool === 'tools' ? <ToolList title="Tools" items={[['Select', MousePointer2], ['Pen', PenTool], ['Highlighter', Highlighter], ['Eraser', Eraser], ['Measure', Wrench]]} onAdd={(name) => name === 'Eraser' ? setCanvasElements([]) : addCanvasElement('annotation', name)} /> : <div className="template-list">{['Standard Network Rack', 'Server Rack', 'Office Rack', 'Core Switch Rack', 'Small Cabinet'].map((name) => <button key={name} onClick={() => handleLoadSample(sampleData.racks)}><span className="template-art" /><b>{name}</b><small>Use layout</small></button>)}</div>}</aside>
        <main className="rack-canvas"><div className="canvas-hint"><Eye size={15} /> Drag devices between rack units, or add one from the library.</div><div ref={canvasRackRef} className="canvas-rack" onPointerCancel={() => { setMovingItemIndex(null); setDropRU(null); }} onDragOver={(event) => { if (event.dataTransfer.types.includes('rack-device-type')) { event.preventDefault(); event.dataTransfer.dropEffect = getDropRU(event) ? 'copy' : 'none'; setDropRU(getDropRU(event)); } }} onDragLeave={() => setDropRU(null)} onDrop={(event) => { event.preventDefault(); const type = event.dataTransfer.getData('rack-device-type'); const ru = getDropRU(event); if (type && ru) addDevice(type, ru); setDropRU(null); }}>{activeRack ? <RackPreviewPanel rack={activeRack} onExportRef={captureFrameRef} onStartMoveItem={setMovingItemIndex} /> : <button className="canvas-empty" onClick={handleAddRack}>Create your first rack</button>}{dropRU && <div className="rack-drop-guide" style={{ top: `${44 + ((activeRack.maxRU - dropRU) * 28)}px` }}>U{dropRU}</div>}<div className="canvas-overlays">{canvasElements.map((element) => <CanvasElement key={element.id} element={element} onRemove={() => setCanvasElements((elements) => elements.filter(({ id }) => id !== element.id))} />)}</div></div></main>
        <aside className="properties-panel"><div className="properties-title"><div><p>Selected rack</p><h2>Device Properties</h2></div><button title="Properties"><PenTool size={17} /></button></div>{activeRack ? <><div className="properties-preview"><span className="device-art device-art--switch" /><b>{activeRack.items[0]?.label || 'Select a device'}</b></div><RackEditorTable rack={activeRack} onChange={handleRackChange} /></> : <p className="properties-empty">Create a rack to start editing its properties.</p>}</aside>
      </div>

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
