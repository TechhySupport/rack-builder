import { sampleData } from '../data/sampleRacks';

const SAMPLES = [
  { label: 'EMG-GL + MDF-GL (default)', data: sampleData },
  {
    label: 'Single Rack Demo',
    data: {
      racks: [
        {
          rackName: 'DEMO-01',
          rackNumber: '1',
          maxRU: 12,
          items: [
            { startRU: 12, endRU: 12, type: 'fibre',         label: 'Fibre Panel' },
            { startRU: 11, endRU: 11, type: 'patch_panel',   label: 'Patch Panel 24-Port' },
            { startRU: 10, endRU: 10, type: 'cable_manager', label: 'Cable Manager' },
            { startRU:  9, endRU:  9, type: 'switch',        label: 'Cisco C9200-48P' },
            { startRU:  8, endRU:  8, type: 'switch',        label: 'Cisco C9200-24P' },
            { startRU:  7, endRU:  6, type: 'firewall',      label: 'FortiGate 200F HA Pair' },
            { startRU:  5, endRU:  5, type: 'server',        label: 'Dell PowerEdge R650' },
            { startRU:  4, endRU:  4, type: 'ups',           label: 'APC Smart-UPS 1500' },
            { startRU:  3, endRU:  1, type: 'empty',         label: 'Empty' },
          ],
        },
      ],
    },
  },
];

export default function SampleSelector({ onLoad }) {
  function handleChange(e) {
    const idx = Number(e.target.value);
    if (!isNaN(idx) && SAMPLES[idx]) {
      onLoad(SAMPLES[idx].data.racks);
    }
  }

  return (
    <div className="sample-selector">
      <label className="sample-label" htmlFor="sample-select">Sample:</label>
      <select id="sample-select" className="sample-select" defaultValue="" onChange={handleChange}>
        <option value="" disabled>— choose a sample —</option>
        {SAMPLES.map((s, i) => (
          <option key={i} value={i}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}
