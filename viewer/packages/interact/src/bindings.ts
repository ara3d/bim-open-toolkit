import { diagnostic, resultOf, warning, type Diagnostic, type Result } from '@bim-open-toolkit/model';
import {
  hasModifiers,
  heldButton,
  normalizeKey,
  pointersOfKind,
  type InputFrame,
  type ModifierName,
  type MouseButton,
} from './input.js';

// How a view responds to input as a whole. The mode decides which actions apply, so it is part of
// the binding contract: a table is written for a mode and checked against it.
export type NavMode = 'orbit' | 'first-person' | 'overhead';

// Every navigation mode, in the order a user interface should offer them.
export const navModes: readonly NavMode[] = ['orbit', 'first-person', 'overhead'];

// What dragging does: swing around the target, slide the view, turn in place, or move closer.
export type DragAction = 'orbit' | 'pan' | 'look' | 'dolly';

// What turning the wheel does: move closer, scale an orthographic frame, or change walking speed.
export type WheelAction = 'dolly' | 'zoom' | 'speed' | 'none';

// What spreading two fingers does.
export type PinchAction = 'dolly' | 'zoom' | 'none';

// What holding a key does, on every step it stays held.
export type MoveAction = 'forward' | 'back' | 'left' | 'right' | 'rise' | 'fall' | 'boost';

// What a mouse or pen drag does for one button while those modifiers are held.
// A binding with more modifiers wins over one with fewer, so `shift` plus left can differ from left.
export type DragBinding = {
  readonly button: MouseButton;
  readonly modifiers: readonly ModifierName[];
  readonly action: DragAction;
};

// What a wheel turn does while those modifiers are held.
export type WheelBinding = {
  readonly modifiers: readonly ModifierName[];
  readonly action: WheelAction;
};

// What holding a key does. Keys are named as a keyboard event reports them, in lower case.
export type KeyBinding = {
  readonly key: string;
  readonly action: MoveAction;
};

// What dragging with exactly that many fingers does.
export type TouchBinding = {
  readonly pointers: number;
  readonly action: DragAction;
};

// The whole map from device input to navigation actions. Everything a user can rebind is here.
export type Bindings = {
  readonly drags: readonly DragBinding[];
  readonly wheel: readonly WheelBinding[];
  readonly keys: readonly KeyBinding[];
  readonly touch: readonly TouchBinding[];
  readonly pinch: PinchAction;
};

// Which actions a mode acts on. A binding for anything else is ignored by that mode, and
// `validateBindings` reports it as a warning rather than an error so one table can serve two modes.
export type SupportedActions = {
  readonly drag: readonly DragAction[];
  readonly wheel: readonly WheelAction[];
  readonly touch: readonly DragAction[];
  readonly pinch: readonly PinchAction[];
  readonly move: readonly MoveAction[];
};

// What each mode does with input. Overhead holds its orientation, so it never orbits or looks.
export const supportedActions: Readonly<Record<NavMode, SupportedActions>> = {
  orbit: {
    drag: ['orbit', 'pan', 'dolly'],
    wheel: ['dolly', 'zoom', 'none'],
    touch: ['orbit', 'pan'],
    pinch: ['dolly', 'zoom', 'none'],
    move: [],
  },
  'first-person': {
    drag: ['look', 'pan'],
    wheel: ['speed', 'dolly', 'none'],
    touch: ['look', 'pan'],
    pinch: ['dolly', 'none'],
    move: ['forward', 'back', 'left', 'right', 'rise', 'fall', 'boost'],
  },
  overhead: {
    drag: ['pan'],
    wheel: ['zoom', 'none'],
    touch: ['pan'],
    pinch: ['zoom', 'none'],
    move: ['forward', 'back', 'left', 'right'],
  },
};

// The bindings each mode starts with: the arrangement most desktop and touch viewers already use.
export const defaultBindings: Readonly<Record<NavMode, Bindings>> = {
  orbit: {
    drags: [
      { button: 'left', modifiers: ['shift'], action: 'pan' },
      { button: 'left', modifiers: [], action: 'orbit' },
      { button: 'right', modifiers: [], action: 'pan' },
      { button: 'middle', modifiers: [], action: 'dolly' },
    ],
    wheel: [{ modifiers: [], action: 'dolly' }],
    keys: [],
    touch: [
      { pointers: 1, action: 'orbit' },
      { pointers: 2, action: 'pan' },
    ],
    pinch: 'dolly',
  },
  'first-person': {
    drags: [
      { button: 'left', modifiers: [], action: 'look' },
      { button: 'right', modifiers: [], action: 'pan' },
    ],
    wheel: [{ modifiers: [], action: 'speed' }],
    keys: [
      { key: 'w', action: 'forward' },
      { key: 's', action: 'back' },
      { key: 'a', action: 'left' },
      { key: 'd', action: 'right' },
      { key: 'e', action: 'rise' },
      { key: 'q', action: 'fall' },
      { key: 'arrowup', action: 'forward' },
      { key: 'arrowdown', action: 'back' },
      { key: 'arrowleft', action: 'left' },
      { key: 'arrowright', action: 'right' },
      { key: 'shift', action: 'boost' },
    ],
    touch: [
      { pointers: 1, action: 'look' },
      { pointers: 2, action: 'pan' },
    ],
    pinch: 'dolly',
  },
  overhead: {
    drags: [
      { button: 'left', modifiers: [], action: 'pan' },
      { button: 'right', modifiers: [], action: 'pan' },
    ],
    wheel: [{ modifiers: [], action: 'zoom' }],
    keys: [
      { key: 'w', action: 'forward' },
      { key: 's', action: 'back' },
      { key: 'a', action: 'left' },
      { key: 'd', action: 'right' },
      { key: 'arrowup', action: 'forward' },
      { key: 'arrowdown', action: 'back' },
      { key: 'arrowleft', action: 'left' },
      { key: 'arrowright', action: 'right' },
    ],
    touch: [
      { pointers: 1, action: 'pan' },
      { pointers: 2, action: 'pan' },
    ],
    pinch: 'zoom',
  },
};

