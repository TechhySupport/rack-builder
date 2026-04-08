import { useState, useRef, useCallback } from 'react';
import Header from './components/Header';
import JsonImportCard from './components/JsonImportCard';
import FileImportCard from './components/FileImportCard';
import ValidationPanel from './components/ValidationPanel';
import RackSelector from './components/RackSelector';
import RackPreviewPanel from './components/RackPreviewPanel';
import RackEditorTable from './components/RackEditorTable';
import ExportPanel from './components/ExportPanel';
import SampleSelector from './components/SampleSelector';
import { sampleData } from './data/sampleRacks';
import { validateRackData, normalizeRackData } from './utils/rackUtils';
import './styles.css';

function normalizeAll(racks) {
  return (racks || []).map(normalizeRackData);
}

export default function App() {
  const [racks, setRacks] = useState(() => normalizeAll(sampleData.racks));
  const [activeIndex, setActiveIndex] = useState(0);
  const [validationMsgs, setValidationMsgs] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const frameRef = useRef(null);

  const activeRack = racks[activeIndex] || null;

  function applyRacks(newRacks) {
    const normalized = normalizeAll(newRacks);
    setRacks(normalized);
    setActiveIndex(0);
    setValidationMsgs(validateRackData(normalized));
  }

  function handleJsonImport(newRacks) {
    setImportErrors([]);
    applyRacks(newRacks);
  }

  function handleCsvImport(newRacks, errors) {
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
    const updated = racks.map((r, i) => (i === activeIndex ? normalizeRackData(updatedRack) : r));
    setRacks(updated);
    setValidationMsgs(validateRackData(updated));
  }

  const captureFrameRef = useCallback((ref) => {
    frameRef.current = ref?.current || null;
  }, []);

  const allMessages = [...importErrors, ...validationMsgs];

  return (
    <div className="app-shell">
      <Header />
      <div className="app-toolbar">
        <SampleSelector onLoad={handleLoadSample} />
        <button className="btn btn-ghost btn-sm" onClick={() => handleLoadSample(sampleData.racks)}>
          Load Sample
        </button>
        <button className="btn btn-ghost btn-sm" onClick={handleClear}>
          Clear
        </button>
        <div className="toolbar-sep" />
        <ExportPanel racks={racks} activeRack={activeRack} frameRef={frameRef} />
      </div>

      <div className="app-body">
        <aside className="left-panel">
          <JsonImportCard onImport={handleJsonImport} />
          <FileImportCard onImport={handleCsvImport} />
          {allMessages.length > 0 && <ValidationPanel messages={allMessages} />}
          {racks.length > 0 && (
            <>
              <RackSelector
                racks={racks}
                activeIndex={activeIndex}
                onChange={setActiveIndex}
              />
              <RackEditorTable rack={activeRack} onChange={handleRackChange} />
            </>
          )}
          {racks.length === 0 && allMessages.length === 0 && (
            <ValidationPanel messages={[]} />
          )}
        </aside>

        <main className="right-panel">
          <RackPreviewPanel
            rack={activeRack}
            onExportRef={captureFrameRef}
          />
        </main>
      </div>
    </div>
  );
}
