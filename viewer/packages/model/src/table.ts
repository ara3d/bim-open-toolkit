import { diagnostic, failure, success, type Result } from './result.js';

// The element type of a column. Booleans are stored as bytes; strings stay a plain array.
export type ColumnType = 'f32' | 'f64' | 'i32' | 'u32' | 'bool' | 'string';

// One column of a table. Each variant carries the storage its type implies.
export type Column =
  | { readonly type: 'f32'; readonly values: Float32Array }
  | { readonly type: 'f64'; readonly values: Float64Array }
  | { readonly type: 'i32'; readonly values: Int32Array }
  | { readonly type: 'u32'; readonly values: Uint32Array }
  | { readonly type: 'bool'; readonly values: Uint8Array }
  | { readonly type: 'string'; readonly values: readonly string[] };

// A column whose values read back as numbers.
export type NumericColumn = Extract<Column, { readonly type: 'f32' | 'f64' | 'i32' | 'u32' }>;

// A column of whole numbers, usable as a join key.
export type IntegerColumn = Extract<Column, { readonly type: 'i32' | 'u32' }>;

// A column of strings.
export type StringColumn = Extract<Column, { readonly type: 'string' }>;

// A column of booleans, one byte each.
export type BoolColumn = Extract<Column, { readonly type: 'bool' }>;

// One value read out of a column.
export type CellValue = number | string | boolean;

// A set of equal-length named columns. `rowCount` is the length every column has.
export type Table = {
  readonly rowCount: number;
  readonly columns: ReadonlyMap<string, Column>;
};

// A column of 32-bit floats.
export const f32Column = (values: ArrayLike<number>): NumericColumn => ({ type: 'f32', values: new Float32Array(values) });

// A column of 64-bit floats.
export const f64Column = (values: ArrayLike<number>): NumericColumn => ({ type: 'f64', values: new Float64Array(values) });

// A column of signed 32-bit integers.
export const i32Column = (values: ArrayLike<number>): IntegerColumn => ({ type: 'i32', values: new Int32Array(values) });

// A column of unsigned 32-bit integers.
export const u32Column = (values: ArrayLike<number>): IntegerColumn => ({ type: 'u32', values: new Uint32Array(values) });

// A column of booleans, stored one byte each.
export const boolColumn = (values: readonly boolean[]): BoolColumn => ({
  type: 'bool',
  values: Uint8Array.from(values, (value) => (value ? 1 : 0)),
});

// A column of strings.
export const stringColumn = (values: readonly string[]): StringColumn => ({ type: 'string', values: [...values] });

// The number of values in a column.
export const columnLength = (column: Column): number => column.values.length;

// The value at a row, or undefined when the row is outside the column.
export const cellAt = (column: Column, row: number): CellValue | undefined => {
  const raw: number | string | undefined = column.values[row];
  return raw === undefined ? undefined : column.type === 'bool' ? raw !== 0 : raw;
};

// The number at a row of a numeric column, or undefined when the row is outside it.
export const numberAt = (column: NumericColumn, row: number): number | undefined => column.values[row];

// The string at a row of a string column, or undefined when the row is outside it.
export const stringAt = (column: StringColumn, row: number): string | undefined => column.values[row];

// True when the column reads back as numbers.
export const isNumericColumn = (column: Column): column is NumericColumn =>
  column.type === 'f32' || column.type === 'f64' || column.type === 'i32' || column.type === 'u32';

// True when the column holds whole numbers usable as a join key.
export const isIntegerColumn = (column: Column): column is IntegerColumn =>
  column.type === 'i32' || column.type === 'u32';

// A table of the named columns. `rowCount` is the shortest column, so every row index is valid.
export const table = (entries: Iterable<readonly [string, Column]>): Table => {
  const columns = new Map(entries);
  const lengths = [...columns.values()].map(columnLength);
  return { rowCount: lengths.length === 0 ? 0 : Math.min(...lengths), columns };
};

// The named column, or undefined when the table has no such column.
export const columnOf = (source: Table, name: string): Column | undefined => source.columns.get(name);

// The named column when it reads back as numbers, otherwise undefined.
export const numericColumnOf = (source: Table, name: string): NumericColumn | undefined => {
  const column = source.columns.get(name);
  return column !== undefined && isNumericColumn(column) ? column : undefined;
};

// The names of every column, in insertion order.
export const columnNames = (source: Table): readonly string[] => [...source.columns.keys()];

// A table with no columns and no rows.
export const emptyTable: Table = { rowCount: 0, columns: new Map() };

// Row numbers into a table, as a plain array or as a typed array of indices.
export type RowIndices = readonly number[] | Int32Array | Uint32Array;

// The direction a sort orders rows in.
export type SortDirection = 'ascending' | 'descending';

// Copies the given rows of a numeric column into the target array, in the order they are given.
const gather = <A extends { [index: number]: number }>(
  values: { readonly [index: number]: number | undefined },
  rows: RowIndices,
  target: A,
): A => {
  for (let index = 0; index < rows.length; index += 1) target[index] = values[rows[index] ?? 0] ?? 0;
  return target;
};

