import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { Emitter } from '../src/emitter.js';
import { Selection, SelectedInstance } from '../src/selection.js';
import { PickControls } from '../src/pick-controls.js';
import { PickHit } from '../src/pick.js';
import { FakeElement, quadGroupAt } from './helpers.js';

describe('Emitter', () => {
  it('delivers to listeners and unsubscribes', () => {
    const e = new Emitter<number>();
    const seen: number[] = [];
    const off = e.on((v) => seen.push(v));
    e.emit(1);
    off();
    e.emit(2);
    expect(seen).toEqual([1]);
    expect(e.listenerCount).toBe(0);
  });
});

describe('Selection', () => {
  it('emits changed only on actual change', () => {
    const selection = new Selection();
    const events: Array<SelectedInstance | null> = [];
    selection.changed.on((s) => events.push(s));

    const group = quadGroupAt([[0, 0, 0]]);
    selection.select({ group, instanceIndex: 0 });
    selection.select({ group, instanceIndex: 0 }); // same -> no event
    selection.select({ group, instanceIndex: 0 + 0 }); // equal by value -> no event
    selection.clear();
    selection.clear(); // already empty -> no event

    expect(events.length).toBe(2);
    expect(events[0]).toEqual({ group, instanceIndex: 0 });
    expect(events[1]).toBeNull();
    expect(selection.isEmpty).toBe(true);
  });
});

describe('PickControls', () => {
  const camera = new PerspectiveCamera();

  const makePicker = (hit: PickHit | null) => {
    const calls: Array<[number, number]> = [];
    return {
      calls,
      pick: (_c: PerspectiveCamera, x: number, y: number) => {
        calls.push([x, y]);
        return hit;
      },
    };
  };

  it('selects on click and clears on empty click', () => {
    const group = quadGroupAt([[0, 0, 0]]);
    const hit: PickHit = { group, instanceIndex: 0, distance: 1, point: new Vector3() };
    const selection = new Selection();
    const picker = makePicker(hit);
    const controls = new PickControls(picker, selection, () => camera);
    const el = new FakeElement();
    controls.attach(el);

    el.dispatch('pointerdown', { button: 0, clientX: 50, clientY: 50 });
    el.dispatch('pointerup', { button: 0, clientX: 51, clientY: 51 });
    expect(selection.current).toEqual({ group, instanceIndex: 0 });
    // click at the viewport center maps to ndc ~(0,0)
    expect(picker.calls[0][0]).toBeCloseTo(0.02);
    expect(picker.calls[0][1]).toBeCloseTo(-0.02);

    const empty = new PickControls(makePicker(null), selection, () => camera);
    const el2 = new FakeElement();
    empty.attach(el2);
    el2.dispatch('pointerdown', { button: 0, clientX: 10, clientY: 10 });
    el2.dispatch('pointerup', { button: 0, clientX: 10, clientY: 10 });
    expect(selection.current).toBeNull();
  });

  it('does not pick after a drag beyond the threshold', () => {
    const selection = new Selection();
    const picker = makePicker(null);
    const controls = new PickControls(picker, selection, () => camera);
    const el = new FakeElement();
    controls.attach(el);
    el.dispatch('pointerdown', { button: 0, clientX: 0, clientY: 0 });
    el.dispatch('pointerup', { button: 0, clientX: 50, clientY: 0 });
    expect(picker.calls.length).toBe(0);
  });

  it('removes listeners on dispose', () => {
    const controls = new PickControls(makePicker(null), new Selection(), () => camera);
    const el = new FakeElement();
    controls.attach(el);
    controls.dispose();
    expect(el.listenerCount()).toBe(0);
  });
});
