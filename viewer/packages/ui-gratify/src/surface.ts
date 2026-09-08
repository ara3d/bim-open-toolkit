// The seam between a Gratify runtime and the page. Gratify's own `mount()` attaches listeners it
// never detaches and captures every pointer on its canvas, which would swallow orbit and zoom on a
// viewport-sized surface. So this package drives a headless `Runtime` and owns the canvas, the
// listeners and the frame loop itself, exactly as the alpha's `visualization/src/gratify.ts` does.
//
// Nothing here is a DOM type: a real canvas has all of these members, and a test supplies a
// stand-in of the same shape, so the whole lifecycle is checked without a browser.
import { CanvasPainter, v, type Vec } from 'gratify';
import { disposable, type Disposable } from '@bim-open-toolkit/model';

// The fields read off a browser event. A real `PointerEvent`, `WheelEvent` or `KeyboardEvent` has
// all of them and more; nothing else is read.
export type SurfaceEvent = {
  readonly clientX?: number;
  readonly clientY?: number;
  readonly pointerId?: number;
  readonly isPrimary?: boolean;
  readonly button?: number;
  readonly deltaY?: number;
  readonly deltaMode?: number;
  readonly key?: string;
  readonly shiftKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly metaKey?: boolean;
  preventDefault?(): void;
};

// What the host needs from the element it listens on.
export type SurfaceElement = {
  addEventListener(type: string, listener: (event: SurfaceEvent) => void, options?: { readonly passive: boolean }): void;
  removeEventListener(type: string, listener: (event: SurfaceEvent) => void): void;
  focus?(): void;
  setPointerCapture?(pointerId: number): void;
  releasePointerCapture?(pointerId: number): void;
  hasPointerCapture?(pointerId: number): boolean;
  getBoundingClientRect?(): { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
};

// The modifier keys Gratify's input pipeline understands.
export type InputModifiers = { readonly shift: boolean; readonly alt: boolean; readonly ctrl: boolean };

// The part of a Gratify `Runtime` the input binding drives. Stating it as a type keeps the binding
// testable and says exactly how much of the runtime this package depends on.
export type SurfaceInput = {
  pointerDown(point: Vec, mods?: Partial<InputModifiers>): void;
  pointerMove(point: Vec, mods?: Partial<InputModifiers>): void;
  pointerUp(point: Vec): void;
  key(key: string, mods?: Partial<InputModifiers>): boolean;
};

// Asks for the next frame and returns the way to cancel it, so a test drives the clock by hand.
export type FrameScheduler = (run: (timeMs: number) => void) => () => void;

// The browser's own frame scheduler. Where there is no browser it never fires, rather than failing.
export const browserFrames: FrameScheduler = (run) => {
  if (typeof requestAnimationFrame !== 'function') return () => undefined;
  const handle = requestAnimationFrame(run);
  return () => {
    cancelAnimationFrame(handle);
  };
};

// A loop that runs only while something is moving. `step` advances one frame and reports whether the
// scene is still animating; when it is not, no frame is asked for until something calls `wake`.
export type RenderLoop = Disposable & { readonly wake: () => void };

// The longest frame a step is told about, so a backgrounded tab does not jump the animation.
const longestFrame = 0.05;

export const renderLoop = (step: (dt: number) => boolean, schedule: FrameScheduler = browserFrames): RenderLoop => {
  let cancel: (() => void) | undefined;
  let last: number | undefined;
  let stopped = false;

  const tick = (timeMs: number): void => {
    cancel = undefined;
    if (stopped) return;
    const dt = last === undefined ? 1 / 60 : Math.min(longestFrame, Math.max(0.001, (timeMs - last) / 1000));
    last = timeMs;
    if (step(dt)) request();
    else last = undefined;
  };

  const request = (): void => {
    if (stopped || cancel !== undefined) return;
    last = undefined;
    cancel = schedule(tick);
  };

  request();
  return {
    wake: request,
    dispose: () => {
      if (stopped) return;
      stopped = true;
      cancel?.();
      cancel = undefined;
    },
  };
};

// The modifiers an event reports as held.
export const modifiersOf = (event: SurfaceEvent): InputModifiers => ({
  shift: event.shiftKey === true,
  alt: event.altKey === true,
  ctrl: event.ctrlKey === true || event.metaKey === true,
});

// Where a client-space event lands in the runtime's own coordinates: the element may be laid out at
// a different size than the logical surface it draws, so the ratio is applied here.
export const localPoint = (element: SurfaceElement, event: SurfaceEvent, logical: Vec): Vec => {
  const bounds = element.getBoundingClientRect?.() ?? { left: 0, top: 0, width: logical.x, height: logical.y };
  const scaleX = logical.x / Math.max(1, bounds.width);
  const scaleY = logical.y / Math.max(1, bounds.height);
  return v(((event.clientX ?? 0) - bounds.left) * scaleX, ((event.clientY ?? 0) - bounds.top) * scaleY);
};

// Far enough outside any surface that a part under it stops being hovered or pressed.
const offSurface: Vec = v(-100000, -100000);

// How a surface passes input to a runtime.
export type InputOptions = {
  // Where the event lands in runtime coordinates.
  readonly toLocal: (event: SurfaceEvent) => Vec;
  // Called after any input that could have changed something.
  readonly wake: () => void;
  // Given a wheel delta, scrolls and reports whether it used the wheel. Without it the wheel is not
  // listened for at all, so the viewport underneath keeps its zoom.
  readonly onWheel?: ((delta: number, at: Vec) => boolean) | undefined;
};

// How much a wheel notch means in pixels, per `WheelEvent.deltaMode`: pixels, lines, then pages.
const wheelPixels = (event: SurfaceEvent): number =>
  (event.deltaY ?? 0) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1);

