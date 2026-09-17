// Which kind of device a pointer belongs to. Touch is the only one that gestures with two points.
export type PointerKind = 'mouse' | 'pen' | 'touch';

// A mouse button, named the way a binding names it rather than by number.
export type MouseButton = 'left' | 'middle' | 'right';

// A modifier key a binding can require.
export type ModifierName = 'shift' | 'ctrl' | 'alt' | 'meta';

// The size of the picture the input happens over, in pixels.
export type Viewport = {
  readonly width: number;
  readonly height: number;
};

// One pointer as it stands at the end of a time step. Positions are pixels from the top-left of
// the element; `dx` and `dy` are how far it moved during the step, with y growing downward.
export type PointerSample = {
  readonly id: number;
  readonly kind: PointerKind;
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  readonly buttons: readonly MouseButton[];
};

// Everything the navigation reducers need from a device over one time step. It holds no DOM types,
// so a test writes one by hand and the DOM adapter is the only thing that has to build one.
// `wheel` accumulates wheel movement over the step, positive away from the user.
export type InputFrame = {
  readonly viewport: Viewport;
  readonly pointers: readonly PointerSample[];
  readonly modifiers: readonly ModifierName[];
  readonly keys: readonly string[];
  readonly wheel: number;
};

// A viewport whose height is at least one pixel, so a normalised delta never divides by zero.
export const safeViewport = (viewport: Viewport): Viewport => ({
  width: Math.max(viewport.width, 1),
  height: Math.max(viewport.height, 1),
});

// Viewport width over height, never zero or negative.
export const aspectOf = (viewport: Viewport): number => {
  const safe = safeViewport(viewport);
  return safe.width / safe.height;
};

// A frame in which nothing is happening.
export const emptyFrame = (viewport: Viewport): InputFrame => ({
  viewport,
  pointers: [],
  modifiers: [],
  keys: [],
  wheel: 0,
});

// True when nothing is pressed, moving or turning, so a caller can stop stepping.
export const isIdle = (frame: InputFrame): boolean =>
  frame.pointers.length === 0 && frame.keys.length === 0 && frame.wheel === 0;

// True when a pointer is actually pressed. A hovering mouse still reports a pointer, with no
// buttons held, and must not be mistaken for a drag; a touch counts as pressed by existing.
export const isDragging = (frame: InputFrame): boolean =>
  frame.pointers.some((pointer) => pointer.kind === 'touch' || pointer.buttons.length > 0);

// The frame with all movement removed, which is what the next step starts from.
export const restFrame = (frame: InputFrame): InputFrame => ({
  ...frame,
  pointers: frame.pointers.map((pointer) => ({ ...pointer, dx: 0, dy: 0 })),
  wheel: 0,
});

// True when every named modifier is held. An empty requirement is met by any frame.
export const hasModifiers = (frame: InputFrame, required: readonly ModifierName[]): boolean =>
  required.every((name) => frame.modifiers.includes(name));

// True when the key is held. Keys are compared in lower case, as `normalizeKey` writes them.
export const isKeyDown = (frame: InputFrame, key: string): boolean => frame.keys.includes(normalizeKey(key));

// A key name in the form the input record uses: the lower case of what a keyboard event reports,
// so `Shift`, `shift`, `A` and `a` each name one key.
export const normalizeKey = (key: string): string => key.toLowerCase();

// The buttons a `PointerEvent.buttons` bit mask names, in a stable order.
export const mouseButtons = (mask: number): readonly MouseButton[] => {
  const held: MouseButton[] = [];
  if ((mask & 1) !== 0) held.push('left');
  if ((mask & 2) !== 0) held.push('right');
  if ((mask & 4) !== 0) held.push('middle');
  return held;
};

// The button a drag binding should be resolved against: the first one held by any pointer.
export const heldButton = (frame: InputFrame): MouseButton | undefined =>
  frame.pointers.flatMap((pointer) => [...pointer.buttons])[0];

// The pointers of one kind.
export const pointersOfKind = (frame: InputFrame, kind: PointerKind): readonly PointerSample[] =>
  frame.pointers.filter((pointer) => pointer.kind === kind);

// How far the pointers moved together during the step, in pixels: the average of their movements,
// which is the movement of their midpoint. No pointers means no movement.
export const dragDelta = (pointers: readonly PointerSample[]): { readonly dx: number; readonly dy: number } =>
  pointers.length === 0
    ? { dx: 0, dy: 0 }
    : {
        dx: pointers.reduce((sum, pointer) => sum + pointer.dx, 0) / pointers.length,
        dy: pointers.reduce((sum, pointer) => sum + pointer.dy, 0) / pointers.length,
      };

// The distance between the two pointers furthest apart, in pixels.
const spread = (points: readonly { readonly x: number; readonly y: number }[]): number => {
  const distances = points.flatMap((a, index) =>
    points.slice(index + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y)),
  );
  return distances.length === 0 ? 0 : Math.max(...distances);
};

// How much the pointers spread apart during the step, as a ratio of the distance between them.
// Above one means the fingers moved apart, which is the gesture for looking closer. Fewer than two
// pointers, or a gesture that started from a single point, gives one: no change.
export const pinchScale = (pointers: readonly PointerSample[]): number => {
  if (pointers.length < 2) return 1;
  const before = spread(pointers.map((pointer) => ({ x: pointer.x - pointer.dx, y: pointer.y - pointer.dy })));
  const after = spread(pointers);
  return before === 0 || after === 0 ? 1 : after / before;
};

// A pixel distance as a fraction of the viewport height, so navigation feels the same at any size.
export const normalizedDrag = (pixels: number, viewport: Viewport): number => pixels / safeViewport(viewport).height;
