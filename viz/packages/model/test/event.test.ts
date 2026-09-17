import { describe, expect, it } from 'vitest';
import {
  changeEvent, changedSlices, didChange, disposable, disposeAll, noDisposal, onSlices,
  type ChangeEvent,
} from '../src/event.js';
import { warning } from '../src/result.js';

describe('disposal', () => {
  it('runs its work once however many times it is disposed', () => {
    let runs = 0;
    const item = disposable(() => {
      runs += 1;
    });
    item.dispose();
    item.dispose();
    expect(runs).toBe(1);
  });

  it('disposes a group in order', () => {
    const order: string[] = [];
    disposeAll([disposable(() => order.push('a')), disposable(() => order.push('b'))]).dispose();
    expect(order).toEqual(['a', 'b']);
  });

  it('has a disposal that does nothing, for a feature with no hook', () => {
    expect(() => noDisposal.dispose()).not.toThrow();
  });
});

describe('change events', () => {
  it('reports what one command changed', () => {
    const event = changeEvent('sets.select', ['selection'], [warning('x/w', 'w')]);
    expect(didChange(event, 'selection')).toBe(true);
    expect(didChange(event, 'clipping')).toBe(false);
    expect(event.diagnostics).toHaveLength(1);
  });

  it('finds the slices whose value is not the same object as before', () => {
    const shared = { count: 1 };
    const before = new Map<string, unknown>([['a', shared], ['b', { count: 1 }]]);
    const after = new Map<string, unknown>([['a', shared], ['b', { count: 1 }], ['c', {}]]);
    expect(changedSlices(before, after)).toEqual(['b', 'c']);
    expect(changedSlices(before, before)).toEqual([]);
  });

  it('reports a slice that was removed as changed', () => {
    expect(changedSlices(new Map([['a', 1]]), new Map())).toEqual(['a']);
  });

  it('calls a listener only for the slices it asked about', () => {
    const seen: string[] = [];
    const listener = onSlices(['selection'], (event: ChangeEvent) => seen.push(event.command));
    listener(changeEvent('a', ['clipping']));
    listener(changeEvent('b', ['selection', 'clipping']));
    expect(seen).toEqual(['b']);
  });
});
