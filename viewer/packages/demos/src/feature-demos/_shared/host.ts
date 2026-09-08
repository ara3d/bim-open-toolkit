// The host a feature demo drives: a session and feature host from the viewer package, models bound
// to a viewer-core scene through the render package, navigation from interact, and the live
// capabilities a page needs that are not plain data (pick, project, fit, capture, frame and GPU
// timing, the clipping seam).
//
// This is the thin stand-in for `createViewer`, which Track V has not delivered yet; it composes
// the same packages the same way and is replaced by `createViewer` when that lands. Everything a
// feature's hook needs is exposed as data (`OpenedModel`) or as a seam (`clipping`, `setView`), so
// a demo installs features with their hooks bound to what is open, and the host never knows a
// feature by name.

import {
  defaultAppearance,
  defaultView,
  diagnostic,
  disposable,
  failure,
  objectKey,
  success,
  upVector,
  type Appearance,
  type Bounds,
  type Disposable,
  type Geometry,
  type ModelData,
  type ObjectKey,
  type Result,
  type Vec2,
  type Vec3,
  type ViewState,
} from '@bim-open-toolkit/model';
import {
  FrameTimer,
  SceneBinding,
  applyEnvironment,
  captureImage,
  defaultEnvironment,
  type CameraKind,
  type CaptureImage,
  type CaptureOptions,
  type ClippingTarget,
  type DirtySets,
  type GpuFrameTimer,
  type InstanceTable,
  type ObjectHit,
  type PublishReport,
} from '@bim-open-toolkit/render';
import {
  attachNavigation,
  fitState,
  navSession,
  navState,
  startFlight,
  type NavController,
} from '@bim-open-toolkit/interact';
import { createSession, featureHost, type FeatureHost, type ViewerSession } from '@bim-open-toolkit/viewer';
import { Viewer, defaultMaterial } from '@ara3d/viewer-core';
import { captureTarget, clippingTarget, environmentTarget, packedColor, raycastSource } from './adapters.js';
import { applyView, pointInCanvas, projectToCanvas, rayThroughCanvasPoint } from './camera.js';
import { gpuFrameTimer } from './gpu-timer.js';

// A model the host has open: what a feature hook is bound to.
export type OpenedModel = {
  readonly modelId: string;
  readonly model: ModelData;
  readonly geometry: Geometry;
  // The object key of each object ordinal, in the order `geometry.instances.objectIndex` counts.
  readonly keys: readonly ObjectKey[];
  readonly table: InstanceTable;
  readonly dirty: DirtySets;
  // The appearance each object was loaded with, so a resolved styling restores it rather than grey.
  readonly base: ReadonlyMap<ObjectKey, Appearance>;
  // World bounds of the model as loaded, before any layout moves it.
  readonly bounds: Bounds;
};

// What one drawn frame reports: when it was drawn and how long the previous interval was.
export type FrameInfo = { readonly time: number; readonly intervalMs: number };

// How to make a host.
export type DemoHostOptions = {
  readonly canvas: HTMLCanvasElement;
  readonly background?: readonly [number, number, number] | undefined;
};

// The host.
export type DemoHost = Disposable & {
  readonly canvas: HTMLCanvasElement;
  readonly session: ViewerSession;
  readonly features: FeatureHost;
  readonly binding: SceneBinding;
  // Binds a model into the scene and fits the view to the first one opened.
  readonly open: (modelId: string, model: ModelData, geometry: Geometry) => Result<OpenedModel>;
  readonly opened: () => readonly OpenedModel[];
  // World bounds of everything drawn, as it is placed now.
  readonly bounds: () => Bounds;
  readonly view: () => ViewState;
  // Puts the camera at a view at once; what a navigation hook's `ViewTarget` calls.
  readonly setView: (view: ViewState) => void;
  // Flies the camera to a view; user input interrupts the flight.
  readonly flyTo: (view: ViewState) => void;
  // Frames the given bounds, or everything drawn, at once or by flight.
  readonly fit: (bounds?: Bounds, animate?: boolean) => void;
  readonly navigation: NavController;
  // A world point in canvas CSS pixels, or undefined when behind the camera or off the drawing.
  readonly project: (point: Vec3) => Vec2 | undefined;
  // The object under a client-coordinate point, or undefined.
  readonly pick: (clientX: number, clientY: number) => ObjectHit | undefined;
  // The clipping seam a clipping hook is given.
  readonly clipping: ClippingTarget;
  // GPU timing bracketed around each frame by the host; a HUD source reads it.
  readonly gpu: GpuFrameTimer;
  readonly cameraKind: () => CameraKind;
  // Called after every drawn frame, on the frame's own clock.
  readonly onFrame: (listener: (frame: FrameInfo) => void) => Disposable;
  // Publishes every pending buffer change to the renderer; what a layout hook's `moved` calls.
  readonly publish: () => PublishReport;
  readonly capture: (options?: CaptureOptions) => Promise<Result<CaptureImage>>;
};

// viewer-core builds a group's material with `transparent: opacity < 1`, and per-instance alpha
// only scales it, so a fully opaque material ignores every per-instance opacity: ghosting and
// translucent windows would draw solid. One shade below opaque switches blending on for every
// group; the shade itself is not visible.
const blendableMaterial = { ...defaultMaterial, opacity: 0.999 };

const describeCause = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

// A viewer-core renderer on the canvas, or the reason there is none (no WebGL, most often).
const attachViewer = (canvas: HTMLCanvasElement, background: readonly [number, number, number]): Result<Viewer> => {
  try {
    const viewer = new Viewer({ background: packedColor(background) });
    viewer.attach(canvas);
    return success(viewer);
  } catch (cause) {
    return failure([diagnostic('demo/no-webgl', `The canvas could not be attached: ${describeCause(cause)}`)]);
  }
};

