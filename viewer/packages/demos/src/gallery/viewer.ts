// `GalleryViewer`: a session, a renderer, navigation, picking, frames and disposal, behind the one
// interface every demo drives.
//
// This is the E2E slice's `mount.ts` with the page taken out of it. The slice's own findings list
// (`docs/slice.md`) names every piece of glue it holds; each one is now behind a method here, so a
// demo writes none of it, and when the viewer package publishes `createViewer` this file changes
// and no demo does.
//
// Two things are applied by default because leaving them out is silently wrong rather than loudly
// wrong: the z-up light rig (viewer-core's own rig is for a y-up scene and paints every -y wall in
// its dark ground colour) and a material one shade below opaque (viewer-core builds a group's
// material with `transparent: opacity < 1`, and per-instance alpha only scales it, so a fully
// opaque group ignores every per-instance opacity and translucent windows draw solid).

import {
  disposable,
  diagnostic,
  failure,
  note,
  success,
  upVector,
  type AnyFeature,
  type Bounds,
  type Diagnostic,
  type Disposable,
  type ModelRef,
  type ResolvedStyles,
  type Result,
  type Vec2,
  type Vec3,
} from '@bim-open-toolkit/model';
import {
  attachNavigation,
  fitState,
  navSession,
  navState,
  startFlight,
  type NavController,
  type NavState,
} from '@bim-open-toolkit/interact';
import {
  FrameTimer,
  SceneBinding,
  applyClipping,
  applyEnvironment,
  captureImage,
  defaultEnvironment,
  noClipping,
  type CaptureOptions,
  type EnvironmentSettings,
  type ObjectHit,
  type SceneStatistics,
  type UpdateReport,
} from '@bim-open-toolkit/render';
import { createSession, featureHost } from '@bim-open-toolkit/viewer';
import { Viewer, defaultMaterial } from '@ara3d/viewer-core';
import { captureTarget, clippingTarget, environmentTarget, gpuFrameTimer, raycastSource } from './adapters.js';
import { applyView, projectPointOnto, rayThroughClientPoint } from './camera.js';
import { resolveModelSource } from './model-source.js';
import { framingOf } from './framing.js';
import { attachRenderHooks } from './render-hooks.js';
import { viewSlice } from './view-slice.js';
import type { FrameInfo, GalleryViewer, ModelSource, OpenedModel } from './contracts.js';

// The material every model is bound with: one shade below opaque, so per-instance opacity works.
export const blendableMaterial = { ...defaultMaterial, opacity: 0.999 };

// The gallery's viewport: dark, so the light chrome around it reads as paper. Analytical colours
// are never theme tokens, and this is not one; it is the clear colour behind the model.
export const galleryEnvironment: EnvironmentSettings = {
  ...defaultEnvironment,
  background: [0.106, 0.114, 0.133],
  grid: { ...defaultEnvironment.grid, color: [0.19, 0.2, 0.23], emphasisColor: [0.27, 0.28, 0.32] },
};

// How a viewer is composed, for a caller that wants something other than the gallery's own look.
export type GalleryViewerOptions = {
  readonly environment?: EnvironmentSettings | undefined;
  // Capped at two by default: a retina canvas costs four times the pixels for very little.
  readonly maxPixelRatio?: number | undefined;
};

const describe = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

// Whether the person asked for no animation. A camera flight jumps instead of flying when they did.
export const reducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The canvas the viewer draws on, sized by its container rather than by an attribute.
const viewportCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.className = 'gallery-canvas';
  canvas.tabIndex = 0;
  return canvas;
};

