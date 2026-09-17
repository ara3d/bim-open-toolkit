// One canvas: a camera, input, a frame loop, a size, and the way to take all of it away.
//
// A view owns exactly what belongs to one picture. What is drawn - the models, their appearance -
// belongs to the session and is shared by every view, which is what makes two canvases over one
// model cheap: the same `InstancedGroup`s go into both scenes and one colour write moves both.
//
// The frame loop draws only when something asked it to. `requestRender` marks the view dirty;
// navigation marks it dirty when it changed; a resize marks it dirty. A view sitting still schedules
// a frame and draws nothing, so the frame times measured are the frames a viewer actually saw.

import {
  applyClipping,
  applyEnvironment,
  FrameTimer,
  noClipping,
  type ClipRegion,
  type EnvironmentSettings,
  type Ray,
  type DurationStats,
} from '@bim-open-toolkit/render';
import {
  attachNavigation,
  browserFrames,
  emptyFrame,
  navSession,
  navState,
  setMode,
  startFlight,
  stepSession,
  type FrameScheduler,
  type NavController,
  type NavElement,
  type NavMode,
  type NavSession,
} from '@bim-open-toolkit/interact';
import {
  defaultView,
  disposable,
  type Bounds,
  type Disposable,
  type ViewState,
} from '@bim-open-toolkit/model';
import type { InstancedGroup } from '@ara3d/viewer-core';
import type { ViewRenderer } from './renderer.js';
import { ndcOf } from './adapters/camera.js';

// The size of a view, in CSS pixels.
export type ViewSize = { readonly width: number; readonly height: number };

// How a view is made.
export type ViewOptions = {
  readonly id: string;
  readonly renderer: ViewRenderer;
  // The element navigation listens on. Without one the camera moves only by command.
  readonly element?: NavElement | undefined;
  // The canvas, when there is one: its client size and the device pixel ratio drive the buffer.
  readonly canvas?: HTMLCanvasElement | undefined;
  readonly view?: ViewState | undefined;
  readonly mode?: NavMode | undefined;
  // Where frames come from. A test winds a clock; the default is the browser's own.
  readonly schedule?: FrameScheduler | undefined;
  // The most device pixels per CSS pixel. Two is enough to look sharp and cheap enough to draw.
  readonly maxPixelRatio?: number | undefined;
  // Called after the camera moved, however it moved.
  readonly onCamera?: ((id: string, view: ViewState) => void) | undefined;
  // Called with the interval between drawn frames, in milliseconds.
  readonly onFrame?: ((id: string, intervalMs: number) => void) | undefined;
};

// One canvas of one session.
export type View = {
  readonly id: string;
  readonly renderer: ViewRenderer;
  readonly camera: () => ViewState;
  // Moves the camera. A flight of more than zero milliseconds is interruptible by the user.
  readonly setCamera: (view: ViewState, flightMs?: number) => void;
  readonly mode: () => NavMode;
  readonly setMode: (mode: NavMode) => void;
  readonly size: () => ViewSize;
  readonly aspect: () => number;
  // Sets the size in CSS pixels. Without arguments it takes the canvas's own client size.
  readonly resize: (width?: number, height?: number) => void;
  readonly requestRender: () => void;
  // Draws now, outside the loop, which is what capturing an image needs.
  readonly renderNow: () => void;
  readonly addGroups: (groups: readonly InstancedGroup[]) => void;
  readonly removeGroups: (groups: readonly InstancedGroup[]) => void;
  // Puts an environment in place, or takes the one there away.
  readonly setEnvironment: (settings: EnvironmentSettings | undefined, bounds: Bounds) => void;
  readonly setClipping: (region: ClipRegion) => void;
  // A world ray through a point in normalized device coordinates.
  readonly ray: (x: number, y: number) => Ray | undefined;
  // A point in client coordinates as normalized device coordinates, when the view has a canvas.
  readonly ndc: (clientX: number, clientY: number) => { readonly x: number; readonly y: number } | undefined;
  readonly frames: () => DurationStats;
  readonly disposed: () => boolean;
  readonly dispose: () => void;
};

const noSize: ViewSize = { width: 0, height: 0 };

