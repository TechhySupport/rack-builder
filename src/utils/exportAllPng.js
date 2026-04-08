import { toPng } from 'html-to-image';
import JSZip from 'jszip';

/**
 * Render every rack's already-mounted DOM element (from the hidden off-screen
 * container in App.jsx) to PNG, bundle them all in a ZIP and download it.
 *
 * @param {Array}       racks       - the racks state array (for filenames)
 * @param {HTMLElement} containerEl - the hidden off-screen container whose
 *                                    children are <RackElevation> wrappers
 */
export async function exportAllRacksAsZip(racks, containerEl, mode = 'diagram') {
  if (!racks || racks.length === 0) throw new Error('No racks to export.');
  if (!containerEl) throw new Error('Export container not ready.');

  const zip   = new JSZip();
  const nodes = Array.from(containerEl.children);

  for (let i = 0; i < racks.length; i++) {
    const el = nodes[i];
    if (!el) continue;

    const dataUrl = await toPng(el, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      style: { fontFamily: 'system-ui, sans-serif' },
    });

    const base64  = dataUrl.split(',')[1];
    const rack    = racks[i];
    const safe    = (rack.rackName || `rack_${i + 1}`).replace(/[^a-z0-9-_]/gi, '_');
    const suffix  = rack.rackNumber ? `-${rack.rackNumber}` : '';
    zip.file(`${safe}${suffix}.png`, base64, { base64: true });
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = mode === 'simple' ? 'rack-elevations-simple.zip' : 'rack-elevations.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
