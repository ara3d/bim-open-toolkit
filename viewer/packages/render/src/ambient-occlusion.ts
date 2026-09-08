// Ambient occlusion: the contact shadow where surfaces meet, which is what makes a flat-lit
// building readable. Settings plus the seam a renderer implements, and a pure estimator over a
// height field that states in code what the screen-space pass approximates on the GPU.
//
// The pass is screen-space: it reads the depth and normal of every pixel and asks, in a few
// directions, how much the neighbouring surface rises towards the viewer within a radius. That is
// an estimate of how much sky the point sees, so it darkens corners, the foot of a wall and the
// gap under a door, and leaves open floor alone. It is not a shadow from a light and it never
// enters the model: nothing here changes a row, a colour or a bound.
//
// `AmbientOcclusionTarget` is the seam. Everything above it is tested in Node.

import {
  boundsSize,
  diagnostic,
  disposable,
  failure,
  success,
  type Bounds,
  type Disposable,
  type Result,
} from '@bim-open-toolkit/model';

// What the pass shows: the shaded picture darkened where it is enclosed, or the occlusion term on
// its own, white where a surface is open and black where it is enclosed, which is how the effect
// of a setting is judged.
export type AmbientOcclusionOutput = 'shaded' | 'occlusion';

// Everything the pass is told. Every field is required, so a pass is a function of this record.
export type AmbientOcclusionSettings = {
  readonly enabled: boolean;
  // How far, in world units, a surface looks for what encloses it. Zero picks a radius from the
  // model's size, so one setting is right for a door handle and for a city block.
  readonly radius: number;
  // How dark full enclosure gets: 0 leaves the picture alone, 1 takes it to black.
  readonly intensity: number;
  // Directions sampled per pixel. More is smoother and slower.
  readonly samples: number;
  // The occlusion buffer's size as a fraction of the drawing buffer's, between a quarter and one.
  readonly resolutionScale: number;
  readonly output: AmbientOcclusionOutput;
};

// Contact shadow on, at a radius chosen from the model, strong enough to read.
export const defaultAmbientOcclusion: AmbientOcclusionSettings = {
  enabled: true,
  radius: 0,
  intensity: 0.8,
  samples: 16,
  resolutionScale: 1,
  output: 'shaded',
};

// The most directions a pass is asked for. A GPU pass unrolls its sampling loop, so this is the
// point past which compile time and frame time both stop being worth it.
export const mostSamples = 64;

// The smallest occlusion buffer, as a fraction of the drawing buffer.
export const leastResolutionScale = 0.25;

const inRange = (value: number, least: number, most: number): boolean =>
  Number.isFinite(value) && value >= least && value <= most;

// Checks settings before a renderer is asked for a pass, so a bad value is a diagnostic rather
// than a black or an unchanged picture.
export const checkAmbientOcclusion = (
  settings: AmbientOcclusionSettings,
): Result<AmbientOcclusionSettings> => {
  if (!inRange(settings.radius, 0, Number.MAX_VALUE))
    return failure([diagnostic('bad-radius', 'The radius must be zero or a positive distance', ['radius'])]);
  if (!inRange(settings.intensity, 0, 1))
    return failure([diagnostic('bad-intensity', 'The intensity must be between 0 and 1', ['intensity'])]);
  if (!Number.isInteger(settings.samples) || settings.samples < 1 || settings.samples > mostSamples)
    return failure([
      diagnostic('bad-samples', `The sample count must be a whole number from 1 to ${mostSamples}`, ['samples']),
    ]);
  if (!inRange(settings.resolutionScale, leastResolutionScale, 1))
    return failure([
      diagnostic(
        'bad-resolution',
        `The resolution scale must be between ${leastResolutionScale} and 1`,
        ['resolutionScale'],
      ),
    ]);
  if (settings.output !== 'shaded' && settings.output !== 'occlusion')
    return failure([diagnostic('bad-output', 'The output must be shaded or occlusion', ['output'])]);
  return success(settings);
};

// The radius to use for a model of these bounds when the settings leave it to be chosen: two per
// cent of the widest extent, which reaches across a door reveal on a building and a fillet on a
// handle. One unit for an empty or degenerate model, the same fallback the grid uses.
export const occlusionRadiusFor = (bounds: Bounds): number => {
  const size = boundsSize(bounds);
  if (size === undefined) return 1;
  const widest = Math.max(size[0] ?? 0, size[1] ?? 0, size[2] ?? 0);
  return Number.isFinite(widest) && widest > 0 ? widest * 0.02 : 1;
};

// A size in pixels.
export type PixelSize = { readonly width: number; readonly height: number };