// A viewer drawing into `container`, with `features` installed.
//
// Everything created here is undone by `dispose` in the reverse order, including the canvas, so a
// page that swaps demos leaves nothing behind. Returns the reasons rather than throwing when the
// session, the features or the renderer cannot be made.
export const createGalleryViewer = (
  container: HTMLElement,
  features: readonly AnyFeature[],
  options: GalleryViewerOptions = {},
): Result<GalleryViewer> => {
  const started = createSession({ slices: [viewSlice] });
  if (!started.ok) return failure(started.diagnostics);
  const session = started.value;
  const host = featureHost(session);
  const installed = host.install(features);
  if (!installed.ok) {
    host.dispose();
    session.dispose();
    return failure(installed.diagnostics);
  }

  const canvas = viewportCanvas();
  container.append(canvas);
  const core = new Viewer({ background: 0x1b1d22 });
  const ratio = options.maxPixelRatio ?? 2;
  try {
    core.attach(canvas);
  } catch (cause) {
    canvas.remove();
    host.dispose();
    session.dispose();
    return failure([
      diagnostic('gallery/no-webgl', `The canvas has no WebGL context: ${describe(cause)}`, ['canvas']),
    ]);
  }
  const applySize = (): void => {
    core.resize(canvas.clientWidth, canvas.clientHeight, Math.min(window.devicePixelRatio, ratio));
  };
  applySize();

  const binding = new SceneBinding(core.scene, () => core.requestRender());
  const clipping = applyClipping(clippingTarget(core), noClipping);
  const capture = captureTarget(core, canvas);
  const gpu = gpuFrameTimer(canvas);
  const opened: OpenedModel[] = [];
  let environment: Disposable | undefined;
  // The features' own render hooks, attached once a model is open because every one of them needs
  // the bound scene. Replaced, not added to, when another model is opened.
  let drawing: Disposable | undefined;
  // A demo that installs the environment feature owns the environment; applying the gallery's own
  // on top of it would undo the demo's opening move on the next model.
  const environmentIsDemos = features.some((one) => one.id === 'environment');

  // Navigation owns the camera; every step is written to the view slice, and the slice is what the
  // renderer's camera is written from, so nothing reads the camera to know where it is.
  const controller: NavController = attachNavigation(canvas, {
    session: navSession(navState(session.read(viewSlice), 'orbit')),
    onChange: (moved) => {
      session.write(viewSlice, moved.nav.view);
    },
  });
  const writeCamera = (): void => {
    applyView(core.camera, session.read(viewSlice));
    core.requestRender();
  };
  const cameraFollowsSlice = session.subscribe((event) => {
    if (event.changed.includes(viewSlice.id)) writeCamera();
  });
  writeCamera();

  // What the camera frames and what the environment is sized to: the bulk of the model rather than
  // the union of everything in it, because a real model carries strays kilometres from its building.
  const framed = (): Bounds => framingOf(binding).bounds;

  const size = (): { readonly width: number; readonly height: number } => ({
    width: canvas.clientWidth,
    height: canvas.clientHeight,
  });

  const fitted = (bounds: Bounds): NavState => {
    const shape = size();
    const aspect = shape.height > 0 ? shape.width / shape.height : 1;
    return fitState(controller.session().nav, bounds, { aspect, padding: 1.05 });
  };

  const applyEnvironmentTo = (bounds: Bounds): void => {
    if (environmentIsDemos) return;
    environment?.dispose();
    environment = undefined;
    const settings = options.environment ?? galleryEnvironment;
    const applied = applyEnvironment(environmentTarget(core, upVector(settings.up)), settings, bounds);
    if (applied.ok) environment = applied.value;
  };

  const open = async (source: ModelSource): Promise<Result<ModelRef>> => {
    const resolved = await resolveModelSource(source);
    if (!resolved.ok) return failure(resolved.diagnostics);
    const model = resolved.value;
    const bound = binding.addModel(model.modelId, model.geometry, model.keys, { material: blendableMaterial });
    if (!bound.ok) return failure([...resolved.diagnostics, ...bound.diagnostics]);
    opened.push(model);
    const box = framed();
    applyEnvironmentTo(box);
    controller.setSession(navSession(fitted(box)));
    session.write(viewSlice, controller.session().nav.view);
    drawing?.dispose();
    drawing = attachRenderHooks(session, features, {
      binding,
      opened: () => [...opened],
      bounds: framed,
      clipping: clippingTarget(core),
      environmentTarget: (up) => environmentTarget(core, up),
      setView: (view) => {
        controller.setSession(navSession(navState(view, 'orbit')));
        session.write(viewSlice, view);
      },
      requestRender: () => core.requestRender(),
    });
    return success(model.ref, [...resolved.diagnostics, ...bound.diagnostics]);
  };

  // Frames: one loop, the interval measured on it, and listeners told after the picture is drawn.
  const frames = new FrameTimer();
  const listeners = new Set<(frame: FrameInfo) => void>();
  let intervalMs = 0;
  let frame = 0;
  const step = (now: number): void => {
    frame = window.requestAnimationFrame(step);
    const measured = frames.mark(now);
    if (measured !== undefined) intervalMs = measured;
    core.renderFrame();
    const info: FrameInfo = { time: now, intervalMs };
    for (const listener of [...listeners]) if (listeners.has(listener)) listener(info);
  };

  // Resize: only when the size actually changed, so nothing feeds back into the observer.
  let lastWidth = canvas.clientWidth;
  let lastHeight = canvas.clientHeight;
  const sizes = new ResizeObserver(() => {
    if (canvas.clientWidth === lastWidth && canvas.clientHeight === lastHeight) return;
    lastWidth = canvas.clientWidth;
    lastHeight = canvas.clientHeight;
    applySize();
    frames.reset();
  });
  sizes.observe(canvas);

  // Picking: a press and a release near it is a click, and a click is what a demo hears about.
  const raycast = raycastSource(core.objects, binding.groupIndex());
  const pick = (clientX: number, clientY: number): ObjectHit | undefined => {
    const ray = rayThroughClientPoint(core.camera, canvas, clientX, clientY);
    return ray === undefined ? undefined : binding.pick(ray, raycast);
  };

  core.renderFrame();
  frame = window.requestAnimationFrame(step);

  let closed = false;
  const viewer: GalleryViewer = {
    read: session.read,
    write: session.write,
    dispatch: session.dispatch,
    subscribe: session.subscribe,
    viewport: container,
    canvas,
    open,
    models: () => opened.map((model) => model.ref),
    opened: () => [...opened],
    applyStyles: (modelId: string, resolved: ResolvedStyles): Result<UpdateReport> =>
      binding.applyStyles(modelId, resolved),
    statistics: (): SceneStatistics => binding.statistics(),
    bounds: () => (opened.length === 0 ? undefined : binding.bounds()),
    fit: () => {
      if (opened.length === 0) return;
      controller.setSession(navSession(fitted(framed())));
      session.write(viewSlice, controller.session().nav.view);
    },
    flyTo: (bounds: Bounds) => {
      if (!reducedMotion()) {
        controller.setSession(startFlight(controller.session(), fitted(bounds).view));
        return;
      }
      controller.setSession(navSession(fitted(bounds)));
      session.write(viewSlice, controller.session().nav.view);
    },
    project: (point: Vec3): Vec2 | undefined => projectPointOnto(core.camera, size(), point),
    pick,
    capture: async (captureOptions?: CaptureOptions) => {
      const image = await captureImage(capture, captureOptions ?? {});
      return image.ok ? success(image.value.bytes, image.diagnostics) : failure(image.diagnostics);
    },
    onFrame: (listener: (info: FrameInfo) => void): Disposable => {
      listeners.add(listener);
      return disposable(() => {
        listeners.delete(listener);
      });
    },
    dispose: () => {
      if (closed) return;
      closed = true;
      window.cancelAnimationFrame(frame);
      listeners.clear();
      sizes.disconnect();
      cameraFollowsSlice.dispose();
      drawing?.dispose();
      drawing = undefined;
      controller.dispose();
      environment?.dispose();
      if (clipping.ok) clipping.value.dispose();
      binding.dispose();
      core.dispose();
      canvas.remove();
      host.dispose();
      session.dispose();
    },
  };

  // Why there is no GPU timing, said once, so a HUD can report the reason rather than showing a
  // CPU number in its place.
  const notes: readonly Diagnostic[] =
    gpu.availability.state === 'available' ? [] : [note('gallery/no-gpu-timing', gpu.availability.reason, ['gpu'])];
  return success(viewer, notes);
};
