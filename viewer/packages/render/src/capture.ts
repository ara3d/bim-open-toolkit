// Capture: an image of the view, behind an adapter.
//
// Everything specific to a renderer is in `CaptureTarget`: read the size, change it, draw a frame,
// encode what was drawn. Capture itself is the ordering and the honesty around it - render
// immediately before encoding, because a canvas that does not preserve its drawing buffer has
// nothing to read otherwise; put the size back afterwards, so making a thumbnail from a saved view
// does not disturb what the user is looking at; and report a failure as a diagnostic rather than
// returning an image nobody can explain.

import { diagnostic, failure, success, type Result } from '@bim-open-toolkit/model';

// What an image is encoded as. PNG only for now: it is lossless, which a report needs.
export type CaptureFormat = 'image/png';

// PNG.
export const pngFormat: CaptureFormat = 'image/png';

// What a renderer has to provide.
export type CaptureTarget = {
  // The drawing buffer size now, in pixels.
  readonly size: () => { readonly width: number; readonly height: number };
  // Changes the drawing buffer size. Capture puts the original size back.
  readonly resize: (width: number, height: number) => void;
  // Draws one frame synchronously.
  readonly renderFrame: () => void;
  // Encodes what was last drawn.
  readonly encode: (format: CaptureFormat) => Promise<Uint8Array>;
};

// What to capture. Leaving the size out captures at the size the view already has.
export type CaptureOptions = {
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly format?: CaptureFormat | undefined;
};

// An encoded image and the size it was drawn at.
export type CaptureImage = {
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly format: CaptureFormat;
};

const isSize = (value: number): boolean => Number.isFinite(value) && value >= 1 && value <= 16_384;

// The size to draw at, keeping the aspect ratio when only one dimension is asked for.
export const captureSize = (
  current: { readonly width: number; readonly height: number },
  options: CaptureOptions,
): Result<{ readonly width: number; readonly height: number }> => {
  if (!isSize(current.width) || !isSize(current.height))
    return failure([
      diagnostic('bad-view-size', `The view is ${current.width} by ${current.height} pixels and cannot be captured`, ['size']),
    ]);
  const aspect = current.width / current.height;
  const width = options.width ?? (options.height === undefined ? current.width : options.height * aspect);
  const height = options.height ?? (options.width === undefined ? current.height : options.width / aspect);
  const rounded = { width: Math.round(width), height: Math.round(height) };
  if (!isSize(rounded.width) || !isSize(rounded.height))
    return failure([
      diagnostic('bad-capture-size', `A capture of ${rounded.width} by ${rounded.height} pixels is not a picture`, ['width']),
    ]);
  return success(rounded);
};

// The size a thumbnail of `maxEdge` pixels would be for a view of this shape.
export const thumbnailSize = (
  current: { readonly width: number; readonly height: number },
  maxEdge: number,
): Result<{ readonly width: number; readonly height: number }> =>
  current.width >= current.height
    ? captureSize(current, { width: maxEdge })
    : captureSize(current, { height: maxEdge });

// Draws the view and encodes it.
//
// A requested size is applied, drawn at and then put back, so an active view returns to exactly the
// size it had even when encoding fails.
export const captureImage = async (
  target: CaptureTarget,
  options: CaptureOptions = {},
): Promise<Result<CaptureImage>> => {
  const current = target.size();
  const wanted = captureSize(current, options);
  if (!wanted.ok) return failure(wanted.diagnostics);
  const { width, height } = wanted.value;
  const format = options.format ?? pngFormat;
  const resized = width !== current.width || height !== current.height;
  try {
    if (resized) target.resize(width, height);
    try {
      target.renderFrame();
    } catch (cause) {
      return failure([
        diagnostic('render-failed', `Could not draw the frame to capture: ${describe(cause)}`, ['renderFrame']),
      ]);
    }
    const bytes = await target.encode(format).catch((cause: unknown) => cause);
    if (!(bytes instanceof Uint8Array))
      return failure([diagnostic('encode-failed', `Could not encode the image: ${describe(bytes)}`, ['encode'])]);
    if (bytes.length === 0)
      return failure([
        diagnostic('empty-image', 'Encoding produced no bytes, which usually means the drawing buffer was already lost', ['encode']),
      ]);
    return success({ bytes, width, height, format });
  } finally {
    if (resized) target.resize(current.width, current.height);
  }
};

const describe = (cause: unknown): string =>
  cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : 'no reason given';
