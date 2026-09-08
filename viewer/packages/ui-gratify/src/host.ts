// One Gratify runtime on one canvas, with the page work this package owns: sizing the canvas,
// attaching and detaching input, running a frame loop that sleeps when the scene settles, and
// disposing all of it once. Both hosts of contract G1 are built on this.
import { Free, Runtime, v, type AppSpec, type Element, type SemanticsNode, type Vec } from 'gratify';
import {
  diagnostic,
  disposable,
  failure,
  success,
  type Disposable,
  type Result,
} from '@bim-open-toolkit/model';
import {
  bindSurfaceInput,
  renderLoop,
  localPoint,
  ScaledPainter,
  surfaceScale,
  type FrameScheduler,
} from './surface.js';

// How wide and tall the canvas is: as big as what the app drew, or as big as the element it is in.
export type SurfaceSizing =
  | { readonly kind: 'content'; readonly maxWidth?: number | undefined }
  | { readonly kind: 'fill'; readonly onResize: (size: Vec) => void };

// What hosting one runtime needs.
export type SurfaceOptions<D, I> = {
  readonly id: string;
  readonly spec: AppSpec<D, I>;
  readonly sizing: SurfaceSizing;
  // Scrolls by a wheel delta and reports whether it used the wheel. Without it the wheel is left to
  // the viewport underneath, which is what a HUD panel over a 3D scene wants.
  readonly onWheel?: ((delta: number, at: Vec) => boolean) | undefined;
  readonly frames?: FrameScheduler | undefined;
};

// A running runtime on a canvas.
export type RuntimeSurface<D, I> = Disposable & {
  readonly canvas: HTMLCanvasElement;
  readonly dispatch: (intent: I) => void;
  readonly doc: () => D;
  // The laid-out size of the content in logical pixels.
  readonly size: () => Vec;
  readonly wake: () => void;
  readonly semantics: () => SemanticsNode;
  // Presses the control at a semantics path exactly as a pointer would, so the DOM mirror and the
  // canvas run the same intents. False when no such control is on screen.
  readonly activate: (path: string) => boolean;
  // Runs after each committed change to the document.
  readonly onChanged: (run: () => void) => Disposable;
};

// The key of the wrapper the host puts around every app view. `Free` measures its children unbounded
// and places them at the origin, which is how the canvas learns the size the app actually wants.
const rootKey = '@surface';

const withRoot = (view: Element): Element => Free(rootKey, {}, [view]);

const findNode = (nodes: readonly SemanticsNode[], path: string): SemanticsNode | undefined => {
  for (const node of nodes) {
    if (node.path === path) return node;
    const found = findNode(node.children, path);
    if (found !== undefined) return found;
  }
  return undefined;
};

// The canvas a host draws on, or a failure when the page cannot give one.
const makeCanvas = (container: HTMLElement): Result<HTMLCanvasElement> => {
  const owner = container.ownerDocument;
  if (owner === null || typeof owner.createElement !== 'function')
    return failure([diagnostic('ui-gratify/no-document', 'Hosting a Gratify surface needs a document.')]);
  const canvas = owner.createElement('canvas');
  if (typeof canvas.getContext !== 'function' || canvas.getContext('2d') === null)
    return failure([diagnostic('ui-gratify/no-2d', 'Hosting a Gratify surface needs a 2D canvas context.')]);
  return success(canvas);
};

// Hosts one Gratify app on a new canvas inside the container. The caller places the canvas; this
// only sizes it. Disposing removes the canvas, the listeners, the observer and the frame loop.
export const hostSurface = <D, I>(
  container: HTMLElement,
  options: SurfaceOptions<D, I>,
): Result<RuntimeSurface<D, I>> => {
  const made = makeCanvas(container);
  if (!made.ok) return made;
  const canvas = made.value;
  canvas.tabIndex = 0;
  canvas.style.touchAction = 'none';
  canvas.style.display = 'block';
  canvas.dataset['surface'] = options.id;

  const listeners = new Set<() => void>();
  const ratio = surfaceScale();
  let logical = v(1, 1);
  let disposed = false;

  const spec: AppSpec<D, I> = {
    init: options.spec.init,
    update: (doc, intent) => options.spec.update(doc, intent),
    view: (doc) => withRoot(options.spec.view(doc)),
    ambient: (doc, time) => options.spec.ambient?.(doc, time) ?? false,
    onCommit: (doc, previous) => {
      options.spec.onCommit?.(doc, previous);
      for (const run of [...listeners]) run();
    },
  };

  const runtime = new Runtime<D, I>(null, spec, { headless: true, width: 1, height: 1 });
  runtime.painter = new ScaledPainter(canvas, ratio);

  const contentSize = (): Vec => {
    const inner = runtime.root.children[0];
    const max = options.sizing.kind === 'content' ? options.sizing.maxWidth : undefined;
    if (inner === undefined) return v(1, 1);
    const width = max === undefined ? inner.target.w : Math.min(inner.target.w, max);
    return v(Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(inner.target.h)));
  };

  const resizeTo = (size: Vec): boolean => {
    if (size.x === logical.x && size.y === logical.y) return false;
    logical = size;
    canvas.width = Math.round(size.x * ratio);
    canvas.height = Math.round(size.y * ratio);
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    return true;
  };

  const step = (dt: number): boolean => {
    if (disposed) return false;
    runtime.step(1, dt);
    const animating = runtime.animating;
    // A canvas is cleared by a resize, so the frame is drawn again at the new size straight away.
    if (options.sizing.kind === 'content' && resizeTo(contentSize())) runtime.step(1, 0);
    return animating;
  };

  const loop = renderLoop(step, options.frames);

  const input = bindSurfaceInput(canvas, runtime, {
    toLocal: (event) => localPoint(canvas, event, logical),
    wake: loop.wake,
    onWheel: options.onWheel,
  });

  let observer: { disconnect: () => void } | undefined;
  const sizing = options.sizing;
  if (sizing.kind === 'fill') {
    const fit = (): void => {
      const size = v(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight));
      if (resizeTo(size)) sizing.onResize(size);
      loop.wake();
    };
    fit();
    if (typeof ResizeObserver === 'function') {
      const watcher = new ResizeObserver(fit);
      watcher.observe(container);
      observer = watcher;
    }
  }

  container.appendChild(canvas);

  return success({
    canvas,
    dispatch: (intent) => {
      if (disposed) return;
      runtime.dispatch(intent);
      loop.wake();
    },
    doc: () => runtime.doc,
    size: () => logical,
    wake: loop.wake,
    semantics: () => ({
      key: options.id,
      path: options.id,
      role: 'group',
      label: options.id,
      rect: runtime.root.rect,
      children: runtime.semanticsTree(),
    }),
    activate: (path) => {
      if (disposed) return false;
      const node = findNode(runtime.semanticsTree(), path);
      if (node === undefined) return false;
      const at = node.rect.center;
      runtime.pointerDown(at);
      runtime.pointerUp(at);
      loop.wake();
      return true;
    },
    onChanged: (run) => {
      listeners.add(run);
      return disposable(() => listeners.delete(run));
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      loop.dispose();
      input.dispose();
      observer?.disconnect();
      listeners.clear();
      runtime.stop();
      canvas.remove();
    },
  });
};