// Makes a host over a canvas. Fails, rather than throwing, when the session cannot be made or the
// canvas has no WebGL; the caller shows the diagnostics.
export const createDemoHost = (options: DemoHostOptions): Result<DemoHost> => {
  const canvas = options.canvas;
  const made = createSession();
  if (!made.ok) return failure(made.diagnostics);
  const session = made.value;
  const features = featureHost(session);

  const attached = attachViewer(canvas, options.background ?? [0.11, 0.115, 0.13]);
  if (!attached.ok) {
    session.dispose();
    return failure(attached.diagnostics);
  }
  const viewer = attached.value;
  const applySize = (): void => {
    viewer.resize(canvas.clientWidth, canvas.clientHeight, Math.min(window.devicePixelRatio, 2));
  };
  applySize();

  const binding = new SceneBinding(viewer.scene);
  const opened: OpenedModel[] = [];
  const raycast = raycastSource(viewer.objects, () => binding.groupIndex());
  const clipping = clippingTarget(viewer);
  const environment = environmentTarget(viewer, upVector(defaultEnvironment.up));
  let environmentDisposal: Disposable | undefined;
  const gpu = gpuFrameTimer(canvas);
  const capture = captureTarget(viewer, canvas);

  const aspect = (): number => (canvas.clientHeight > 0 ? canvas.clientWidth / canvas.clientHeight : 1);
  const controller: NavController = attachNavigation(canvas, {
    session: navSession(navState(defaultView, 'orbit')),
    onChange: (current) => {
      applyView(viewer.camera, current.nav.view);
    },
  });
  applyView(viewer.camera, defaultView);

  const setView = (view: ViewState): void => {
    const current = controller.session();
    controller.setSession(navSession({ ...current.nav, view }));
    applyView(viewer.camera, view);
  };
  const flyTo = (view: ViewState): void => {
    controller.setSession(startFlight(controller.session(), view));
  };
  const fit = (bounds?: Bounds, animate = false): void => {
    const target = bounds ?? binding.bounds();
    const fitted = fitState(controller.session().nav, target, { aspect: aspect(), padding: 1.05 });
    if (animate) flyTo(fitted.view);
    else setView(fitted.view);
  };

  const open = (modelId: string, model: ModelData, geometry: Geometry): Result<OpenedModel> => {
    const keys = model.objects.map((record) => objectKey(record.ref));
    const bound = binding.addModel(modelId, geometry, keys, { material: blendableMaterial });
    if (!bound.ok) return failure(bound.diagnostics);
    const held = binding.models.find((one) => one.modelId === modelId);
    if (held === undefined) return failure([diagnostic('demo/not-bound', `Model ${modelId} was not bound`)]);
    const model_: OpenedModel = {
      modelId,
      model,
      geometry,
      keys,
      table: bound.value,
      dirty: held.dirty,
      base: new Map(model.objects.map((record) => [objectKey(record.ref), record.appearance ?? defaultAppearance])),
      bounds: binding.modelBounds(modelId),
    };
    opened.push(model_);
    environmentDisposal?.dispose();
    const applied = applyEnvironment(environment, defaultEnvironment, binding.bounds());
    environmentDisposal = applied.ok ? applied.value : undefined;
    if (opened.length === 1) fit();
    return success(model_, bound.diagnostics);
  };

  // Resize: only when the size actually changed, so nothing feeds back into the observer.
  let lastWidth = canvas.clientWidth;
  let lastHeight = canvas.clientHeight;
  const sizes = new ResizeObserver(() => {
    if (canvas.clientWidth === lastWidth && canvas.clientHeight === lastHeight) return;
    lastWidth = canvas.clientWidth;
    lastHeight = canvas.clientHeight;
    applySize();
  });
  sizes.observe(canvas);

  // The frame loop: every frame is drawn, timed on the CPU and bracketed on the GPU, then reported.
  const timer = new FrameTimer();
  const listeners = new Set<(frame: FrameInfo) => void>();
  let frame = 0;
  let disposed = false;
  const step = (now: number): void => {
    if (disposed) return;
    frame = window.requestAnimationFrame(step);
    const intervalMs = timer.mark(now) ?? 0;
    gpu.begin();
    viewer.renderFrame();
    gpu.end();
    const info: FrameInfo = { time: now, intervalMs };
    for (const listener of listeners) listener(info);
  };
  frame = window.requestAnimationFrame(step);

  return success({
    canvas,
    session,
    features,
    binding,
    open,
    opened: () => opened,
    bounds: () => binding.bounds(),
    view: () => controller.session().nav.view,
    setView,
    flyTo,
    fit,
    navigation: controller,
    project: (point) => {
      const at = projectToCanvas(viewer.camera, canvas, point);
      return at === undefined ? undefined : [at.x, at.y];
    },
    pick: (clientX, clientY) => {
      const at = pointInCanvas(canvas, clientX, clientY);
      if (at === undefined) return undefined;
      const ray = rayThroughCanvasPoint(viewer.camera, canvas, at);
      return ray === undefined ? undefined : binding.pick(ray, raycast);
    },
    clipping,
    gpu,
    cameraKind: () => 'perspective',
    onFrame: (listener) => {
      listeners.add(listener);
      return disposable(() => {
        listeners.delete(listener);
      });
    },
    publish: () => binding.publish(),
    capture: (options) => captureImage(capture, options),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      window.cancelAnimationFrame(frame);
      listeners.clear();
      sizes.disconnect();
      features.dispose();
      session.dispose();
      controller.dispose();
      environmentDisposal?.dispose();
      binding.dispose();
      viewer.dispose();
    },
  });
};
