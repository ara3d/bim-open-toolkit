// A renderer that counts what it was asked to do, over a real `ViewerScene`.
//
// This is what makes `view.ts`, `multi-view.ts` and `create-viewer.ts` testable in Node: the scene
// bookkeeping is the real thing from viewer-core, and everything that would need a WebGL context is
// a counter. Every accounting test - frames drawn, groups added, adapters torn down - is written
// against this.

import { ViewerScene } from '@ara3d/viewer-core';
import { noGpuTimer, type ModelRaycastHit } from '@bim-open-toolkit/render';
import type { ViewState } from '@bim-open-toolkit/model';
import type { ViewRenderer } from '../../src/renderer.js';

// What the fake recorded.
export type RendererLog = {
  readonly frames: () => number;
  readonly sizes: () => readonly { readonly width: number; readonly height: number; readonly ratio: number }[];
  readonly views: () => readonly ViewState[];
  readonly environments: () => number;
  readonly planes: () => readonly number[];
  readonly overlays: () => number;
  readonly captures: () => number;
  readonly disposals: () => number;
  // What the next pick will find. Empty by default, so nothing is under the pointer.
  readonly setHits: (hits: readonly ModelRaycastHit[]) => void;
};

export type FakeRenderer = ViewRenderer & { readonly log: RendererLog };

// A renderer that draws nothing and remembers everything.
export const fakeRenderer = (): FakeRenderer => {
  const scene = new ViewerScene();
  const sizes: { width: number; height: number; ratio: number }[] = [];
  const views: ViewState[] = [];
  const planes: number[] = [];
  let frames = 0;
  let environments = 0;
  let overlays = 0;
  let captures = 0;
  let disposals = 0;
  let hits: readonly ModelRaycastHit[] = [];

  return {
    scene,
    resize: (width, height, ratio) => {
      sizes.push({ width, height, ratio });
    },
    setView: (view) => {
      views.push(view);
    },
    renderFrame: () => {
      frames++;
    },
    // A ray straight down the negative z axis through the point, which is enough for a pick test:
    // what the pick finds is decided by `setHits`, not by the ray.
    rayThroughNdc: (x, y) => ({ origin: [x, y, 10], direction: [0, 0, -1] }),
    raycast: () => () => hits,
    clipping: {
      setPlanes: (given) => {
        planes.push(given.length);
      },
    },
    environment: {
      setEnvironment: () => {
        environments++;
      },
    },
    overlays: {
      setOverlays: () => {
        overlays++;
      },
    },
    capture: {
      size: () => ({ width: 100, height: 50 }),
      resize: () => undefined,
      renderFrame: () => {
        frames++;
      },
      encode: () => {
        captures++;
        return Promise.resolve(Uint8Array.of(137, 80, 78, 71));
      },
    },
    gpu: noGpuTimer('this renderer draws nothing'),
    dispose: () => {
      disposals++;
    },
    log: {
      frames: () => frames,
      sizes: () => sizes,
      views: () => views,
      environments: () => environments,
      planes: () => planes,
      overlays: () => overlays,
      captures: () => captures,
      disposals: () => disposals,
      setHits: (given) => {
        hits = given;
      },
    },
  };
};

// A clock the tests wind by hand, with the shape interact's `FrameScheduler` requires.
export const testFrames = (): {
  readonly schedule: (run: (timeMs: number) => void) => () => void;
  readonly tick: (timeMs: number) => void;
  readonly pending: () => number;
} => {
  let waiting: ((timeMs: number) => void)[] = [];
  return {
    schedule: (run) => {
      waiting.push(run);
      return () => {
        waiting = waiting.filter((one) => one !== run);
      };
    },
    tick: (timeMs) => {
      const due = waiting;
      waiting = [];
      for (const run of due) run(timeMs);
    },
    pending: () => waiting.length,
  };
};
