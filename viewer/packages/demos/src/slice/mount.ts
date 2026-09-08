// The impure half of the slice: a renderer, a canvas, listeners and two overlay elements.
//
// Everything above this file is a pure function of its input. This is what a beginner would have
// to write by hand today to see any of it, which is why every step is one line with a name: the
// list is the finding, and `docs/slice.md` counts it.

import { defaultView, upVector, type ObjectKey, type ResolvedStyles } from '@bim-open-toolkit/model';
import {
  attachNavigation,
  fitState,
  navSession,
  navState,
  type NavController,
} from '@bim-open-toolkit/interact';
import {
  SceneBinding,
  applyClipping,
  applyEnvironment,
  captureImage,
  defaultEnvironment,
  noClipping,
  FrameTimer,
} from '@bim-open-toolkit/render';
import { Viewer, defaultMaterial } from '@ara3d/viewer-core';
import { captureTarget, clippingTarget, environmentTarget, gpuFrameTimer, raycastSource } from './adapters.js';
import { applyView, rayThroughPoint } from './camera.js';
import { styleChanges } from './changes.js';
import { sliceData, sliceOptions } from './data.js';
import { readoutOf, statusLine, type SliceCounts } from './readout.js';
import { baseStyles, sliceStyles } from './styles.js';

// What the page reports about itself, for a person reading the status line and for a browser test.
export type SliceReport = SliceCounts & {
  // Instance rows the first styling wrote: the red doors, and the hidden walls.
  readonly styledRowsWritten: number;
  // Doors the red rule names.
  readonly redDoors: number;
  // Whether the walls are hidden so the doors can be seen.
  readonly enclosureHidden: boolean;
  // The object key the last click picked, or the empty string when nothing is picked.
  readonly selected: string;
};

// What a mounted page offers besides its picture: the counts now, and the picture as PNG bytes.
export type SlicePage = {
  readonly report: () => SliceReport;
  // The byte length of the encoded frame, or zero when the drawing buffer could not be encoded.
  readonly capture: () => Promise<number>;
};

// How to mount. `onReport` runs about four times a second; `onReady` runs once, after the first
// frame is drawn.
export type SliceOptions = {
  readonly onReport?: ((report: SliceReport) => void) | undefined;
  readonly onReady?: ((page: SlicePage) => void) | undefined;
};

// How far a pointer may travel between press and release and still count as a click, in pixels.
const clickSlop = 4;

// viewer-core builds a group's material with `transparent: opacity < 1`, and per-instance alpha
// only scales it, so a group whose material is fully opaque ignores every per-instance opacity -
// the building's translucent windows would draw solid. One shade below opaque switches blending
// on for every group; the shade itself is not visible.
const blendableMaterial = { ...defaultMaterial, opacity: 0.999 };

