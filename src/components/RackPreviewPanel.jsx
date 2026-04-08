import { useRef } from 'react';
import RackFrame from './RackFrame';
import { exportRackAsPng } from '../utils/exportUtils';

export default function RackPreviewPanel({ rack, onExportRef }) {
  const frameRef = useRef(null);

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
    <div className="preview-panel">
      <RackFrame rack={rack} innerRef={frameRef} />
    </div>
  );
}