// A view over one renderer. Nothing is drawn until the first frame the scheduler gives it.
export const createView = (options: ViewOptions): View => {
  const { id, renderer } = options;
  const schedule = options.schedule ?? browserFrames;
  const maxPixelRatio = options.maxPixelRatio ?? 2;
  const timer = new FrameTimer();
  const held = new Set<InstancedGroup>();

  let size: ViewSize = noSize;
  let dirty = true;
  let closed = false;
  let cancelFrame: (() => void) | undefined;
  let lastStep: number | undefined;
  let environment: Disposable = disposable(() => undefined);
  let clipping: Disposable = disposable(() => undefined);
  let session: NavSession = navSession(navState(options.view ?? defaultView, options.mode ?? 'orbit'));

  const aspect = (): number => (size.height > 0 ? size.width / size.height : 1);

  const published = (next: NavSession): void => {
    const moved = next.nav.view !== session.nav.view;
    session = next;
    if (!moved) return;
    dirty = true;
    options.onCamera?.(id, next.nav.view);
  };

  // Navigation, when there is an element to listen on. The controller owns the session then, and
  // schedules its own frames while something is happening.
  const controller: NavController | undefined =
    options.element === undefined
      ? undefined
      : attachNavigation(options.element, {
          session,
          onChange: published,
          ...(options.schedule === undefined ? {} : { schedule: options.schedule }),
        });

  const setSession = (next: NavSession): void => {
    if (controller === undefined) published(next);
    else {
      session = next;
      controller.setSession(next);
      dirty = true;
      options.onCamera?.(id, next.nav.view);
    }
  };

  const applySize = (width: number, height: number): void => {
    if (width === size.width && height === size.height) return;
    size = { width, height };
    const ratio = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, maxPixelRatio);
    renderer.resize(width, height, ratio);
    timer.reset();
    dirty = true;
  };

  const resize = (width?: number, height?: number): void => {
    if (width !== undefined && height !== undefined) {
      applySize(width, height);
      return;
    }
    const canvas = options.canvas;
    if (canvas !== undefined) applySize(canvas.clientWidth, canvas.clientHeight);
  };

  const draw = (nowMs: number): void => {
    if (controller === undefined && session.flight !== undefined) {
      const previous = lastStep ?? nowMs;
      setSession(stepSession(session, emptyFrame({ width: size.width, height: size.height }), nowMs - previous));
    }
    lastStep = nowMs;
    if (!dirty) return;
    dirty = false;
    renderer.setView(session.nav.view, aspect());
    renderer.renderFrame();
    const interval = timer.mark(nowMs);
    if (interval !== undefined) options.onFrame?.(id, interval);
  };

  const loop = (nowMs: number): void => {
    if (closed) return;
    cancelFrame = schedule(loop);
    draw(nowMs);
  };

  // The size the view starts at, and an observer that only reacts to a size that actually changed,
  // so nothing the observer does feeds back into it.
  resize();
  const sizes =
    options.canvas !== undefined && typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          resize();
        })
      : undefined;
  if (sizes !== undefined && options.canvas !== undefined) sizes.observe(options.canvas);

  cancelFrame = schedule(loop);

  return {
    id,
    renderer,
    camera: () => session.nav.view,
    setCamera: (view, flightMs) => {
      setSession(
        flightMs !== undefined && flightMs > 0
          ? startFlight(session, view, flightMs)
          : { ...session, flight: undefined, nav: { ...session.nav, view } },
      );
    },
    mode: () => session.nav.mode,
    setMode: (mode) => {
      setSession({ ...session, nav: setMode(session.nav, mode) });
    },
    size: () => size,
    aspect,
    resize,
    requestRender: () => {
      dirty = true;
    },
    renderNow: () => {
      renderer.setView(session.nav.view, aspect());
      renderer.renderFrame();
    },
    addGroups: (groups) => {
      for (const group of groups) {
        if (held.has(group)) continue;
        held.add(group);
        renderer.scene.addGroup(group);
      }
      dirty = true;
    },
    removeGroups: (groups) => {
      for (const group of groups) {
        if (!held.delete(group)) continue;
        renderer.scene.removeGroup(group);
      }
      dirty = true;
    },
    setEnvironment: (settings, bounds) => {
      environment.dispose();
      environment = disposable(() => undefined);
      if (settings === undefined) return;
      const applied = applyEnvironment(renderer.environment, settings, bounds);
      if (applied.ok) environment = applied.value;
      dirty = true;
    },
    setClipping: (region) => {
      clipping.dispose();
      const applied = applyClipping(renderer.clipping, region);
      clipping = applied.ok ? applied.value : disposable(() => undefined);
      dirty = true;
    },
    ray: (x, y) => renderer.rayThroughNdc(x, y),
    ndc: (clientX, clientY) => {
      const canvas = options.canvas;
      if (canvas === undefined) return undefined;
      const rect = canvas.getBoundingClientRect();
      return ndcOf(rect, clientX, clientY);
    },
    frames: () => timer.stats(),
    disposed: () => closed,
    dispose: () => {
      if (closed) return;
      closed = true;
      cancelFrame?.();
      cancelFrame = undefined;
      sizes?.disconnect();
      controller?.dispose();
      environment.dispose();
      clipping.dispose();
      for (const group of held) renderer.scene.removeGroup(group);
      held.clear();
      renderer.dispose();
    },
  };
};

// A region that clips nothing, for a view putting its section away.
export const noSection: ClipRegion = noClipping;