// The given rows of a column, in the order they are given, as a new column of the same type.
export const takeColumn = (column: Column, rows: RowIndices): Column => {
  const count = rows.length;
  switch (column.type) {
    case 'f32':
      return { type: 'f32', values: gather(column.values, rows, new Float32Array(count)) };
    case 'f64':
      return { type: 'f64', values: gather(column.values, rows, new Float64Array(count)) };
    case 'i32':
      return { type: 'i32', values: gather(column.values, rows, new Int32Array(count)) };
    case 'u32':
      return { type: 'u32', values: gather(column.values, rows, new Uint32Array(count)) };
    case 'bool':
      return { type: 'bool', values: gather(column.values, rows, new Uint8Array(count)) };
    case 'string': {
      const values: string[] = [];
      for (let index = 0; index < count; index += 1) values.push(column.values[rows[index] ?? 0] ?? '');
      return { type: 'string', values };
    }
  }
};

// The named columns, in the order named. A name the table does not have is left out.
export const selectColumns = (source: Table, names: readonly string[]): Table =>
  table(names.flatMap((name) => {
    const column = source.columns.get(name);
    return column === undefined ? [] : [[name, column] as const];
  }));

// The table without the named columns.
export const dropColumns = (source: Table, names: readonly string[]): Table =>
  table([...source.columns].filter(([name]) => !names.includes(name)));

// The table with a column added or replaced. The row count follows from the shortest column.
export const withColumn = (source: Table, name: string, column: Column): Table =>
  table([...source.columns].filter(([existing]) => existing !== name).concat([[name, column]]));

// The given rows of every column, in the order they are given.
export const takeRows = (source: Table, rows: RowIndices): Table =>
  table([...source.columns].map(([name, column]) => [name, takeColumn(column, rows)]));

// The row numbers the predicate keeps, in table order.
export const findRows = (source: Table, keep: (row: number) => boolean): readonly number[] => {
  const rows: number[] = [];
  for (let row = 0; row < source.rowCount; row += 1) if (keep(row)) rows.push(row);
  return rows;
};

// The rows the predicate keeps, in table order.
export const filterRows = (source: Table, keep: (row: number) => boolean): Table =>
  takeRows(source, findRows(source, keep));

// Compares two cells of the same column type. Absent values sort first.
const compareCells = (a: CellValue | undefined, b: CellValue | undefined): number => {
  if (a === undefined) return b === undefined ? 0 : -1;
  if (b === undefined) return 1;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  return Number(a) - Number(b);
};

// The row numbers ordered by the named column. Rows with equal values keep their table order.
// A name the table does not have leaves the rows in table order.
export const orderRowsBy = (source: Table, name: string, direction: SortDirection = 'ascending'): readonly number[] => {
  const column = source.columns.get(name);
  const rows = Array.from({ length: source.rowCount }, (_unused, row) => row);
  if (column === undefined) return rows;
  const sign = direction === 'ascending' ? 1 : -1;
  return rows.sort((a, b) => sign * compareCells(cellAt(column, a), cellAt(column, b)));
};

// The table ordered by the named column.
export const sortRows = (source: Table, name: string, direction: SortDirection = 'ascending'): Table =>
  takeRows(source, orderRowsBy(source, name, direction));

// The first row of each key value, so a join can find its match in one lookup.
export const indexByKey = (column: IntegerColumn): ReadonlyMap<number, number> => {
  const rows = new Map<number, number>();
  for (let row = column.values.length - 1; row >= 0; row -= 1) {
    const key = column.values[row];
    if (key !== undefined) rows.set(key, row);
  }
  return rows;
};

// For each row of the left column, the row of the right column with the same key, or -1.
export const matchRows = (left: IntegerColumn, right: IntegerColumn): Int32Array => {
  const index = indexByKey(right);
  const matches = new Int32Array(left.values.length);
  for (let row = 0; row < left.values.length; row += 1)
    matches[row] = index.get(left.values[row] ?? 0) ?? -1;
  return matches;
};

// One row read out as named values, for tests and for reporting. Bulk code reads columns.
export const rowOf = (source: Table, row: number): Readonly<Record<string, CellValue>> =>
  Object.fromEntries(
    [...source.columns].flatMap(([name, column]) => {
      const value = cellAt(column, row);
      return value === undefined ? [] : [[name, value] as const];
    }),
  );

// The named column when it holds whole numbers usable as a join key, otherwise undefined.
export const integerColumnOf = (source: Table, name: string): IntegerColumn | undefined => {
  const column = source.columns.get(name);
  return column !== undefined && isIntegerColumn(column) ? column : undefined;
};

// The rows of both tables whose integer key columns match, one output row per matching left row.
// Right column names take the prefix; a name that would collide with a left column is an error.
export const joinTables = (
  left: Table,
  leftKey: string,
  right: Table,
  rightKey: string,
  prefix = '',
): Result<Table> => {
  const leftColumn = integerColumnOf(left, leftKey);
  const rightColumn = integerColumnOf(right, rightKey);
  if (leftColumn === undefined || rightColumn === undefined)
    return failure([
      diagnostic('table/key', `A join needs an integer column on both sides: "${leftKey}" and "${rightKey}".`),
    ]);
  const collisions = columnNames(right)
    .map((name) => `${prefix}${name}`)
    .filter((name) => left.columns.has(name));
  if (collisions.length > 0)
    return failure([
      diagnostic('table/collision', `Joining would give two columns named ${collisions.join(', ')}.`),
    ]);
  const matches = matchRows(leftColumn, rightColumn);
  const leftRows = findRows(left, (row) => (matches[row] ?? -1) >= 0);
  const rightRows = leftRows.map((row) => matches[row] ?? 0);
  const joined = [
    ...takeRows(left, leftRows).columns,
    ...[...takeRows(right, rightRows).columns].map(([name, column]) => [`${prefix}${name}`, column] as const),
  ];
  return success(table(joined));
};
