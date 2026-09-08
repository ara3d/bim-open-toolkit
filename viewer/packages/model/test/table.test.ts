import { describe, expect, it } from 'vitest';
import {
  boolColumn, cellAt, columnLength, columnNames, columnOf, emptyTable, f32Column, f64Column, i32Column,
  isIntegerColumn, isNumericColumn, numberAt, numericColumnOf, stringAt, stringColumn, table, u32Column,
} from '../src/table.js';

const doors = table([
  ['width', f32Column([0.9, 1.2, 0.8])],
  ['storey', i32Column([0, 1, 1])],
  ['name', stringColumn(['D1', 'D2', 'D3'])],
]);

describe('table', () => {
  it('stores each column in the storage its type implies', () => {
    expect(f32Column([1]).values).toBeInstanceOf(Float32Array);
    expect(f64Column([1]).values).toBeInstanceOf(Float64Array);
    expect(i32Column([1]).values).toBeInstanceOf(Int32Array);
    expect(u32Column([1]).values).toBeInstanceOf(Uint32Array);
    expect(boolColumn([true, false]).values).toEqual(Uint8Array.from([1, 0]));
    expect(stringColumn(['a']).values).toEqual(['a']);
  });

  it('takes the row count from the shortest column so every row index is valid', () => {
    expect(doors.rowCount).toBe(3);
    expect(table([['a', i32Column([1, 2])], ['b', i32Column([1])]]).rowCount).toBe(1);
    expect(emptyTable.rowCount).toBe(0);
  });

  it('reads cells and reports rows outside the column', () => {
    const width = columnOf(doors, 'width');
    expect(width === undefined ? undefined : cellAt(width, 1)).toBeCloseTo(1.2);
    expect(width === undefined ? undefined : cellAt(width, 9)).toBeUndefined();
    expect(cellAt(boolColumn([true, false]), 0)).toBe(true);
    expect(cellAt(boolColumn([true, false]), 1)).toBe(false);
  });

  it('reads typed values from typed columns', () => {
    const width = numericColumnOf(doors, 'width');
    expect(width === undefined ? undefined : numberAt(width, 0)).toBeCloseTo(0.9);
    expect(numericColumnOf(doors, 'name')).toBeUndefined();
    expect(stringAt(stringColumn(['a', 'b']), 1)).toBe('b');
  });

  it('classifies columns', () => {
    expect(isNumericColumn(f32Column([1]))).toBe(true);
    expect(isNumericColumn(stringColumn(['a']))).toBe(false);
    expect(isIntegerColumn(i32Column([1]))).toBe(true);
    expect(isIntegerColumn(f32Column([1]))).toBe(false);
    expect(columnLength(i32Column([1, 2]))).toBe(2);
  });

  it('keeps column order', () => {
    expect(columnNames(doors)).toEqual(['width', 'storey', 'name']);
    expect(columnOf(doors, 'missing')).toBeUndefined();
  });
});
