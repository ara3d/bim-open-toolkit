import { describe, expect, it } from 'vitest';
import { hasErrors, type Result } from '@bim-open-toolkit/model';
import {
  emptyFrame,
  type InputFrame,
  type ModifierName,
  type MouseButton,
  type PointerSample,
  type Viewport,
} from '../src/input.js';
import {
  defaultBindings,
  navModes,
  resolveDrag,
  resolveMoves,
  resolveWheel,
  supportedActions,
  validateBindings,
  type Bindings,
} from '../src/bindings.js';

const viewport: Viewport = { width: 800, height: 400 };

const pointer = (fields: Partial<PointerSample> & { readonly id: number }): PointerSample => ({
  kind: 'touch',
  x: 0,
  y: 0,
  dx: 0,
  dy: 0,
  buttons: [],
  ...fields,
});

const frame = (fields: Partial<InputFrame> = {}): InputFrame => ({ ...emptyFrame(viewport), ...fields });

const mouse = (buttons: readonly MouseButton[], modifiers: readonly ModifierName[] = []): InputFrame =>
  frame({ modifiers, pointers: [pointer({ id: 1, kind: 'mouse', buttons })] });

const touches = (count: number): InputFrame =>
  frame({ pointers: Array.from({ length: count }, (_unused, index) => pointer({ id: index })) });

const codes = (result: Result<Bindings>): readonly string[] => result.diagnostics.map((item) => item.code);

describe('default bindings', () => {
  it('are valid for their own mode with nothing to report', () => {
    for (const mode of navModes) {
      const result = validateBindings(defaultBindings[mode], mode);
      expect(result.ok).toBe(true);
      expect(result.diagnostics).toEqual([]);
    }
  });

  it('bind only actions their mode acts on', () => {
    for (const mode of navModes) {
      const allowed = supportedActions[mode];
      expect(defaultBindings[mode].drags.every((b) => allowed.drag.includes(b.action))).toBe(true);
      expect(defaultBindings[mode].keys.every((b) => allowed.move.includes(b.action))).toBe(true);
    }
  });

  it('never let overhead navigation turn the view', () => {
    expect(supportedActions.overhead.drag).not.toContain('orbit');
    expect(supportedActions.overhead.drag).not.toContain('look');
    expect(supportedActions.overhead.touch).toEqual(['pan']);
  });
});

describe('validateBindings', () => {
  const orbit = defaultBindings.orbit;

  it('rejects a button and modifier set bound twice, whatever the modifier order', () => {
    const result = validateBindings(
      {
        ...orbit,
        drags: [
          { button: 'left', modifiers: ['shift', 'alt'], action: 'pan' },
          { button: 'left', modifiers: ['alt', 'shift'], action: 'dolly' },
        ],
      },
      'orbit',
    );
    expect(result.ok).toBe(false);
    expect(codes(result)).toEqual(['binding.duplicateDrag']);
  });

  it('accepts the same action on different buttons', () => {
    expect(validateBindings(defaultBindings.overhead, 'overhead').ok).toBe(true);
  });

  it('rejects a key bound twice, ignoring case', () => {
    const result = validateBindings(
      { ...defaultBindings['first-person'], keys: [{ key: 'W', action: 'forward' }, { key: 'w', action: 'back' }] },
      'first-person',
    );
    expect(codes(result)).toEqual(['binding.duplicateKey']);
    expect(result.ok).toBe(false);
  });

  it('rejects a finger count bound twice or bound to no fingers', () => {
    expect(
      codes(validateBindings({ ...orbit, touch: [{ pointers: 1, action: 'orbit' }, { pointers: 1, action: 'pan' }] }, 'orbit')),
    ).toEqual(['binding.duplicateTouch']);
    expect(
      codes(validateBindings({ ...orbit, touch: [{ pointers: 0, action: 'pan' }] }, 'orbit')),
    ).toEqual(['binding.pointerCount']);
    expect(
      codes(validateBindings({ ...orbit, touch: [{ pointers: 1.5, action: 'pan' }] }, 'orbit')),
    ).toEqual(['binding.pointerCount']);
  });

  it('rejects the wheel bound twice for the same modifiers', () => {
    const result = validateBindings(
      { ...orbit, wheel: [{ modifiers: [], action: 'dolly' }, { modifiers: [], action: 'zoom' }] },
      'orbit',
    );
    expect(codes(result)).toEqual(['binding.duplicateWheel']);
  });

  it('warns without failing when a mode ignores an action', () => {
    const result = validateBindings(defaultBindings.orbit, 'overhead');
    expect(result.ok).toBe(true);
    expect(new Set(codes(result))).toEqual(new Set(['binding.unsupported']));
    expect(hasErrors(result.diagnostics)).toBe(false);
    expect(result.diagnostics.map((item) => item.path)).toContainEqual(['drags', 1]);
  });

  it('addresses each problem at its place in the table', () => {
    const result = validateBindings({ ...defaultBindings['first-person'], pinch: 'zoom' }, 'first-person');
    expect(result.diagnostics.map((item) => item.path)).toEqual([['pinch']]);
  });

  it('returns the table with its key names in lower case', () => {
    const result = validateBindings(
      { ...defaultBindings['first-person'], keys: [{ key: 'ArrowUp', action: 'forward' }] },
      'first-person',
    );
    expect(result.ok && result.value.keys[0]?.key).toBe('arrowup');
  });
});

