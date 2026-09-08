import { describe, expect, it } from 'vitest';
import {
  deleteObjects, editLayer, emptyDocument, formatPath, getSlice, integer, object, parse, putSlice,
  resolveStyles, setOf, stateSlice, string, styleComposition, styleOf, styleRule,
} from '../src/index.js';

// The examples in README.md, run, so the documentation cannot drift from the package.
describe('README examples', () => {
  it('validates and reports where the value was wrong', () => {
    const door = object({ id: string(), width: integer() });
    const read = parse(door, { id: 'D1', width: 'wide' });
    expect(read.ok).toBe(false);
    expect(read.diagnostics.map((item) => formatPath(item.path))).toEqual(['width']);
  });

  it('composes what the user sees', () => {
    const keys = ['a', 'b', 'c'];
    const layers = [editLayer('l1', 'Demolition', [deleteObjects(['a'])])];
    const rules = [styleRule('r1', 'Fire doors', ['b'], { color: [1, 0, 0] })];
    const resolved = resolveStyles(styleComposition(new Map(), layers, rules, setOf(['c'])), keys);
    expect(styleOf(resolved, 'b').color).toEqual([1, 0, 0]);
  });

  it('saves and reopens a feature state', () => {
    const clipping = stateSlice('clipping', 1, object({ planes: integer() }), { planes: 0 });
    const document = putSlice(emptyDocument(), clipping, { planes: 2 });
    expect(getSlice(document, clipping)).toEqual({ ok: true, value: { planes: 2 }, diagnostics: [] });
  });
});
