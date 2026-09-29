// The page `snowdon-preview.perf.ts` opens: fetches a model over the network, loads it through
// `loadWithPreview`, and reports how many milliseconds passed between having the bytes in hand and
// the frame it was asked to stop at.
//
// Bytes in hand is measured here, by this page's own `fetch`, rather than inside `loadModel`: that
// keeps the zero point exact and lets the perf test hand `loadWithPreview` an `ArrayBuffer` it
// already holds, instead of asking the format layer to fetch a second time.
//
// The perf test screenshots the canvas itself through Playwright, not through `viewer.capture`'s
// `canvas.toBlob`: a `?stopAtPreview=1` run reports as soon as the preview frame is submitted, so a
// screenshot taken right after `perfReady` is the preview frame; a plain run reports after the full
// frame, so the same screenshot taken then is the full frame. Two runs, two frames, no code path here
// that a headless canvas readback could stall on.

import type { BoxPreview } from '@bim-open-toolkit/formats';
import { createViewer } from '../../src/create-viewer.js';
import { loadWithPreview } from '../../src/load-with-preview.js';

declare global {
  interface Window {
    // What the page reports back, once it has reached the frame it was asked to stop at.
    perfResult?: {
      readonly ok: boolean;
      readonly error: string | undefined;
      readonly previewMs: number | undefined;
      readonly fullMs: number | undefined;
      readonly count: number | undefined;
      readonly oversized: number | undefined;
    };
    perfReady?: boolean;
  }
}

const fail = (error: string): void => {
  window.perfResult = { ok: false, error, previewMs: undefined, fullMs: undefined, count: undefined, oversized: undefined };
  window.perfReady = true;
};

async function main(): Promise<void> {
  const canvas = document.getElementById('viewport');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('the page has no canvas with id "viewport"');
  const params = new URLSearchParams(location.search);
  const modelUrl = params.get('model');
  if (modelUrl === null) throw new Error('the page was given no "model" query parameter');
  const stopAtPreview = params.get('stopAtPreview') === '1';

  const viewer = createViewer(canvas);

  const response = await fetch(modelUrl);
  if (!response.ok) throw new Error(`fetching "${modelUrl}" failed with status ${String(response.status)}`);
  const buffer = await response.arrayBuffer();
  const bytesInHandMs = performance.now();

  let previewMs: number | undefined;
  let count = 0;
  let oversized = 0;
  let reportedAtPreview = false;

  const result = await loadWithPreview(viewer, buffer, {
    onPreview: (preview: BoxPreview) => {
      previewMs = performance.now() - bytesInHandMs;
      count = preview.count;
      oversized = preview.oversized;
      if (stopAtPreview) {
        reportedAtPreview = true;
        window.perfResult = { ok: true, error: undefined, previewMs, fullMs: undefined, count, oversized };
        window.perfReady = true;
      }
    },
  });

  if (reportedAtPreview) return;
  if (!result.ok) {
    fail(result.diagnostics.map((one) => one.message).join('; '));
    return;
  }

  const shown = viewer.show(result.value);
  if (!shown.ok) throw new Error(shown.diagnostics.map((one) => one.message).join('; '));
  viewer.views.get('main')?.renderNow();
  const fullMs = performance.now() - bytesInHandMs;

  window.perfResult = { ok: true, error: undefined, previewMs, fullMs, count, oversized };
  window.perfReady = true;
}

main().catch((cause) => {
  fail(cause instanceof Error ? cause.message : String(cause));
});
