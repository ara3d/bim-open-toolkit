// The page entry: find the canvas and the panel, mount the demo, and publish what a browser test
// reads back and drives.

import type { Result } from '@bim-open-toolkit/model';
import type { AmbientOcclusionSettings } from '@bim-open-toolkit/render';
import type { ControlKey } from './controls.js';
import type { FixtureName } from './fixtures.js';
import { mountDemo, type DemoReport } from './mount.js';
import type { LuminanceStatistics } from './pixels.js';

declare global {
  interface Window {
    // The counts the page reports, refreshed about four times a second.
    ambientOcclusion?: DemoReport;
    // True once the first frame has been drawn and the model is bound.
    ambientOcclusionReady?: boolean;
    // Set instead of `ambientOcclusionReady` when mounting failed, so a test never waits for a
    // page that died.
    ambientOcclusionError?: string;
    // Shows these control values and applies them.
    ambientOcclusionApply?: (patch: Partial<Readonly<Record<ControlKey, string>>>) => Result<AmbientOcclusionSettings>;
    // Draws one frame and reads back its luminance.
    ambientOcclusionMeasure?: () => LuminanceStatistics;
    // Opens another fixture by name.
    ambientOcclusionOpen?: (name: string) => Result<FixtureName>;
  }
}

const canvas = document.getElementById('viewport');
const panel = document.getElementById('controls');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('ambient-occlusion.html has no canvas with id "viewport"');
if (panel === null) throw new Error('ambient-occlusion.html has no element with id "controls"');

try {
  const dispose = mountDemo(canvas, panel, {
    onReport: (report) => {
      window.ambientOcclusion = report;
    },
    onReady: (page) => {
      window.ambientOcclusionApply = page.apply;
      window.ambientOcclusionMeasure = page.measure;
      window.ambientOcclusionOpen = page.open;
      window.ambientOcclusionReady = true;
    },
  });
  window.addEventListener('pagehide', dispose, { once: true });
} catch (cause) {
  const message = cause instanceof Error ? cause.message : String(cause);
  window.ambientOcclusionError = message;
  const note = document.createElement('p');
  note.className = 'ao-status';
  note.textContent = `The demo could not start: ${message}`;
  (canvas.parentElement ?? document.body).append(note);
  console.error(message);
}
