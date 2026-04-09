import { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { parseJsonInput, parseCsvRows, ALL_TYPES } from '../utils/rackUtils';
import { readFileAsText, downloadJsonFile, exportRackAsPng } from '../utils/exportUtils';

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconFolder = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M1 2.8A1.8 1.8 0 012.8 1h2.38a1 1 0 01.71.29l.92.92H11.2A1.8 1.8 0 0113 4v7.2A1.8 1.8 0 0111.2 13H2.8A1.8 1.8 0 011 11.2V2.8z"
      stroke="currentColor" strokeWidth="1.1" fill="none"/>
  </svg>
);
const IconChevron = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

export default function FileMenu({ racks, activeRack, frameRef, onImport, onExportCurrentPng, onExportAllPng }) {
  const [open,       setOpen]       = useState(false);
  const [jsonModal,  setJsonModal]  = useState(false);
  const [jsonText,   setJsonText]   = useState('');
  const [jsonError,  setJsonError]  = useState('');
  const [exporting,  setExporting]  = useState(false);

  const menuRef        = useRef(null);
  const jsonFileRef    = useRef(null);
  const spreadsheetRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function closeMenu() { setOpen(false); }

  // ── JSON Import ─────────────────────────────────────────────────────────────
  function openJsonModal() { closeMenu(); setJsonModal(true); }
  function closeJsonModal() { setJsonModal(false); setJsonError(''); }

  function handleJsonRender() {
    const { racks: r, errors } = parseJsonInput(jsonText);
    if (errors.length > 0) { setJsonError(errors.join('\n')); return; }
    setJsonError('');
    setJsonModal(false);
    setJsonText('');
    onImport(r, []);
  }

  async function handleJsonFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text    = await readFileAsText(file);
      const { racks: r, errors } = parseJsonInput(text);
      if (errors.length > 0) {
        setJsonText(text); setJsonError(errors.join('\n')); setJsonModal(true); closeMenu();
      } else {
        onImport(r, []); closeMenu();
      }
    } catch (err) { alert(`Read error: ${err.message}`); }
    e.target.value = '';
  }

  // ── Excel / CSV Import ──────────────────────────────────────────────────────
  async function handleSpreadsheet(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      let rows;
      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await readFileAsText(file);
        rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
      } else {
        const buf = await file.arrayBuffer();
        const wb  = XLSX.read(buf, { type: 'array' });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      }
      const { racks: r, errors } = parseCsvRows(rows);
      if (r.length > 0) onImport(r, errors);
      else alert('No valid racks found in file.');
      closeMenu();
    } catch (err) { alert(`Import error: ${err.message}`); }
    e.target.value = '';
  }

  // ── Download Excel Template ─────────────────────────────────────────────────
  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Rack Name', 'Rack Number', 'Max RU', 'Start RU', 'End RU', 'Type', 'Label'],
      ['Main Rack', '1', 42, 42, 42, 'patch_panel',   'Patch Panel A'],
      ['Main Rack', '1', 42, 41, 41, 'cable_manager', 'Horizontal Manager'],
      ['Main Rack', '1', 42, 40, 38, 'switch',        'Core Switch'],
      ['Main Rack', '1', 42,  2,  1, 'ups',           'UPS 2200VA'],
    ]);
    ws['!cols'] = [18, 12, 8, 9, 8, 16, 28].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, 'Rack Data');
    const wsT = XLSX.utils.aoa_to_sheet([['Valid Types (use in Type column)'], ...ALL_TYPES.map(t => [t])]);
    wsT['!cols'] = [{ wch: 28 }];
    XLSX.utils.book_append_sheet(wb, wsT, 'Valid Types');
    XLSX.writeFile(wb, 'rack-builder-template.xlsx');
    closeMenu();
  }

  // ── JSON Export ─────────────────────────────────────────────────────────────
  function exportJsonCurrent() {
    if (!activeRack) return;
    downloadJsonFile({ racks: [activeRack] }, `${activeRack.rackName || 'rack'}.json`);
    closeMenu();
  }
  function exportJsonAll() {
    downloadJsonFile({ racks }, 'all-racks.json');
    closeMenu();
  }

  // ── Excel Export ────────────────────────────────────────────────────────────
  function exportExcel() {
    const rows = racks.flatMap(rack =>
      (rack.items || []).map(item => ({
        'Rack Name':   rack.rackName   || '',
        'Rack Number': rack.rackNumber || '',
        'Max RU':      rack.maxRU      || 42,
        'Start RU':    item.startRU,
        'End RU':      item.endRU,
        'Type':        item.type       || 'generic',
        'Label':       item.label      || '',
      }))
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [18, 12, 8, 9, 8, 16, 28].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rack Data');
    XLSX.writeFile(wb, 'all-racks.xlsx');
    closeMenu();
  }

  // ── PNG Export — current rack (both views) ────────────────────────────────
  async function exportPngCurrent() {
    if (!activeRack) return;
    closeMenu();
    setExporting(true);
    try {
      await onExportCurrentPng();
    } catch (e) { alert(`Export failed: ${e.message}`); }
    setExporting(false);
  }

  // ── PNG Export — all racks as ZIP (both views) ─────────────────────────────
  async function exportPngAll() {
    closeMenu();
    setExporting(true);
    try {
      await onExportAllPng();
    } catch (e) { alert(`ZIP export failed: ${e.message}`); }
    setExporting(false);
  }

  const hasRacks  = racks?.length > 0;
  const hasActive = !!activeRack;

  return (
    <>
      {/* ── File button + dropdown ─── */}
      <div className="file-menu" ref={menuRef}>
        <button
          className={`btn btn-ghost btn-sm file-menu-btn${open ? ' file-menu-btn--open' : ''}`}
          onClick={() => setOpen(o => !o)}
        >
          <IconFolder />
          File
          <IconChevron />
        </button>

        {open && (
          <div className="file-menu-dropdown" role="menu">
            {/* ── Import ── */}
            <div className="fmd-section-label">Import</div>
            <button className="fmd-item" role="menuitem" onClick={openJsonModal}>
              Paste JSON…
            </button>
            <button className="fmd-item" role="menuitem" onClick={() => jsonFileRef.current.click()}>
              Open JSON File
            </button>
            <button className="fmd-item" role="menuitem" onClick={() => spreadsheetRef.current.click()}>
              Import Excel / CSV
            </button>
            <button className="fmd-item" role="menuitem" onClick={downloadTemplate}>
              Download Excel Template
            </button>

            <div className="fmd-divider" />

            {/* ── Export Data ── */}
            <div className="fmd-section-label">Export — Data</div>
            <button className="fmd-item" role="menuitem" disabled={!hasActive} onClick={exportJsonCurrent}>
              Export JSON — Current Rack
            </button>
            <button className="fmd-item" role="menuitem" disabled={!hasRacks} onClick={exportJsonAll}>
              Export JSON — All Racks
            </button>
            <button className="fmd-item" role="menuitem" disabled={!hasRacks} onClick={exportExcel}>
              Export Excel — All Racks
            </button>

            <div className="fmd-divider" />

            {/* ── Export Diagram ── */}
            <div className="fmd-section-label">Export — Diagram</div>
            <button className="fmd-item" role="menuitem" disabled={!hasActive || exporting} onClick={exportPngCurrent}>
              Export PNG — Current Rack
            </button>
            <button className="fmd-item" role="menuitem" disabled={!hasRacks || exporting} onClick={exportPngAll}>
              Export PNG — All Racks (.zip)
            </button>
            <button className="fmd-item" role="menuitem" disabled={!hasActive} onClick={() => { window.print(); closeMenu(); }}>
              Print
            </button>
          </div>
        )}

        {/* Hidden file inputs */}
        <input ref={jsonFileRef}    type="file" accept=".json"              style={{ display: 'none' }} onChange={handleJsonFile}   />
        <input ref={spreadsheetRef} type="file" accept=".xlsx,.xls,.xlsm,.csv" style={{ display: 'none' }} onChange={handleSpreadsheet} />
      </div>

      {/* ── ZIP export progress overlay ── */}
      {exporting && (
        <div className="export-progress-overlay">
          <div className="export-progress-box">
            <svg className="export-spinner-svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#e2e8f0" strokeWidth="3"/>
              <path d="M12 2a10 10 0 010 20" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            Exporting all racks…
          </div>
        </div>
      )}

      {/* ── JSON Import Modal ── */}
      {jsonModal && (
        <div
          className="modal-overlay"
          onMouseDown={e => { if (e.target === e.currentTarget) closeJsonModal(); }}
          role="dialog"
          aria-modal="true"
          aria-label="Import JSON"
        >
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Import JSON</span>
              <button className="modal-close" onClick={closeJsonModal} aria-label="Close">✕</button>
            </div>
            <div className="modal-body">
              <textarea
                className="json-textarea"
                value={jsonText}
                onChange={e => { setJsonText(e.target.value); setJsonError(''); }}
                placeholder={'Paste rack JSON here…\n\n{\n  "racks": [\n    {\n      "rackName": "My Rack",\n      "maxRU": 42,\n      "items": [ ... ]\n    }\n  ]\n}'}
                spellCheck={false}
                autoFocus
              />
              {jsonError && <div className="inline-error">{jsonError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={handleJsonRender}>Render JSON</button>
              <button className="btn btn-outline" onClick={() => jsonFileRef.current.click()}>Open File</button>
              <button className="btn btn-ghost"   onClick={closeJsonModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