// Attaches one surface's pointer, wheel and key events to a runtime, and returns the one way to
// detach every one of them. Disposing more than once does nothing more.
export const bindSurfaceInput = (
  element: SurfaceElement,
  input: SurfaceInput,
  options: InputOptions,
): Disposable => {
  const attached: [string, (event: SurfaceEvent) => void][] = [];
  const listen = (type: string, handler: (event: SurfaceEvent) => void, passive?: boolean): void => {
    if (passive === undefined) element.addEventListener(type, handler);
    else element.addEventListener(type, handler, { passive });
    attached.push([type, handler]);
  };

  let active: number | undefined;
  const release = (): void => {
    const pointer = active;
    active = undefined;
    if (pointer !== undefined && element.hasPointerCapture?.(pointer) === true) {
      element.releasePointerCapture?.(pointer);
    }
  };

  listen('pointerdown', (event) => {
    if (event.isPrimary === false || (event.button ?? 0) !== 0 || active !== undefined) return;
    active = event.pointerId ?? 0;
    element.focus?.();
    element.setPointerCapture?.(active);
    input.pointerDown(options.toLocal(event), modifiersOf(event));
    options.wake();
  });
  listen('pointermove', (event) => {
    if (active !== undefined && active !== (event.pointerId ?? 0)) return;
    input.pointerMove(options.toLocal(event), modifiersOf(event));
    options.wake();
  });
  listen('pointerup', (event) => {
    if (active !== (event.pointerId ?? 0)) return;
    input.pointerUp(options.toLocal(event));
    release();
    options.wake();
  });
  const cancelPointer = (): void => {
    input.pointerMove(offSurface);
    input.pointerUp(offSurface);
    release();
    options.wake();
  };
  listen('pointercancel', cancelPointer);
  listen('lostpointercapture', cancelPointer);
  listen('pointerleave', () => {
    if (active !== undefined) return;
    input.pointerMove(offSurface);
    options.wake();
  });
  const onWheel = options.onWheel;
  if (onWheel !== undefined) {
    listen('wheel', (event) => {
      if (onWheel(wheelPixels(event), options.toLocal(event))) event.preventDefault?.();
      options.wake();
    }, false);
  }
  listen('keydown', (event) => {
    // Tab stays the browser's, so focus can always leave the canvas for the DOM mirror.
    const key = event.key ?? '';
    if (key === '' || key === 'Tab') return;
    if (input.key(key, modifiersOf(event))) {
      event.preventDefault?.();
      options.wake();
    }
  });

  return disposable(() => {
    for (const [type, handler] of attached) element.removeEventListener(type, handler);
    attached.length = 0;
    release();
  });
};

// The device pixel ratio to draw at, capped so a very dense screen does not cost four times the fill.
export const surfaceScale = (): number =>
  typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? Math.min(devicePixelRatio, 2) : 1;

// Gratify's canvas painter, drawing at a fixed device pixel ratio. A headless `Runtime` never learns
// the ratio (it is set only by the DOM wiring this package replaces), so the painter applies it.
export class ScaledPainter extends CanvasPainter {
  constructor(canvas: HTMLCanvasElement, private readonly ratio: number) {
    super(canvas);
  }

  override screen(_dpr: number): void {
    this.ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
  }

  override view(pan: Vec, zoom: number, _dpr: number): void {
    const k = zoom * this.ratio;
    this.ctx.setTransform(k, 0, 0, k, pan.x * this.ratio, pan.y * this.ratio);
  }
}
