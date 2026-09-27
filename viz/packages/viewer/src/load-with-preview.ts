// `loadWithPreview`: the one call a host makes instead of `loadModel` to get coarse-then-full loading
// (see the plan's "How does refinement swap in without a flash"). It draws the source's box preview
// in the viewer, lets the browser present it, and only then lets `loadModel`'s parse hold the thread.
//
// It never calls `viewer.show`: that stays the caller's job, exactly as with `loadModel`, so a host
// that wants to transform the model before showing it still can.

import type { Result } from '@bim-open-toolkit/model';
import { loadModel, type BoxPreview, type LoadedModel, type LoadOptions, type ModelSource } from '@bim-open-toolkit/formats';
import type { Viewer } from './create-viewer.js';

export type LoadWithPreviewOptions = Omit<LoadOptions, 'onPreview'> & {
  /** Called after the preview frame was submitted and before the browser is given a frame to present it. */
  readonly onPreview?: (preview: BoxPreview) => void;
  /** Frame the preview. Default true. */
  readonly fit?: boolean;
  /** Resolves once the browser has presented a frame. Default: one animation frame, then one task. */
  readonly nextFrame?: () => Promise<void>;
};

// One animation frame (so the browser has a chance to paint), then one task (so a paint that a
// browser schedules right after the animation-frame callback, rather than inside it, still lands
// before the parse resumes). In a host with no `requestAnimationFrame` (a test, a worker), the frame
// step falls back to a task too.
const defaultNextFrame = (): Promise<void> =>
  new Promise<void>((resolve) => {
    const raf: (callback: () => void) => void =
      typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (callback) => setTimeout(callback, 0);
    raf(() => setTimeout(resolve, 0));
  });

/**
 * `loadModel`, drawing the source's box preview in `viewer` first.
 *
 * On success the preview stays in the scene until the caller's `viewer.show` replaces it; on failure
 * or cancellation the preview is disposed here, because there is no `show` coming to remove it.
 */
export function loadWithPreview(
  viewer: Viewer,
  source: ModelSource,
  options: LoadWithPreviewOptions = {},
): Promise<Result<LoadedModel>> {
  const { onPreview, fit, nextFrame, ...loadOptions } = options;
  let handle: { readonly dispose: () => void } | undefined;

  return loadModel(source, {
    ...loadOptions,
    onPreview: async (preview) => {
      handle = viewer.preview(preview, { fit: fit ?? true });
      onPreview?.(preview);
      await (nextFrame ?? defaultNextFrame)();
    },
  }).then((result) => {
    if (!result.ok) handle?.dispose();
    return result;
  });
}
