import { useRef } from 'react';
import Papa from 'papaparse';
import { parseCsvRows } from '../utils/rackUtils';
import { readFileAsText } from '../utils/exportUtils';

export default function FileImportCard({ onImport }) {
  const csvRef = useRef(null);

  async function handleCsv(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      const { racks, errors } = parseCsvRows(result.data);
      if (errors.length > 0) {
        alert('CSV import warnings:\n' + errors.join('\n'));
      }
      if (racks.length > 0) onImport(racks, errors);
      else alert('No valid racks found in CSV.');
    } catch (err) {
      alert(`CSV read error: ${err.message}`);
    }
    e.target.value = '';
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Spreadsheet / CSV Import</h3>
      </div>
      <p className="card-desc">
        Upload a CSV file with columns: <strong>Rack Name</strong>, <strong>Rack Number</strong>,{' '}
        <strong>Max RU</strong>, <strong>Start RU</strong>, <strong>End RU</strong>,{' '}
        <strong>Type</strong>, <strong>Label</strong>.
      </p>
      <div className="card-actions">
        <button className="btn btn-outline" onClick={() => csvRef.current.click()}>
          Upload CSV
        </button>
        <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsv} />
      </div>
      <div className="asset-hint">
        <strong>Tip:</strong> You can replace placeholder icons by dropping your own SVG files in{' '}
        <code>/public/assets/</code>. Filenames must match:{' '}
        <code>switch.svg</code>, <code>server.svg</code>, <code>firewall.svg</code>, etc.
      </div>
    </div>
  );
}
