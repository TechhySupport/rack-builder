import { useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { parseCsvRows, ALL_TYPES } from '../utils/rackUtils';
import { readFileAsText } from '../utils/exportUtils';

// ── Shared row parser (works for CSV and Excel) ──────────────────────────────
function processRows(rows, sourceLabel, onImport) {
  const { racks, errors } = parseCsvRows(rows);
  if (errors.length > 0) {
    // Show warnings but still load if we got racks
    console.warn(`${sourceLabel} import warnings:\n` + errors.join('\n'));
  }
  if (racks.length > 0) onImport(racks, errors);
  else alert(`No valid racks found in ${sourceLabel} file.`);
}

// ── Download the Excel template ──────────────────────────────────────────────
function downloadTemplate() {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Rack Data ────────────────────────────────────────────────────
  const dataRows = [
    ['Rack Name', 'Rack Number', 'Max RU', 'Start RU', 'End RU', 'Type', 'Label'],
    // Example rows
    ['Main Rack', '1', 42, 42, 42, 'patch_panel', 'Patch Panel A'],
    ['Main Rack', '1', 42, 41, 41, 'cable_manager', 'Horizontal Manager'],
    ['Main Rack', '1', 42, 40, 38, 'switch', 'Core Switch'],
    ['Main Rack', '1', 42, 37, 35, 'server', 'App Server 01'],
    ['Main Rack', '1', 42, 2, 1, 'ups', 'UPS 2200VA'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(dataRows);

  // Column widths
  ws['!cols'] = [
    { wch: 18 }, // Rack Name
    { wch: 12 }, // Rack Number
    { wch: 8  }, // Max RU
    { wch: 9  }, // Start RU
    { wch: 8  }, // End RU
    { wch: 16 }, // Type
    { wch: 28 }, // Label
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Rack Data');

  // ── Sheet 2: Valid Types reference ────────────────────────────────────────
  const typesRows = [
    ['Valid Types (use in the "Type" column)'],
    ...ALL_TYPES.map(t => [t]),
  ];
  const wsTypes = XLSX.utils.aoa_to_sheet(typesRows);
  wsTypes['!cols'] = [{ wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsTypes, 'Valid Types');

  XLSX.writeFile(wb, 'rack-builder-template.xlsx');
}

export default function FileImportCard({ onImport }) {
  const fileRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();

    try {
      if (name.endsWith('.csv')) {
        // ── CSV path ────────────────────────────────────────────────────────
        const text = await readFileAsText(file);
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        processRows(result.data, 'CSV', onImport);
      } else {
        // ── Excel path (.xlsx / .xls / .xlsm) ──────────────────────────────
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        // Use the first sheet
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        // Convert to array-of-objects (same header format as CSV)
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        processRows(rows, 'Excel', onImport);
      }
    } catch (err) {
      alert(`File read error: ${err.message}`);
    }
    e.target.value = '';
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Spreadsheet Import</h3>
      </div>
      <p className="card-desc">
        Upload an <strong>Excel (.xlsx)</strong> or <strong>CSV</strong> file.
        Columns required: <strong>Rack Name</strong>, <strong>Rack Number</strong>,{' '}
        <strong>Max RU</strong>, <strong>Start RU</strong>, <strong>End RU</strong>,{' '}
        <strong>Type</strong>, <strong>Label</strong>.
      </p>
      <div className="card-actions">
        <button className="btn btn-outline" onClick={() => fileRef.current.click()}>
          ↑&nbsp;&nbsp;Upload Excel / CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.xlsm,.csv"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <button className="btn btn-ghost" onClick={downloadTemplate} title="Download a prefilled Excel template">
          ↓&nbsp;&nbsp;Download Template
        </button>
      </div>
    </div>
  );
}
