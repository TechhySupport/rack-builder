import * as XLSX from 'xlsx';
import { downloadJsonFile, exportRackAsPng } from '../utils/exportUtils';

// ── Export racks to .xlsx (flat row format matching the template) ─────────────
function exportToExcel(racks, filename) {
  const rows = [];
  racks.forEach(rack => {
    (rack.items || []).forEach(item => {
      rows.push({
        'Rack Name':   rack.rackName   || '',
        'Rack Number': rack.rackNumber || '',
        'Max RU':      rack.maxRU      || 42,
        'Start RU':    item.startRU,
        'End RU':      item.endRU,
        'Type':        item.type       || 'generic',
        'Label':       item.label      || '',
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 18 }, { wch: 12 }, { wch: 8 },
    { wch: 9  }, { wch: 8  }, { wch: 16 }, { wch: 28 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rack Data');
  XLSX.writeFile(wb, filename);
}

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

  function handleExportExcel() {
    if (!racks || racks.length === 0) return;
    exportToExcel(racks, 'all-racks.xlsx');
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
        <button className="btn btn-sm btn-outline" disabled={!racks?.length} onClick={handleExportExcel}>
          Excel — All Racks
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
