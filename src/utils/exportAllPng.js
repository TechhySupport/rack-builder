import { toPng } from 'html-to-image';
import JSZip from 'jszip';

// Sanitise a rack name for use as a filename
function safeName(rack, i) {
  return (rack.rackName || `rack_${i + 1}`)
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/gi, '');
}

async function capturePng(el) {
  return toPng(el, {
    backgroundColor: '#ffffff',
    pixelRatio: 2,
    style: { fontFamily: 'system-ui, sans-serif' },
  });
}

/**
 * Export all racks as a ZIP containing both _diagram and _simple PNGs per rack.
 *
 * @param {Array}       racks            - the racks state array (for filenames)
 * @param {HTMLElement} diagramContainer - hidden container with <RackElevation> nodes
 * @param {HTMLElement} simpleContainer  - hidden container with <RackFrame> nodes
 */
export async function exportAllRacksAsZip(racks, diagramContainer, simpleContainer) {
  if (!racks || racks.length === 0) throw new Error('No racks to export.');
  if (!diagramContainer || !simpleContainer) throw new Error('Export containers not ready.');

  const zip           = new JSZip();
  const diagramNodes  = Array.from(diagramContainer.children);
  const simpleNodes   = Array.from(simpleContainer.children);

  for (let i = 0; i < racks.length; i++) {
    const rack  = racks[i];
    const safe  = safeName(rack, i);

    const diagramEl = diagramNodes[i];
    if (diagramEl) {
      const url    = await capturePng(diagramEl);
      zip.file(`${safe}_diagram.png`, url.split(',')[1], { base64: true });
    }

    const simpleEl = simpleNodes[i];
    if (simpleEl) {
      const url    = await capturePng(simpleEl);
      zip.file(`${safe}_simple.png`, url.split(',')[1], { base64: true });
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'rack-elevations.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export both views (diagram + simple) for a single rack as two PNG downloads.
 *
 * @param {HTMLElement} diagramEl - the diagram DOM element to capture
 * @param {HTMLElement} simpleEl  - the simple DOM element to capture
 * @param {string}      rackName  - used as the filename base
 */
export async function exportCurrentRackBothViews(diagramEl, simpleEl, rackName) {
  const safe = (rackName || 'rack').replace(/\s+/g, '_').replace(/[^a-z0-9_-]/gi, '');

  if (diagramEl) {
    const url = await capturePng(diagramEl);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `${safe}_diagram.png`;
    a.click();
  }

  if (simpleEl) {
    // Small delay so browsers don't block the second download
    await new Promise(r => setTimeout(r, 120));
    const url = await capturePng(simpleEl);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `${safe}_simple.png`;
    a.click();
  }
}
