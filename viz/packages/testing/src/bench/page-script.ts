// The page-side half of the frame-time protocol, as a script the browser runner injects.
//
// Frame timing has to happen inside the page: only the page sees animation frames, and the time
// between them is the number a viewer experiences. The page cannot import this package, so the
// collector is a small script built here as a string and evaluated there. Keeping it in one place
// means every benchmark measures frames the same way.
//
// The page supplies the drawing. It declares a function under the hook name, taking the camera
// state for the frame and the frame number; the script calls it once per frame and times that
// call. A page that declares nothing still reports frame intervals, which is the idle cost.

import {
  array,
  boolean,
  integer,
  number,
  object,
  parse,
  type Infer,
  type Result,
} from '@bim-open-toolkit/model';
import type { CameraPath } from './camera-path.js';

// How the probe runs.
export type FrameProbeOptions = {
  // Frames drawn before measurement starts, to let shaders compile and caches fill.
  readonly warmupFrames: number;
  // Frames measured. The report's percentiles are taken over these.
  readonly measuredFrames: number;
  // The name of the page's per-frame function on `globalThis`.
  readonly hookName: string;
};

// Five warm-up frames and sixty measured, calling `globalThis.benchmarkFrame`.
export const defaultFrameProbeOptions: FrameProbeOptions = {
  warmupFrames: 5,
  measuredFrames: 60,
  hookName: 'benchmarkFrame',
};

// What the probe returns. It crosses from the page as JSON, so it is described as a schema and
// checked on the way back in: a page can return anything, and a benchmark must not report numbers
// it did not receive. `drew` is true when the page declared the hook; false means the frame times
// are idle intervals with no drawing in them.
export const frameProbeResultSchema = object({
  drew: boolean(),
  samples: array(object({ frame: integer(), cpuMs: number(), intervalMs: number() })),
});

// The result of a frame probe, as its schema accepts it.
export type FrameProbeResult = Infer<typeof frameProbeResultSchema>;

// Reads a probe result back from whatever the page returned, reporting what was wrong with it.
export const parseFrameProbeResult = (value: unknown): Result<FrameProbeResult> =>
  parse(frameProbeResultSchema, value);

// A script that replays a camera path one view per animation frame and reports the frame times.
// The result is a `FrameProbeResult`; evaluate it in a page and read it back as JSON.
export function frameTimeProbeScript(
  path: CameraPath,
  options: Partial<FrameProbeOptions> = {},
): string {
  const settings: FrameProbeOptions = { ...defaultFrameProbeOptions, ...options };
  if (!Number.isInteger(settings.measuredFrames) || settings.measuredFrames < 1) {
    throw new Error(`measuredFrames must be a positive integer, got ${settings.measuredFrames}`);
  }
  if (!Number.isInteger(settings.warmupFrames) || settings.warmupFrames < 0) {
    throw new Error(`warmupFrames must be a whole number, got ${settings.warmupFrames}`);
  }
  const views = JSON.stringify(path.keys.map((key) => key.view));
  return `(async () => {
  const views = ${views};
  const hook = globalThis[${JSON.stringify(settings.hookName)}];
  const drew = typeof hook === 'function';
  const warmup = ${settings.warmupFrames};
  const measured = ${settings.measuredFrames};
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const samples = [];
  let previous = performance.now();
  for (let index = 0; index < warmup + measured; index += 1) {
    await nextFrame();
    const start = performance.now();
    if (drew) hook(views[index % views.length], index);
    const cpuMs = performance.now() - start;
    const intervalMs = start - previous;
    previous = start;
    if (index >= warmup) samples.push({ frame: index - warmup, cpuMs, intervalMs });
  }
  return { samples, drew };
})()`;
}

// A script reporting what WebGL the page actually got, so a report can say whether it was software.
// Returns `{ renderer, version }`, or null when the page cannot create a WebGL2 context.
export const graphicsProbeScript = `(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return null;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unavailable';
  const version = gl.getParameter(gl.VERSION);
  const lose = gl.getExtension('WEBGL_lose_context');
  if (lose) lose.loseContext();
  return { renderer: String(renderer), version: String(version) };
})()`;
