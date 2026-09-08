import { describe, expect, it } from 'vitest';
import {
  boolColumn, boolColumnOf, cellAt, cellOf, columnLength, columnNames, columnOf, dropColumns, emptyTable,
  f32Column, f64Column, filterRows, findRows, i32Column, indexByKey, isIntegerColumn, isNumericColumn,
  joinTables, matchRows, numberAt, numberOf, numericColumnOf, orderRowsBy, rowOf, selectColumns, sortRows,
  stringAt, stringColumn, stringColumnOf, stringOf, table, tableFromRecord, takeRows, u32Column, withColumn,
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

  it('builds the same table from a record as from entries', () => {
    const fromRecord = tableFromRecord({
      width: f32Column([0.9, 1.2, 0.8]),
      storey: i32Column([0, 1, 1]),
      name: stringColumn(['D1', 'D2', 'D3']),
    });
    expect(columnNames(fromRecord)).toEqual(columnNames(doors));
    expect(fromRecord.rowCount).toBe(doors.rowCount);
    expect(rowOf(fromRecord, 2)).toEqual(rowOf(doors, 2));
  });

  it('narrows a column by its type', () => {
    expect(stringColumnOf(doors, 'name')?.values).toEqual(['D1', 'D2', 'D3']);
    expect(stringColumnOf(doors, 'width')).toBeUndefined();
    expect(boolColumnOf(withColumn(doors, 'fire', boolColumn([true, false, true])), 'fire')?.values)
      .toEqual(Uint8Array.from([1, 0, 1]));
    expect(boolColumnOf(doors, 'name')).toBeUndefined();
  });

  it('reads a cell without narrowing the column by hand', () => {
    expect(cellOf(doors, 'name', 1)).toBe('D2');
    expect(cellOf(doors, 'missing', 0)).toBeUndefined();
    expect(cellOf(doors, 'name', 9)).toBeUndefined();
    expect(numberOf(doors, 'storey', 2)).toBe(1);
    expect(numberOf(doors, 'name', 0)).toBeUndefined();
    expect(stringOf(doors, 'name', 0)).toBe('D1');
    expect(stringOf(doors, 'storey', 0)).toBeUndefined();
  });
});

const storeys = table([
  ['id', i32Column([0, 1, 2])],
  ['label', stringColumn(['Ground', 'First', 'Second'])],
]);

describe('table operations', () => {
  it('keeps the named columns in the order named', () => {
    expect(columnNames(selectColumns(doors, ['name', 'width', 'missing']))).toEqual(['name', 'width']);
    expect(columnNames(dropColumns(doors, ['storey']))).toEqual(['width', 'name']);
  });

  it('adds and replaces a column, keeping the rest in place', () => {
    const added = withColumn(doors, 'fire', boolColumn([true, false, true]));
    expect(columnNames(added)).toEqual(['width', 'storey', 'name', 'fire']);
    const replaced = withColumn(doors, 'storey', i32Column([9, 9, 9]));
    expect(rowOf(replaced, 0).storey).toBe(9);
    expect(columnNames(replaced)).toEqual(['width', 'name', 'storey']);
  });

  it('takes rows in the order given, keeping each column type', () => {
    const taken = takeRows(doors, [2, 0]);
    expect(taken.rowCount).toBe(2);
    expect(rowOf(taken, 0).storey).toBe(1);
    expect(rowOf(taken, 0).name).toBe('D3');
    expect(Number(rowOf(taken, 0).width)).toBeCloseTo(0.8);
    expect(columnOf(taken, 'width')?.values).toBeInstanceOf(Float32Array);
    expect(columnOf(taken, 'name')?.values).toEqual(['D3', 'D1']);
  });

  it('keeps booleans as booleans through a take', () => {
    const flags = table([['fire', boolColumn([true, false, true])]]);
    expect(rowOf(takeRows(flags, [1, 2]), 0).fire).toBe(false);
    expect(rowOf(takeRows(flags, [1, 2]), 1).fire).toBe(true);
  });

  it('keeps the rows a predicate admits', () => {
    const storey = numericColumnOf(doors, 'storey');
    const onFirst = filterRows(doors, (row) => numberAt(storey ?? i32Column([]), row) === 1);
    expect(onFirst.rowCount).toBe(2);
    expect(columnOf(onFirst, 'name')?.values).toEqual(['D2', 'D3']);
    expect(findRows(doors, () => false)).toEqual([]);
  });

  it('orders rows by a column, in both directions and stably', () => {
    expect(orderRowsBy(doors, 'width')).toEqual([2, 0, 1]);
    expect(orderRowsBy(doors, 'width', 'descending')).toEqual([1, 0, 2]);
    expect(orderRowsBy(doors, 'storey')).toEqual([0, 1, 2]);
    expect(columnOf(sortRows(doors, 'name', 'descending'), 'name')?.values).toEqual(['D3', 'D2', 'D1']);
  });

  it('leaves rows in table order when the column is not there', () => {
    expect(orderRowsBy(doors, 'missing')).toEqual([0, 1, 2]);
  });

  it('matches rows by an integer key, reporting no match as -1', () => {
    expect(matchRows(i32Column([1, 0, 5]), i32Column([0, 1, 2]))).toEqual(Int32Array.from([1, 0, -1]));
    expect(indexByKey(i32Column([7, 7]))).toEqual(new Map([[7, 0]]));
  });

  it('joins on integer keys, keeping only rows that matched', () => {
    const joined = joinTables(doors, 'storey', storeys, 'id', 'storey.');
    expect(joined.ok).toBe(true);
    const value = joined.ok ? joined.value : emptyTable;
    expect(value.rowCount).toBe(3);
    expect(columnNames(value)).toEqual(['width', 'storey', 'name', 'storey.id', 'storey.label']);
    expect(columnOf(value, 'storey.label')?.values).toEqual(['Ground', 'First', 'First']);
  });

  it('drops left rows with no match', () => {
    const joined = joinTables(doors, 'storey', table([['id', i32Column([1])], ['label', stringColumn(['First'])]]), 'id', 's.');
    expect(joined.ok && joined.value.rowCount).toBe(2);
    expect(joined.ok && columnOf(joined.value, 'name')?.values).toEqual(['D2', 'D3']);
  });

  it('refuses a join without integer keys on both sides', () => {
    const joined = joinTables(doors, 'name', storeys, 'id');
    expect(joined.diagnostics.map((item) => item.code)).toEqual(['table/key']);
  });

  it('refuses a join that would give two columns the same name', () => {
    const joined = joinTables(doors, 'storey', table([['name', stringColumn(['x'])], ['id', i32Column([0])]]), 'id');
    expect(joined.diagnostics.map((item) => item.code)).toEqual(['table/collision']);
  });

  it('reads one row as named values, leaving out columns that have no such row', () => {
    expect(Object.keys(rowOf(doors, 1))).toEqual(['width', 'storey', 'name']);
    expect(rowOf(doors, 1).name).toBe('D2');
    expect(Number(rowOf(doors, 1).width)).toBeCloseTo(1.2);
    expect(rowOf(doors, 9)).toEqual({});
  });
});
