import { captureCanvas, CaptureError } from '../../src/capture.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const captureDemo: FeatureDemo = {
  id: 'capture', title: 'Capture a PNG', description: 'Render and capture the current Snowdon canvas as a PNG at its drawing-buffer resolution. DOM controls and labels are excluded.',
  source: 'examples/features/capture.ts', tests: 'test/capture.test.ts',
  mount(context) {
    let url: string | undefined, disposed = false;
    const thumbnail = document.createElement('img'); thumbnail.alt = 'Latest viewer capture'; thumbnail.style.maxWidth = '100%'; thumbnail.hidden = true;
    context.panel.append(thumbnail);
    const capture = context.button('Capture PNG', async () => {
      capture.disabled = true;
      try {
        const blob = await captureCanvas(context.canvas, () => context.viewer.renderFrame());
        if (disposed) return;
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(blob); thumbnail.src = url; thumbnail.hidden = false; download.disabled = false;
        context.status(`Captured ${context.canvas.width} × ${context.canvas.height} PNG (${blob.size.toLocaleString()} bytes). DOM overlays are excluded.`);
      } catch (error) {
        if (!disposed) context.status(error instanceof CaptureError ? `${error.code}: ${error.message}` : String(error));
      } finally { if (!disposed) capture.disabled = false; }
    });
    const download = context.button('Download latest PNG', () => {
      if (!url) return;
      const link = document.createElement('a'); link.href = url; link.download = 'snowdon-view.png'; link.click();
    });
    download.disabled = true;
    context.status('Frame rendering happens immediately before PNG encoding. Resize the viewer to change capture resolution.');
    return () => { disposed = true; if (url) URL.revokeObjectURL(url); thumbnail.remove(); };
  },
};
