import { useState, useRef } from 'react';
import { readFileAsText } from '../utils/exportUtils';
import { parseJsonInput } from '../utils/rackUtils';

export default function JsonImportCard({ onImport }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  function handleRender() {
    const { racks, errors } = parseJsonInput(text);
    if (errors.length > 0) {
      setError(errors.join('\n'));
      return;
    }
    setError('');
    onImport(racks);
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const content = await readFileAsText(file);
      setText(content);
      const { racks, errors } = parseJsonInput(content);
      if (errors.length > 0) { setError(errors.join('\n')); return; }
      setError('');
      onImport(racks);
    } catch (err) {
      setError(`Failed to read file: ${err.message}`);
    }
    e.target.value = '';
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon">{ }</span>
        <h3 className="card-title">JSON Import</h3>
      </div>
      <textarea
        className="json-textarea"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={'Paste rack JSON here…\n\n{\n  "racks": [ ... ]\n}'}
        spellCheck={false}
      />
      {error && <div className="inline-error">{error}</div>}
      <div className="card-actions">
        <button className="btn btn-primary" onClick={handleRender}>Render JSON</button>
        <button className="btn btn-outline" onClick={() => fileRef.current.click()}>
          Open JSON File
        </button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFile} />
      </div>
    </div>
  );
}
