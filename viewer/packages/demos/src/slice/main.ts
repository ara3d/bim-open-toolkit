// The page entry: find the canvas, mount the slice, and publish what a browser test reads back.

import { mountSlice, type SliceReport } from './mount.js';

declare global {
  interface Window {
    // The counts the page reports, refreshed about four times a second.
    slice?: SliceReport;
    // True once the first frame has been drawn and the model is bound.
    sliceReady?: boolean;
    // The current frame as PNG bytes; the number is how many bytes, zero when it could not encode.
    sliceCapture?: () => Promise<number>;
    // Set instead of `sliceReady` when mounting failed, so a test never waits for a page that died.
    sliceError?: string;
  }
}

const canvas = document.getElementById('viewport');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('slice.html has no canvas with id "viewport"');

try {
  const dispose = mountSlice(canvas, {
    onReport: (report) => {
      window.slice = report;
    },
    onReady: (page) => {
      window.sliceCapture = page.capture;
      window.sliceReady = true;
    },
  });
  window.addEventListener('pagehide', dispose, { once: true });
} catch (cause) {
  const message = cause instanceof Error ? cause.message : String(cause);
  window.sliceError = message;
  const note = document.createElement('p');
  note.className = 'slice-status';
  note.textContent = `The slice could not start: ${message}`;
  (canvas.parentElement ?? document.body).append(note);
  console.error(message);
}
