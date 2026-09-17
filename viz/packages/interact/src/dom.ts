import {
  mouseButtons,
  normalizeKey,
  type InputFrame,
  type ModifierName,
  type PointerKind,
  type PointerSample,
} from './input.js';
import { isFlying, stepSession, type NavSession } from './session.js';

// The fields this adapter reads from a browser event. A real `PointerEvent`, `WheelEvent`,
// `KeyboardEvent` or `FocusEvent` has all of these and more; nothing else is read.
export type NavEvent = {
  readonly pointerId?: number;
  readonly pointerType?: string;
  readonly buttons?: number;
  readonly clientX?: number;
  readonly clientY?: number;
  readonly deltaY?: number;
  readonly deltaMode?: number;
  readonly key?: string;
  readonly shiftKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly metaKey?: boolean;
  preventDefault?(): void;
};

// What this adapter needs from the element it listens on. A real `HTMLElement` has all of it,
// and a test supplies a stand-in of the same shape, which is why nothing here is a DOM type.
export type NavElement = {
  addEventListener(type: string, listener: (event: NavEvent) => void): void;
  removeEventListener(type: string, listener: (event: NavEvent) => void): void;
  readonly clientWidth: number;
  readonly clientHeight: number;
  setPointerCapture?(pointerId: number): void;
  releasePointerCapture?(pointerId: number): void;
  getBoundingClientRect?(): { readonly left: number; readonly top: number };
  readonly style?: { touchAction: string };
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

// How to attach navigation to an element.
export type NavOptions = {
  readonly session: NavSession;
  // Called after any step that changed the session, and not otherwise.
  readonly onChange?: ((session: NavSession) => void) | undefined;
  // Defaults to the browser's animation frames.
  readonly schedule?: FrameScheduler | undefined;
};

// A running attachment: read the session, replace it, or stop.
export type NavController = {
  readonly session: () => NavSession;
  // Replace the session, for a command that moves the view, switches mode or rebinds controls.
  // It does not report a change back through `onChange`, since the caller already knows.
  readonly setSession: (session: NavSession) => void;
  // Stop listening, let go of every pointer capture and cancel any pending frame. Safe to repeat.
  readonly dispose: () => void;
};

// How much a wheel notch means in pixels, per `WheelEvent.deltaMode`: pixels, lines, then pages.
const wheelPixels = (deltaY: number, deltaMode: number): number =>
  deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;

// Which kind of pointer an event describes.
const pointerKind = (event: NavEvent): PointerKind =>
  event.pointerType === 'touch' ? 'touch' : event.pointerType === 'pen' ? 'pen' : 'mouse';

// The modifier keys an event reports as held.
const modifiersOf = (event: NavEvent): readonly ModifierName[] => {
  const held: ModifierName[] = [];
  if (event.shiftKey === true) held.push('shift');
  if (event.ctrlKey === true) held.push('ctrl');
  if (event.altKey === true) held.push('alt');
  if (event.metaKey === true) held.push('meta');
  return held;
};

// Turns element events into normalised input frames and steps the session with them.
// This is the only part of the package that touches a DOM; everything it drives is pure.
//
// The element receives the keyboard, not the window, so two viewers on one page never take each
// other's keys, and losing focus drops every held key so a walk cannot continue unseen. Keys are
// only stopped from reaching the page when the current bindings actually use them.
//
// A frame is only asked for while something is happening: a pointer is down, a key is held, the
// wheel has turned, or a flight is running. Nothing is scheduled while the view sits still.
export const attachNavigation = (element: NavElement, options: NavOptions): NavController => {
  const schedule = options.schedule ?? browserFrames;
  const onChange = options.onChange;
  let session = options.session;

  const pointers = new Map<number, PointerSample>();
  const keys = new Set<string>();
  let modifiers: readonly ModifierName[] = [];
  let wheel = 0;
  let cancelFrame: (() => void) | undefined;
  let lastMs: number | undefined;
  let disposed = false;

  const listeners: [string, (event: NavEvent) => void][] = [];
  const listen = (type: string, handler: (event: NavEvent) => void): void => {
    element.addEventListener(type, handler);
    listeners.push([type, handler]);
  };

  const localPoint = (event: NavEvent): { readonly x: number; readonly y: number } => {
    const rect = element.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    return { x: (event.clientX ?? 0) - rect.left, y: (event.clientY ?? 0) - rect.top };
  };

  const currentFrame = (): InputFrame => ({
    viewport: { width: element.clientWidth, height: element.clientHeight },
    pointers: [...pointers.values()],
    modifiers,
    keys: [...keys],
    wheel,
  });

  const busy = (): boolean =>
    isFlying(session) ||
    keys.size > 0 ||
    wheel !== 0 ||
    [...pointers.values()].some((pointer) => pointer.kind === 'touch' || pointer.buttons.length > 0);

  const clearMovement = (): void => {
    wheel = 0;
    for (const [id, pointer] of pointers) pointers.set(id, { ...pointer, dx: 0, dy: 0 });
  };

  const tick = (timeMs: number): void => {
    cancelFrame = undefined;
    if (disposed) return;
    const dtMs = lastMs === undefined ? 0 : timeMs - lastMs;
    lastMs = timeMs;
    const before = session;
    session = stepSession(session, currentFrame(), dtMs);
    clearMovement();
    if (session !== before) onChange?.(session);
    if (busy()) ensureRunning();
    else lastMs = undefined;
  };

  function ensureRunning(): void {
    if (disposed || cancelFrame !== undefined) return;
    cancelFrame = schedule(tick);
  }

  const release = (pointerId: number): void => {
    try {
      element.releasePointerCapture?.(pointerId);
    } catch {
      // The browser may have released the capture already, on cancellation or on loss of focus.
    }
  };

  const onPointerDown = (event: NavEvent): void => {
    const id = event.pointerId ?? 0;
    const point = localPoint(event);
    const kind = pointerKind(event);
    modifiers = modifiersOf(event);
    pointers.set(id, { id, kind, ...point, dx: 0, dy: 0, buttons: mouseButtons(event.buttons ?? 0) });
    element.setPointerCapture?.(id);
    if (kind === 'touch') event.preventDefault?.();
    ensureRunning();
  };

  const onPointerMove = (event: NavEvent): void => {
    const id = event.pointerId ?? 0;
    const known = pointers.get(id);
    const point = localPoint(event);
    const kind = pointerKind(event);
    modifiers = modifiersOf(event);
    // A pointer this element never saw pressed is a hover, however the event describes its buttons.
    // That is what makes a move arriving after a cancelled or lost gesture harmless.
    const sample: PointerSample = known === undefined
      ? { id, kind, ...point, dx: 0, dy: 0, buttons: [] }
      : {
          id,
          kind,
          ...point,
          dx: known.dx + point.x - known.x,
          dy: known.dy + point.y - known.y,
          buttons: mouseButtons(event.buttons ?? 0),
        };
    pointers.set(id, sample);
    if (kind === 'touch') event.preventDefault?.();
    ensureRunning();
  };

  const onPointerEnd = (event: NavEvent): void => {
    const id = event.pointerId ?? 0;
    if (!pointers.delete(id)) return;
    release(id);
    ensureRunning();
  };

  // A hovering mouse that leaves is gone; a pressed one keeps its capture until it is released,
  // and a touch is only ever ended by its own up or cancel.
  const onPointerLeave = (event: NavEvent): void => {
    const known = pointers.get(event.pointerId ?? 0);
    if (known !== undefined && known.kind !== 'touch' && known.buttons.length === 0) {
      pointers.delete(known.id);
    }
  };

  const onWheel = (event: NavEvent): void => {
    modifiers = modifiersOf(event);
    wheel += wheelPixels(event.deltaY ?? 0, event.deltaMode ?? 0);
    event.preventDefault?.();
    ensureRunning();
  };

  const isBoundKey = (key: string): boolean =>
    session.nav.bindings.keys.some((binding) => normalizeKey(binding.key) === key);

  const onKeyDown = (event: NavEvent): void => {
    modifiers = modifiersOf(event);
    const key = normalizeKey(event.key ?? '');
    if (key === '') return;
    keys.add(key);
    // Only a key this view actually uses is kept from the page, so tab and the rest still work.
    if (isBoundKey(key)) event.preventDefault?.();
    ensureRunning();
  };

  const onKeyUp = (event: NavEvent): void => {
    modifiers = modifiersOf(event);
    keys.delete(normalizeKey(event.key ?? ''));
    ensureRunning();
  };

  // Losing focus stops everything the keyboard was doing, so a walk never carries on unwatched.
  const onBlur = (): void => {
    keys.clear();
    modifiers = [];
    ensureRunning();
  };

  const previousTouchAction = element.style?.touchAction;
  if (element.style !== undefined) element.style.touchAction = 'none';

  listen('pointerdown', onPointerDown);
  listen('pointermove', onPointerMove);
  listen('pointerup', onPointerEnd);
  listen('pointercancel', onPointerEnd);
  listen('lostpointercapture', onPointerEnd);
  listen('pointerleave', onPointerLeave);
  listen('wheel', onWheel);
  listen('contextmenu', (event) => event.preventDefault?.());
  listen('keydown', onKeyDown);
  listen('keyup', onKeyUp);
  listen('blur', onBlur);

  return {
    session: () => session,
    setSession: (next) => {
      session = next;
      ensureRunning();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      cancelFrame?.();
      cancelFrame = undefined;
      for (const [type, handler] of listeners) element.removeEventListener(type, handler);
      listeners.length = 0;
      for (const id of pointers.keys()) release(id);
      pointers.clear();
      keys.clear();
      if (element.style !== undefined && previousTouchAction !== undefined) {
        element.style.touchAction = previousTouchAction;
      }
    },
  };
};
