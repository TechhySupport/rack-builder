import { useRef, useState } from 'react';
import RackFrame from './RackFrame';
import { RackElevation } from './RackElevation';

export default function RackPreviewPanel({ rack, onExportRef }) {
  const frameRef = useRef(null);
  const [diagramMode, setDiagramMode] = useState(true); // true = technical elevation

  // Expose frameRef to parent via callback
  if (onExportRef) onExportRef(frameRef);

  if (!rack) {
    return (
      <div className="preview-panel preview-empty">
        <div className="preview-placeholder">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="2" y="2" width="44" height="44" rx="6" stroke="#cbd5e1" strokeWidth="2"/>
            <rect x="8" y="8" width="32" height="6" rx="2" fill="#e2e8f0"/>
            <rect x="8" y="18" width="32" height="4" rx="2" fill="#e2e8f0"/>
            <rect x="8" y="26" width="32" height="4" rx="2" fill="#e2e8f0"/>
            <rect x="8" y="34" width="20" height="4" rx="2" fill="#e2e8f0"/>
          </svg>
          <p>Import or load sample data to see the rack preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="preview-panel preview-panel--with-toolbar">
      {/* Mode toggle */}
      <div className="preview-mode-bar">
        <span className="preview-mode-label">View:</span>
        <div className="preview-mode-toggle">
          <button
            className={`preview-mode-btn${diagramMode ? ' preview-mode-btn--active' : ''}`}
            onClick={() => setDiagramMode(true)}
            title="Technical elevation diagram (default)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="3" y="3" width="8" height="2" rx="0.5" fill="currentColor"/>
              <rect x="3" y="6.5" width="8" height="1.5" rx="0.5" fill="currentColor" opacity="0.6"/>
              <rect x="3" y="9.5" width="5" height="1.5" rx="0.5" fill="currentColor" opacity="0.4"/>
            </svg>
            Diagram
          </button>
          <button
            className={`preview-mode-btn${!diagramMode ? ' preview-mode-btn--active' : ''}`}
            onClick={() => setDiagramMode(false)}
            title="Simple coloured block view"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="4" rx="1" fill="currentColor"/>
              <rect x="1" y="6.5" width="12" height="3" rx="1" fill="currentColor" opacity="0.6"/>
              <rect x="1" y="10.5" width="12" height="2" rx="1" fill="currentColor" opacity="0.4"/>
            </svg>
            Simple
          </button>
        </div>
      </div>

      {diagramMode
        ? <RackElevation rack={rack} innerRef={frameRef} />
        : <RackFrame rack={rack} innerRef={frameRef} />
      }
    </div>
  );
}
