import { describe, expect, it, vi } from 'vitest';
import { createNamedSet, intersectRefs, SelectionStore, subtractRefs, unionRefs, uniqueRefs } from '../src/selection.js';

const a = { modelId: 'a', objectId: '1' }, b = { modelId: 'b', objectId: '1' }, c = { modelId: 'a', objectId: '2' };

describe('reference sets', () => {
  it('uses structural keys, preserves model scope and avoids delimiter collisions', () => {
    expect(uniqueRefs([a, { ...a }, b])).toEqual([a, b]);
    expect(uniqueRefs([{ modelId: 'a:b', objectId: 'c' }, { modelId: 'a', objectId: 'b:c' }])).toHaveLength(2);
    expect(unionRefs([a, b], [b, c])).toEqual([a, b, c]);
    expect(intersectRefs([a, b, a], [b])).toEqual([b]);
    expect(subtractRefs([a, b, c], [b])).toEqual([a, c]);
    const named = createNamedSet('s', 'Set', [a, a]);
    expect(named.members).toEqual([a]);
    expect(Object.isFrozen(named.members[0])).toBe(true);
    expect(Object.isFrozen(a)).toBe(false);
  });
});

describe('SelectionStore', () => {
  it('emits once per actual membership change and ignores reorder and duplicate inputs', () => {
    const store = new SelectionStore([a]); const listener = vi.fn(); const unsubscribe = store.subscribe(listener);
    const initial = store.snapshot();
    expect(store.replace([{ ...a }, a])).toBe(false);
    expect(store.snapshot()).toBe(initial);
    expect(store.add([a, b, b])).toBe(true);
    expect(store.replace([b, a])).toBe(false);
    expect(store.remove([c])).toBe(false);
    expect(store.toggle([a, a, c, c])).toBe(true);
    expect(store.snapshot()).toEqual([b, c]);
    expect(initial).toEqual([a]);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe(); store.replace([]);
    expect(listener).toHaveBeenCalledTimes(2);
  });
  it('releases listeners and selection on disposal', () => {
    const store = new SelectionStore([a]); const listener = vi.fn(); store.subscribe(listener);
    store.dispose(); store.dispose();
    expect(store.snapshot()).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
    expect(() => store.add([b])).toThrow('disposed');
    expect(() => store.subscribe(listener)).toThrow('disposed');
  });
});