// The size of the occlusion buffer for a drawing buffer of this size, never smaller than one
// pixel on a side. Takes the settings or the resolved pass, whichever a renderer holds.
export const occlusionBufferSize = (
  scaled: { readonly resolutionScale: number },
  view: PixelSize,
): PixelSize => ({
  width: Math.max(1, Math.round(view.width * scaled.resolutionScale)),
  height: Math.max(1, Math.round(view.height * scaled.resolutionScale)),
});

// Everything a renderer needs to set the pass up, with the radius resolved so it has nothing left
// to interpret. The buffer size is not here because it follows the drawing buffer: a renderer asks
// `occlusionBufferSize` on every resize.
export type AmbientOcclusionPass = {
  readonly radius: number;
  readonly intensity: number;
  readonly samples: number;
  readonly resolutionScale: number;
  readonly output: AmbientOcclusionOutput;
};

// The pass for a model of these bounds, or undefined when the settings turn it off.
export const ambientOcclusionPass = (
  settings: AmbientOcclusionSettings,
  bounds: Bounds,
): Result<AmbientOcclusionPass | undefined> => {
  const checked = checkAmbientOcclusion(settings);
  if (!checked.ok) return failure(checked.diagnostics);
  if (!settings.enabled) return success(undefined);
  return success({
    radius: settings.radius > 0 ? settings.radius : occlusionRadiusFor(bounds),
    intensity: settings.intensity,
    samples: settings.samples,
    resolutionScale: settings.resolutionScale,
    output: settings.output,
  });
};

// What a renderer has to provide. Undefined takes the pass out and draws the plain picture.
export type AmbientOcclusionTarget = {
  readonly setAmbientOcclusion: (pass: AmbientOcclusionPass | undefined) => void;
};

// Puts the pass in place and hands back the way to take it away again. Disposing removes it,
// which is what returns the plain picture.
export const applyAmbientOcclusion = (
  target: AmbientOcclusionTarget,
  settings: AmbientOcclusionSettings,
  bounds: Bounds,
): Result<Disposable> => {
  const pass = ambientOcclusionPass(settings, bounds);
  if (!pass.ok) return failure(pass.diagnostics);
  target.setAmbientOcclusion(pass.value);
  return success(disposable(() => target.setAmbientOcclusion(undefined)));
};

// A surface seen from above: `heights[y * width + x]` is how far the surface at that pixel rises
// towards the viewer, in the same units as `spacing`, the distance between neighbouring pixels.
// A depth buffer is one of these with its sign turned round.
export type HeightField = {
  readonly width: number;
  readonly height: number;
  readonly heights: Float32Array;
  readonly spacing: number;
};

// How much of the sky each pixel of a height field sees, from 1 for open ground to 0 for fully
// enclosed, found the way the screen-space pass finds it: in `samples` directions, march out to
// `radius` in `steps` and keep the steepest rise; a horizon at angle h hides `sin(h)` of the
// cosine-weighted hemisphere. Beyond the radius, and beyond the edge of the field, nothing
// occludes, which is also what a screen-space pass assumes.
//
// This is the reference the GPU pass is judged against, not something a frame calls: it is
// `width * height * samples * steps` reads.
//
// Sample offsets are rounded away from the pixel, not with `Math.round`, whose ties go towards
// positive infinity and would make the two sides of a wall differ.
export const heightFieldVisibility = (
  field: HeightField,
  radius: number,
  samples: number,
  steps = 4,
): Float32Array => {
  if (!(radius > 0)) throw new Error(`The radius must be positive, got ${radius}`);
  if (!Number.isInteger(samples) || samples < 1) throw new Error(`The sample count must be a positive integer, got ${samples}`);
  if (!Number.isInteger(steps) || steps < 1) throw new Error(`The step count must be a positive integer, got ${steps}`);
  if (!(field.spacing > 0)) throw new Error(`The pixel spacing must be positive, got ${field.spacing}`);
  const { width, height, heights, spacing } = field;
  const visibility = new Float32Array(width * height);
  const directions = Array.from({ length: samples }, (_unused, k) => {
    const angle = (2 * Math.PI * k) / samples;
    return { dx: Math.cos(angle), dy: Math.sin(angle) };
  });
  const nearest = (offset: number): number => Math.sign(offset) * Math.round(Math.abs(offset));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const here = heights[y * width + x] ?? 0;
      let open = 0;
      for (const { dx, dy } of directions) {
        let steepest = 0;
        for (let s = 1; s <= steps; s++) {
          const distance = (radius * s) / steps;
          const sx = x + nearest((dx * distance) / spacing);
          const sy = y + nearest((dy * distance) / spacing);
          if (sx < 0 || sy < 0 || sx >= width || sy >= height) break;
          const rise = (heights[sy * width + sx] ?? 0) - here;
          if (rise > 0) steepest = Math.max(steepest, rise / distance);
        }
        open += 1 - Math.sin(Math.atan(steepest));
      }
      visibility[y * width + x] = open / samples;
    }
  return visibility;
};
