import { describe, expect, it } from 'vitest';
import { composeEdits, commitEditHistory, createEditHistory, redoEditHistory, undoEditHistory } from '../src/edits.js';
import { identityMatrix, type EditLayer, type ObjectRecord } from '../src/contracts.js';

const object = (modelId: string): ObjectRecord => ({ ref: { modelId, objectId: '1' }, transform: identityMatrix, appearance: { color: [1, 0, 0], opacity: 1, visible: true } });
const a = object('a');
const b = object('b');
const layer = (operations: EditLayer['operations'], enabled = true): EditLayer => ({ id: 'layer', enabled, operations });

describe('edit composition', () => {
  it('handles all operations in order without base mutation and permits deliberate edit visibility', () => {
    const base = [a];
    const before = structuredClone(base);
    const translated = [...identityMatrix] as unknown as number[];
    translated[12] = 2;
    const transform = translated as unknown as ObjectRecord['transform'];
    const result = composeEdits(base, [layer([
      { kind: 'add', object: b }, { kind: 'transform', ref: a.ref, transform },
      { kind: 'style', ref: a.ref, style: { visible: false } },
      { kind: 'style', ref: a.ref, style: { visible: true, opacity: 0.25 } },
    ]), layer([{ kind: 'delete', ref: a.ref }], false)]);
    expect(result.objects).toHaveLength(2);
    expect(result.objects[0]!.transform[12]).toBe(2);
    expect(result.objects[0]!.appearance).toEqual({ color: [1, 0, 0], opacity: 0.25, visible: true });
    expect(result.diagnostics).toEqual([]);
    expect(base).toEqual(before);
  });
  it('retains first duplicates and diagnoses unknown refs and tombstone conflicts', () => {
    const result = composeEdits([a, a], [layer([
      { kind: 'add', object: a }, { kind: 'delete', ref: b.ref },
      { kind: 'delete', ref: a.ref }, { kind: 'add', object: a },
      { kind: 'style', ref: a.ref, style: { visible: true } },
    ])]);
    expect(result.objects).toEqual([]);
    expect(result.tombstones).toEqual([a.ref]);
    expect(result.diagnostics.map(d => d.code)).toEqual(['duplicate-object', 'duplicate-object', 'unknown-object', 'deleted-object', 'deleted-object']);
  });
});

it('undoes and redoes whole transactions, snapshots caller data and clears redo after branching', () => {
  const start = createEditHistory();
  expect(undoEditHistory(start)).toBe(start);
  const operations = [{ kind: 'add' as const, object: a }];
  const first = commitEditHistory(start, [layer(operations)]);
  operations.length = 0;
  expect(first.present[0]!.operations).toHaveLength(1);
  const second = commitEditHistory(first, [layer([{ kind: 'delete', ref: a.ref }])]);
  const undone = undoEditHistory(second);
  expect(undone.present).toEqual(first.present);
  expect(redoEditHistory(undone).present).toEqual(second.present);
  const branch = commitEditHistory(undone, []);
  expect(redoEditHistory(branch)).toBe(branch);
  expect(start.present).toEqual([]);
});