describe('resolveDrag', () => {
  const orbit = defaultBindings.orbit;

  it('reads the button that is held', () => {
    expect(resolveDrag(orbit, mouse(['left']))).toBe('orbit');
    expect(resolveDrag(orbit, mouse(['right']))).toBe('pan');
    expect(resolveDrag(orbit, mouse(['middle']))).toBe('dolly');
  });

  it('prefers the binding with more modifiers', () => {
    expect(resolveDrag(orbit, mouse(['left'], ['shift']))).toBe('pan');
    expect(resolveDrag(orbit, mouse(['left'], ['alt']))).toBe('orbit');
  });

  it('has nothing to do while nothing is pressed', () => {
    expect(resolveDrag(orbit, emptyFrame(viewport))).toBeUndefined();
    expect(resolveDrag(orbit, mouse([]))).toBeUndefined();
  });

  it('reads the number of fingers for touch, and ignores counts that are not bound', () => {
    expect(resolveDrag(orbit, touches(1))).toBe('orbit');
    expect(resolveDrag(orbit, touches(2))).toBe('pan');
    expect(resolveDrag(orbit, touches(3))).toBeUndefined();
  });

  it('lets a rebound table change what a drag does', () => {
    const rebound: Bindings = { ...orbit, drags: [{ button: 'left', modifiers: [], action: 'pan' }] };
    expect(resolveDrag(rebound, mouse(['left']))).toBe('pan');
    expect(resolveDrag(rebound, mouse(['right']))).toBeUndefined();
  });
});

describe('resolveWheel', () => {
  it('is silent when the wheel did not move', () => {
    expect(resolveWheel(defaultBindings.orbit, emptyFrame(viewport))).toBeUndefined();
  });

  it('reads the mode default and the most specific modifiers', () => {
    expect(resolveWheel(defaultBindings.orbit, frame({ wheel: 1 }))).toBe('dolly');
    expect(resolveWheel(defaultBindings.overhead, frame({ wheel: -1 }))).toBe('zoom');
    const table: Bindings = {
      ...defaultBindings.orbit,
      wheel: [{ modifiers: [], action: 'dolly' }, { modifiers: ['ctrl'], action: 'zoom' }],
    };
    expect(resolveWheel(table, frame({ wheel: 1, modifiers: ['ctrl'] }))).toBe('zoom');
    expect(resolveWheel(table, frame({ wheel: 1 }))).toBe('dolly');
  });
});

describe('resolveMoves', () => {
  const walk = defaultBindings['first-person'];

  it('reports one action per held key', () => {
    expect(resolveMoves(walk, frame({ keys: ['w', 'd'] }))).toEqual(['forward', 'right']);
  });

  it('reports an action once when two keys ask for it', () => {
    expect(resolveMoves(walk, frame({ keys: ['w', 'arrowup'] }))).toEqual(['forward']);
  });

  it('ignores keys that are not bound', () => {
    expect(resolveMoves(walk, frame({ keys: ['z'] }))).toEqual([]);
    expect(resolveMoves(defaultBindings.orbit, frame({ keys: ['w'] }))).toEqual([]);
  });

  it('reports the boost key alongside the movement', () => {
    expect(resolveMoves(walk, frame({ keys: ['w', 'shift'] }))).toEqual(['forward', 'boost']);
  });
});