// Draws the synthetic building on the canvas with the unrated doors red, and returns the way to
// take all of it away again. Throws when the model cannot be bound or the canvas has no WebGL.
export const mountSlice = (canvas: HTMLCanvasElement, options: SliceOptions = {}): (() => void) => {
  const data = sliceData(sliceOptions);
  const modelId = data.building.model.ref.id;

  const viewer = new Viewer({ background: 0xe6e9ec });
  viewer.attach(canvas);
  const applySize = (): void => {
    viewer.resize(canvas.clientWidth, canvas.clientHeight, Math.min(window.devicePixelRatio, 2));
  };
  applySize();

  const binding = new SceneBinding(viewer.scene);
  const bound = binding.addModel(modelId, data.building.geometry, data.keys, { material: blendableMaterial });
  if (!bound.ok) throw new Error(`Could not bind the building: ${bound.diagnostics.map((d) => d.message).join('; ')}`);
  const statistics = binding.statistics();
  const bounds = binding.bounds();

  const environment = applyEnvironment(
    environmentTarget(viewer, upVector(defaultEnvironment.up)),
    defaultEnvironment,
    bounds,
  );
  const clipping = applyClipping(clippingTarget(viewer), noClipping);
  const gpu = gpuFrameTimer(canvas);
  const capture = captureTarget(viewer, canvas);
  const raycast = raycastSource(viewer.objects, binding.groupIndex());

  // Style: the buffers hold what the building was generated with, so the first change table is the
  // step from that resolution to the one the red-door rule makes.
  let selection: readonly ObjectKey[] = [];
  let enclosureHidden = true;
  let resolved: ResolvedStyles = baseStyles(data);
  const painted = sliceStyles(data, selection, enclosureHidden);
  const first = binding.applyChanges(modelId, styleChanges(resolved, painted, data.keys));
  if (!first.ok) throw new Error(`Could not paint the unrated doors: ${first.diagnostics.map((d) => d.message).join('; ')}`);
  const styledRowsWritten = first.value.rowsWritten;
  resolved = painted;

  // Overlay: a status line, a readout and one control, put beside the canvas and taken away again
  // on dispose.
  const parent = canvas.parentElement ?? document.body;
  const status = document.createElement('p');
  status.className = 'slice-status';
  const readout = document.createElement('p');
  readout.className = 'slice-readout';
  readout.textContent = 'Click an object to see its name, category and fire rating.';
  const control = document.createElement('label');
  control.className = 'slice-control';
  const hideBox = document.createElement('input');
  hideBox.type = 'checkbox';
  hideBox.id = 'hide-enclosure';
  hideBox.checked = enclosureHidden;
  control.append(hideBox, document.createTextNode(' Hide the walls so the doors show'));
  parent.append(status, readout, control);

  const frames = new FrameTimer();
  let lastFrameMs = 0;
  let selected = '';
  const counts = (): SliceReport => ({
    objects: statistics.sourceObjects,
    instances: statistics.renderedInstances,
    triangles: statistics.renderedTriangles,
    doors: data.coverage.total,
    unratedDoors: data.unratedDoors.length,
    lastFrameMs,
    gpu: gpu.availability.state === 'available' ? 'available' : gpu.availability.reason,
    styledRowsWritten,
    redDoors: data.unratedDoors.length,
    enclosureHidden,
    selected,
  });
  const report = (): void => {
    status.textContent = statusLine(counts());
    options.onReport?.(counts());
  };

  // One way to change what is showing: resolve again, and write only what differs.
  const restyle = (): boolean => {
    const next = sliceStyles(data, selection, enclosureHidden);
    const applied = binding.applyChanges(modelId, styleChanges(resolved, next, data.keys));
    if (!applied.ok) {
      readout.textContent = `Could not restyle: ${applied.diagnostics.map((d) => d.message).join('; ')}`;
      return false;
    }
    resolved = next;
    return true;
  };

  hideBox.addEventListener('change', () => {
    enclosureHidden = hideBox.checked;
    restyle();
    report();
  });

  // Selection: restyle, and say what was picked.
  const select = (key: ObjectKey | undefined): void => {
    selection = key === undefined ? [] : [key];
    selected = key ?? '';
    if (!restyle()) return;
    if (key === undefined) {
      readout.textContent = 'Nothing under the pointer.';
      return;
    }
    const found = readoutOf(data, key);
    readout.textContent = `${found.name} · ${found.category} · fire rating ${found.fireRating} · ${found.coverage}`;
  };

  // Navigation: interact owns the camera state; the viewer's camera is written from it.
  const aspect = canvas.clientHeight > 0 ? canvas.clientWidth / canvas.clientHeight : 1;
  const fitted = fitState(navState(defaultView, 'orbit'), bounds, { aspect, padding: 1.05 });
  const controller: NavController = attachNavigation(canvas, {
    session: navSession(fitted),
    onChange: (session) => {
      applyView(viewer.camera, session.nav.view);
    },
  });
  applyView(viewer.camera, fitted.view);

  // Picking: a press and a release near it is a click, and a click is a pick.
  const listeners = new AbortController();
  let pressed: { readonly x: number; readonly y: number; readonly id: number } | undefined;
  canvas.addEventListener(
    'pointerdown',
    (event) => {
      pressed = event.isPrimary && event.button === 0 ? { x: event.clientX, y: event.clientY, id: event.pointerId } : undefined;
    },
    { signal: listeners.signal },
  );
  canvas.addEventListener(
    'pointerup',
    (event) => {
      const down = pressed;
      pressed = undefined;
      if (down === undefined || down.id !== event.pointerId) return;
      if (Math.hypot(down.x - event.clientX, down.y - event.clientY) > clickSlop) return;
      const ray = rayThroughPoint(viewer.camera, canvas, event.clientX, event.clientY);
      select(ray === undefined ? undefined : binding.pick(ray, raycast)?.key);
      report();
    },
    { signal: listeners.signal },
  );

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

  // The frame loop, which is also where the frame interval is measured.
  let frame = 0;
  let lastPaint = 0;
  const step = (now: number): void => {
    frame = window.requestAnimationFrame(step);
    const interval = frames.mark(now);
    if (interval !== undefined) lastFrameMs = interval;
    viewer.renderFrame();
    if (now - lastPaint > 250) {
      lastPaint = now;
      report();
    }
  };
  viewer.renderFrame();
  report();
  frame = window.requestAnimationFrame(step);
  options.onReady?.({
    report: counts,
    capture: async () => {
      const image = await captureImage(capture);
      return image.ok ? image.value.bytes.length : 0;
    },
  });

  return () => {
    window.cancelAnimationFrame(frame);
    sizes.disconnect();
    listeners.abort();
    controller.dispose();
    if (environment.ok) environment.value.dispose();
    if (clipping.ok) clipping.value.dispose();
    binding.dispose();
    viewer.dispose();
    status.remove();
    readout.remove();
    control.remove();
  };
};
