import { useRef } from 'react';
import { downloadJsonFile, exportRackAsPng } from '../utils/exportUtils';

export default function ExportPanel({ racks, activeRack, frameRef }) {
  function handleExportCurrentJson() {
    if (!activeRack) return;
    downloadJsonFile({ racks: [activeRack] }, `${activeRack.rackName || 'rack'}.json`);
  }

  function handleExportAllJson() {
    if (!racks || racks.length === 0) return;
    downloadJsonFile({ racks }, 'all-racks.json');
  }

  async function handleExportPng() {
    if (!frameRef || !frameRef.current) { alert('No rack to export.'); return; }
    try {
      await exportRackAsPng(frameRef.current, `${activeRack?.rackName || 'rack'}.png`);
    } catch (e) {
      alert(`PNG export failed: ${e.message}`);
    }
  }

  function handlePrint() {
    window.print();
  }

  const disabled = !activeRack;

  return (
    <div className="export-panel">
      <div className="export-panel-title">Export</div>
      <div className="export-actions">
        <button className="btn btn-sm btn-outline" disabled={disabled} onClick={handleExportCurrentJson}>
          JSON — Current Rack
        </button>
        <button className="btn btn-sm btn-outline" disabled={!racks?.length} onClick={handleExportAllJson}>
          JSON — All Racks
        </button>
        <button className="btn btn-sm btn-primary" disabled={disabled} onClick={handleExportPng}>
          Export PNG
        </button>
        <button className="btn btn-sm btn-ghost" disabled={disabled} onClick={handlePrint}>
          Print
        </button>
      </div>
    </div>
  );
}
