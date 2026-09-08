// `CaptureTarget` and `GpuFrameTimer`: the drawing buffer, and what the GPU can say about itself.

import type { Viewer } from '@ara3d/viewer-core';
import { noGpuTimer, type CaptureTarget, type GpuFrameTimer } from '@bim-open-toolkit/render';

// The canvas as something `captureImage` can size, draw and encode. Sizes are device pixels, so the
// ratio is one: the capture is exactly as big as it was asked for, whatever the display does.
// Putting the original size back is `captureImage`'s job, and it does it even when encoding fails.
export const captureTarget = (viewer: Viewer, canvas: HTMLCanvasElement): CaptureTarget => ({
  size: () => ({ width: canvas.width, height: canvas.height }),
  resize: (width, height) => {
    viewer.resize(width, height, 1);
  },
  renderFrame: () => {
    viewer.renderFrame();
  },
  encode: (format) =>
    new Promise<Uint8Array>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob === null) {
          reject(new Error('The canvas produced no image'));
          return;
        }
        blob
          .arrayBuffer()
          .then((bytes) => {
            resolve(new Uint8Array(bytes));
          })
          .catch((cause: unknown) => {
            reject(cause instanceof Error ? cause : new Error(String(cause)));
          });
      }, format);
    }),
});

// GPU timing, or the reason there is none.
//
// `EXT_disjoint_timer_query_webgl2` reaches TypeScript through `getExtension` as `any`, and this
// repository allows none, so its presence is reported and its readings are not taken. A HUD shows
// the reason. Substituting a CPU number would be an answer to a different question.
export const gpuFrameTimer = (canvas: HTMLCanvasElement): GpuFrameTimer => {
  const context = canvas.getContext('webgl2');
  if (context === null) return noGpuTimer('the canvas has no WebGL2 context');
  const extensions = context.getSupportedExtensions() ?? [];
  return noGpuTimer(
    extensions.includes('EXT_disjoint_timer_query_webgl2')
      ? 'EXT_disjoint_timer_query_webgl2 is present, but nothing here reads it: its bindings are untyped'
      : 'EXT_disjoint_timer_query_webgl2 is not present',
  );
};