// A modifier set written the same way however it was ordered, so duplicates are comparable.
const modifierKey = (modifiers: readonly ModifierName[]): string => [...new Set(modifiers)].sort().join('+');

// The bindings whose modifiers are all held, most specific first.
const matching = <T extends { readonly modifiers: readonly ModifierName[] }>(
  candidates: readonly T[],
  frame: InputFrame,
): readonly T[] =>
  candidates
    .filter((binding) => hasModifiers(frame, binding.modifiers))
    .sort((a, b) => b.modifiers.length - a.modifiers.length);

// What the frame's drag should do, or undefined when nothing is pressed or nothing is bound.
// Touch decides by how many fingers are down; a mouse or pen decides by button and modifiers.
export const resolveDrag = (bindings: Bindings, frame: InputFrame): DragAction | undefined => {
  const touches = pointersOfKind(frame, 'touch');
  if (touches.length > 0) {
    return bindings.touch.find((binding) => binding.pointers === touches.length)?.action;
  }
  const button = heldButton(frame);
  return button === undefined
    ? undefined
    : matching(bindings.drags.filter((binding) => binding.button === button), frame)[0]?.action;
};

// What the frame's wheel movement should do, or undefined when the wheel did not move.
export const resolveWheel = (bindings: Bindings, frame: InputFrame): WheelAction | undefined =>
  frame.wheel === 0 ? undefined : matching(bindings.wheel, frame)[0]?.action;

// Which movements the held keys ask for, without repeats and in the order they are bound.
export const resolveMoves = (bindings: Bindings, frame: InputFrame): readonly MoveAction[] => [
  ...new Set(
    bindings.keys
      .filter((binding) => frame.keys.includes(normalizeKey(binding.key)))
      .map((binding) => binding.action),
  ),
];

// Reports every entry whose grouping key repeats, since only the first of them can ever apply.
const duplicates = <T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  code: string,
  field: string,
  describe: (item: T) => string,
): readonly Diagnostic[] => {
  const seen = new Set<string>();
  return items.flatMap((item, index) => {
    const key = keyOf(item);
    if (!seen.has(key)) {
      seen.add(key);
      return [];
    }
    return [diagnostic(code, `${describe(item)} is bound more than once; only the first applies`, [field, index])];
  });
};

// Reports an action the mode does not act on. It is a warning: one table can serve several modes.
const unsupported = (
  used: string,
  allowed: readonly string[],
  mode: NavMode,
  field: string,
  index: number | undefined,
): readonly Diagnostic[] =>
  allowed.includes(used)
    ? []
    : [
        warning(
          'binding.unsupported',
          `${mode} navigation ignores the ${used} action`,
          index === undefined ? [field] : [field, index],
        ),
      ];

// Checks a binding table for a mode and returns it with its key names normalised.
// Repeating a button, modifier set, key or finger count is an error, because only the first of
// them could ever apply. Binding an action the mode ignores is a warning, not an error.
export const validateBindings = (bindings: Bindings, mode: NavMode): Result<Bindings> => {
  const allowed = supportedActions[mode];
  const keys = bindings.keys.map((binding) => ({ ...binding, key: normalizeKey(binding.key) }));
  const normalized: Bindings = { ...bindings, keys };
  const diagnostics: readonly Diagnostic[] = [
    ...duplicates(
      bindings.drags,
      (binding) => `${binding.button}:${modifierKey(binding.modifiers)}`,
      'binding.duplicateDrag',
      'drags',
      (binding) => [...binding.modifiers, binding.button].join('+'),
    ),
    ...duplicates(bindings.wheel, (binding) => modifierKey(binding.modifiers), 'binding.duplicateWheel', 'wheel', () => 'the wheel'),
    ...duplicates(keys, (binding) => binding.key, 'binding.duplicateKey', 'keys', (binding) => `the ${binding.key} key`),
    ...duplicates(
      bindings.touch,
      (binding) => String(binding.pointers),
      'binding.duplicateTouch',
      'touch',
      (binding) => `${binding.pointers} finger drag`,
    ),
    ...bindings.touch.flatMap((binding, index) =>
      Number.isInteger(binding.pointers) && binding.pointers >= 1
        ? []
        : [diagnostic('binding.pointerCount', 'a touch binding needs a whole number of fingers, at least one', ['touch', index])],
    ),
    ...bindings.drags.flatMap((binding, index) => unsupported(binding.action, allowed.drag, mode, 'drags', index)),
    ...bindings.wheel.flatMap((binding, index) => unsupported(binding.action, allowed.wheel, mode, 'wheel', index)),
    ...keys.flatMap((binding, index) => unsupported(binding.action, allowed.move, mode, 'keys', index)),
    ...bindings.touch.flatMap((binding, index) => unsupported(binding.action, allowed.touch, mode, 'touch', index)),
    ...unsupported(bindings.pinch, allowed.pinch, mode, 'pinch', undefined),
  ];
  return resultOf(normalized, diagnostics);
};
