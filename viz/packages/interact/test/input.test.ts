import { describe, expect, it } from 'vitest';
import {
  aspectOf,
  dragDelta,
  emptyFrame,
  hasModifiers,
  heldButton,
  isDragging,
  isIdle,
  isKeyDown,
  mouseButtons,
  normalizeKey,
  normalizedDrag,
  pinchScale,
  pointersOfKind,
  restFrame,
  safeViewport,
  type InputFrame,
  type PointerSample,
  type Viewport,
} from '../src/input.js';

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

describe('viewport', () => {
  it('never reports a zero size or aspect', () => {
    expect(safeViewport({ width: 0, height: 0 })).toEqual({ width: 1, height: 1 });
    expect(aspectOf({ width: 0, height: 0 })).toBe(1);
    expect(aspectOf(viewport)).toBe(2);
  });

  it('measures a drag as a fraction of the viewport height', () => {
    expect(normalizedDrag(200, viewport)).toBe(0.5);
    expect(normalizedDrag(200, { width: 10, height: 0 })).toBe(200);
  });
});

describe('frame state', () => {
  it('an empty frame is idle and is not a drag', () => {
    expect(isIdle(emptyFrame(viewport))).toBe(true);
    expect(isDragging(emptyFrame(viewport))).toBe(false);
  });

  it('a wheel turn, a held key or a pointer all make a frame busy', () => {
    expect(isIdle(frame({ wheel: -1 }))).toBe(false);
    expect(isIdle(frame({ keys: ['w'] }))).toBe(false);
    expect(isIdle(frame({ pointers: [pointer({ id: 1 })] }))).toBe(false);
  });

  it('a hovering mouse is not a drag but a pressed one is', () => {
    const hovering = frame({ pointers: [pointer({ id: 1, kind: 'mouse' })] });
    expect(isDragging(hovering)).toBe(false);
    expect(isDragging(frame({ pointers: [pointer({ id: 1, kind: 'mouse', buttons: ['left'] })] }))).toBe(true);
  });

  it('a touch counts as a drag by existing', () => {
    expect(isDragging(frame({ pointers: [pointer({ id: 1 })] }))).toBe(true);
  });

  it('coming to rest clears movement but keeps what is held', () => {
    const busy = frame({ pointers: [pointer({ id: 1, x: 5, dx: 5, dy: 2 })], wheel: 3, keys: ['w'] });
    const rested = restFrame(busy);
    expect(rested.wheel).toBe(0);
    expect(rested.pointers[0]).toEqual(pointer({ id: 1, x: 5 }));
    expect(rested.keys).toEqual(['w']);
  });
});

describe('modifiers, keys and buttons', () => {
  it('requires every named modifier and accepts an empty requirement', () => {
    const shifted = frame({ modifiers: ['shift', 'alt'] });
    expect(hasModifiers(shifted, [])).toBe(true);
    expect(hasModifiers(shifted, ['shift'])).toBe(true);
    expect(hasModifiers(shifted, ['shift', 'alt'])).toBe(true);
    expect(hasModifiers(shifted, ['ctrl'])).toBe(false);
  });

  it('compares keys in lower case', () => {
    expect(normalizeKey('Shift')).toBe('shift');
    expect(isKeyDown(frame({ keys: ['w'] }), 'W')).toBe(true);
    expect(isKeyDown(frame({ keys: ['w'] }), 's')).toBe(false);
  });

  it('reads the pointer button mask the way the DOM writes it', () => {
    expect(mouseButtons(0)).toEqual([]);
    expect(mouseButtons(1)).toEqual(['left']);
    expect(mouseButtons(2)).toEqual(['right']);
    expect(mouseButtons(4)).toEqual(['middle']);
    expect(mouseButtons(3)).toEqual(['left', 'right']);
  });

  it('reports the first held button and nothing when none is held', () => {
    expect(heldButton(frame({ pointers: [pointer({ id: 1, kind: 'mouse', buttons: ['right'] })] }))).toBe('right');
    expect(heldButton(frame({ pointers: [pointer({ id: 1, kind: 'mouse' })] }))).toBeUndefined();
    expect(heldButton(emptyFrame(viewport))).toBeUndefined();
  });

  it('selects pointers by kind', () => {
    const mixed = frame({
      pointers: [pointer({ id: 1, kind: 'mouse' }), pointer({ id: 2 }), pointer({ id: 3 })],
    });
    expect(pointersOfKind(mixed, 'touch').map((p) => p.id)).toEqual([2, 3]);
    expect(pointersOfKind(mixed, 'pen')).toEqual([]);
  });
});

describe('dragDelta', () => {
  it('is the movement of the midpoint of the pointers', () => {
    expect(dragDelta([])).toEqual({ dx: 0, dy: 0 });
    expect(dragDelta([pointer({ id: 1, dx: 10, dy: -4 })])).toEqual({ dx: 10, dy: -4 });
    expect(dragDelta([pointer({ id: 1, dx: 10, dy: 0 }), pointer({ id: 2, dx: 0, dy: 4 })])).toEqual({
      dx: 5,
      dy: 2,
    });
  });

  it('cancels out when two pointers move apart in opposite directions', () => {
    expect(dragDelta([pointer({ id: 1, dx: -6 }), pointer({ id: 2, x: 100, dx: 6 })])).toEqual({ dx: 0, dy: 0 });
  });
});

describe('pinchScale', () => {
  it('is one for fewer than two pointers', () => {
    expect(pinchScale([])).toBe(1);
    expect(pinchScale([pointer({ id: 1, dx: 20 })])).toBe(1);
  });

  it('is above one when the fingers move apart and below when they close', () => {
    const apart = [pointer({ id: 1, x: 0, dx: 0 }), pointer({ id: 2, x: 200, dx: 100 })];
    expect(pinchScale(apart)).toBeCloseTo(2);
    const together = [pointer({ id: 1, x: 0, dx: 0 }), pointer({ id: 2, x: 50, dx: -50 })];
    expect(pinchScale(together)).toBeCloseTo(0.5);
  });

  it('is one when the fingers move together without spreading', () => {
    expect(pinchScale([pointer({ id: 1, x: 0, dx: 7 }), pointer({ id: 2, x: 60, dx: 7 })])).toBeCloseTo(1);
  });

  it('is one when a gesture starts from a single point', () => {
    expect(pinchScale([pointer({ id: 1, x: 0, dx: 0 }), pointer({ id: 2, x: 30, dx: 30 })])).toBe(1);
  });
});
