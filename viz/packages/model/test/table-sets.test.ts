import { describe, expect, it } from 'vitest';
import {
  columnOf, emptySet, f32Column, i32Column, objectKey, objectRef, rowsInSet, setOf, setKeys, setOfRows,
  stringColumn, table, type ModelRef,
} from '../src/index.js';

const model: ModelRef = { id: 'tower', revision: '1' };
const keys = ['slab-1', 'door-1', 'door-2', 'door-3'].map((id) => objectKey(objectRef(model, id)));
const keyAt = (index: number): string => keys[index] ?? '';

// A schedule keyed by object key, and an instance table keyed by the object's row in the model.
const schedule = table([
  ['objectKey', stringColumn([keyAt(1), keyAt(2), keyAt(3)])],
  ['width', f32Column([0.9, 1.2, 0.8])],
]);
const instances = table([
  ['objectIndex', i32Column([0, 1, 2, 3])],
  ['meshIndex', i32Column([0, 1, 1, 1])],
]);

describe('rowsInSet', () => {
  it('keeps the rows a string key column names', () => {
    const kept = rowsInSet(schedule, 'objectKey', setOf([keyAt(3), keyAt(1)]));
    expect(kept.rowCount).toBe(2);
    expect(columnOf(kept, 'objectKey')?.values).toEqual([keyAt(1), keyAt(3)]);
  });

  it('keeps the rows an integer key column names, read against the model object keys', () => {
    const kept = rowsInSet(instances, 'objectIndex', setOf([keyAt(2)]), keys);
    expect(kept.rowCount).toBe(1);
    expect(columnOf(kept, 'objectIndex')?.values).toEqual(Int32Array.from([2]));
  });

  it('keeps nothing for an empty set, an unknown key or a key column of the wrong kind', () => {
    expect(rowsInSet(schedule, 'objectKey', emptySet).rowCount).toBe(0);
    expect(rowsInSet(schedule, 'objectKey', setOf(['not-a-key'])).rowCount).toBe(0);
    expect(rowsInSet(instances, 'objectIndex', setOf([keyAt(2)])).rowCount).toBe(0);
    expect(rowsInSet(schedule, 'width', setOf([keyAt(1)])).rowCount).toBe(0);
    expect(rowsInSet(schedule, 'missing', setOf([keyAt(1)])).rowCount).toBe(0);
  });

  it('keeps every column of the table it filtered', () => {
    const kept = rowsInSet(schedule, 'objectKey', setOf([keyAt(2)]));
    expect(columnOf(kept, 'width')?.values).toEqual(Float32Array.from([1.2]));
  });
});

describe('setOfRows', () => {
  it('reads a string key column back into a set', () => {
    expect(setKeys(setOfRows(schedule, 'objectKey'))).toEqual([keyAt(1), keyAt(2), keyAt(3)]);
  });

  it('reads an integer key column back through the model object keys', () => {
    expect(setKeys(setOfRows(instances, 'objectIndex', keys))).toEqual(keys);
  });

  it('reads back exactly what rowsInSet selects', () => {
    const wanted = setOf([keyAt(1), keyAt(3)]);
    expect(setOfRows(rowsInSet(schedule, 'objectKey', wanted), 'objectKey')).toEqual(wanted);
  });

  it('gives the empty set for a key column it cannot read', () => {
    expect(setOfRows(instances, 'objectIndex')).toBe(emptySet);
    expect(setOfRows(schedule, 'width')).toBe(emptySet);
    expect(setOfRows(schedule, 'missing')).toBe(emptySet);
  });

  it('reads only the rows the table has, when a column is longer than the table', () => {
    const ragged = table([['objectKey', stringColumn(keys)], ['width', f32Column([0.9])]]);
    expect(ragged.rowCount).toBe(1);
    expect(setKeys(setOfRows(ragged, 'objectKey'))).toEqual([keyAt(0)]);
  });
});
