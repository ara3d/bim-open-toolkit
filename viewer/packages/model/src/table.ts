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
