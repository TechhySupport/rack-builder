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
import { exportAllRacksAsZip } from './utils/exportAllPng';
import './styles.css';

function normalizeAll(racks) {
  return (racks || []).map(normalizeRackData);
}

const STORAGE_KEY_RACKS  = 'rack-builder-racks';
const STORAGE_KEY_INDEX  = 'rack-builder-active';
const DEFAULT_LEFT_WIDTH = 400;

export default function App() {
  const [racks, setRacks] = useState(() => {
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
  const frameRef             = useRef(null);
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

  // Store the RefObject itself so FileMenu always reads the live DOM element
  const captureFrameRef = useCallback((refObj) => {
    frameRef.current = refObj ?? null;
  }, []);

  async function handleExportAllPng(mode = 'diagram') {
    const el = mode === 'simple' ? allRacksSimpleRef.current : allRacksContainerRef.current;
    await exportAllRacksAsZip(racks, el, mode);
  }

  const allMessages = [...importErrors, ...validationMsgs];

  return (
    <div className="app-shell">
      <Header />

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="app-toolbar">
        <FileMenu
          racks={racks}
          activeRack={activeRack}
          frameRef={frameRef}
          onImport={handleImport}
          onExportAllPng={handleExportAllPng}
          onExportAllPngSimple={() => handleExportAllPng('simple')}
        />
        <div className="toolbar-vdiv" />
        <SampleSelector onLoad={handleLoadSample} />
        <button className="btn btn-ghost btn-sm" onClick={() => handleLoadSample(sampleData.racks)}>
          Load Sample
        </button>
        <button className="btn btn-ghost btn-sm" onClick={handleClear}>
          Clear
        </button>
      </div>

      {/* ── Validation bar (only when there are issues) ─────────────── */}
      {allMessages.length > 0 && (
        <div className="validation-bar">
          <ValidationPanel messages={allMessages} />
        </div>
      )}

      {/* ── Main body ───────────────────────────────────────────────── */}
      <div className="app-body">
        <aside className="left-panel" style={{ width: leftWidth, minWidth: leftWidth, maxWidth: leftWidth }}>
          {racks.length > 0 ? (
            <>
              <RackSelector
                racks={racks}
                activeIndex={activeIndex}
                onChange={setActiveIndex}
                onAdd={handleAddRack}
              />
              <RackEditorTable rack={activeRack} onChange={handleRackChange} />
            </>
          ) : (
            <div className="left-empty">
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <rect x="4" y="4" width="36" height="36" rx="5" stroke="#cbd5e1" strokeWidth="1.5"/>
                <rect x="9" y="11" width="26" height="4" rx="1.5" fill="#e2e8f0"/>
                <rect x="9" y="19" width="26" height="3" rx="1.5" fill="#e2e8f0" opacity="0.7"/>
                <rect x="9" y="25" width="18" height="3" rx="1.5" fill="#e2e8f0" opacity="0.5"/>
              </svg>
              <p>Use <strong>File</strong> to import rack data,<br/>or load a sample above.</p>
              <button className="btn btn-outline btn-sm" onClick={handleAddRack}>
                + Add New Rack
              </button>
            </div>
          )}
        </aside>

        <div className="panel-resizer" onMouseDown={onResizerMouseDown} />

        <main className="right-panel">
          <RackPreviewPanel rack={activeRack} onExportRef={captureFrameRef} />
        </main>
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
