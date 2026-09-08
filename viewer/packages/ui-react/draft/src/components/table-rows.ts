// Filtering, ordering and windowing a model `Table`, as pure functions over row indices.
//
// Everything a table component decides is here, so the component itself only turns numbers into
// elements. A row index is the unit rather than a copied row object: filtering a hundred thousand
// rows must not allocate a hundred thousand records, and sorting an index array touches one array.
//
// An unknown number is `NaN` in a model table, never zero, so it sorts last in both directions.
// Sorting it as if it were zero would put "nobody measured this" in among the small values, which
// is exactly the reading mistake the model contract exists to prevent.

import { cellAt, isNumericColumn, type CellValue, type Table } from '@bim-open-toolkit/model';

// Which way a column is ordered.
export type SortDirection = 'ascending' | 'descending';

// The column a table is ordered by.
export type TableSort = { readonly column: string; readonly direction: SortDirection };

// The column names of a table, in the order the table declares them.
export const tableColumns = (table: Table): readonly string[] => [...table.columns.keys()];

// The value at a cell as text: the empty string where there is no such column or row, and `NaN`
// where a number is not known, because a blank would read as a value nobody wrote down.
export const cellText = (table: Table, column: string, row: number): string => {
  const held = table.columns.get(column);
  const value: CellValue | undefined = held === undefined ? undefined : cellAt(held, row);
  return value === undefined ? '' : typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value);
};

// Every row of the table, in the order it is stored.
export const allRows = (table: Table): readonly number[] =>
  Array.from({ length: table.rowCount }, (_unused, row) => row);

// The rows whose text in any of the named columns contains the query, case-insensitively. An empty
// query matches every row without walking the table.
export const matchingRows = (
  table: Table,
  rows: readonly number[],
  columns: readonly string[],
  query: string,
): readonly number[] => {
  const wanted = query.trim().toLowerCase();
  if (wanted === '') return rows;
  return rows.filter((row) =>
    columns.some((column) => cellText(table, column, row).toLowerCase().includes(wanted)),
  );
};

// How two rows of one column compare, with unknown numbers and absent cells last.
const compareRows = (table: Table, column: string, a: number, b: number): number => {
  const held = table.columns.get(column);
  if (held === undefined) return 0;
  if (isNumericColumn(held)) {
    const first = held.values[a];
    const second = held.values[b];
    const firstKnown = first !== undefined && Number.isFinite(first);
    const secondKnown = second !== undefined && Number.isFinite(second);
    if (!firstKnown || !secondKnown) return firstKnown === secondKnown ? 0 : firstKnown ? -1 : 1;
    return first === second ? 0 : first < second ? -1 : 1;
  }
  return cellText(table, column, a).localeCompare(cellText(table, column, b));
};

// The rows ordered by a column, keeping the order they arrived in where the column cannot separate
// them, so a base order the caller chose - exceptions first, say - survives a sort on another
// column.
export const sortedRows = (
  table: Table,
  rows: readonly number[],
  sort: TableSort | undefined,
): readonly number[] => {
  if (sort === undefined) return rows;
  const sign = sort.direction === 'ascending' ? 1 : -1;
  return rows
    .map((row, at) => ({ row, at }))
    .sort((a, b) => sign * compareRows(table, sort.column, a.row, b.row) || a.at - b.at)
    .map((item) => item.row);
};

// The rows a table shows, in order: the base order, filtered, then sorted.
export const visibleRows = (
  table: Table,
  order: readonly number[],
  columns: readonly string[],
  query: string,
  sort: TableSort | undefined,
): readonly number[] => sortedRows(table, matchingRows(table, order, columns, query), sort);

// The slice of rows a scrolled window shows, and the empty space above and below it.
export type RowWindow = {
  readonly first: number;
  readonly count: number;
  // Pixels of empty space to leave above the first drawn row, and below the last.
  readonly above: number;
  readonly below: number;
};

// Which rows a viewport of a given height shows, with `overscan` extra rows either side so a fast
// scroll does not show a blank strip before the next render.
export const rowWindow = (
  total: number,
  rowHeight: number,
  viewportHeight: number,
  scrollTop: number,
  overscan = 4,
): RowWindow => {
  if (total <= 0 || rowHeight <= 0) return { first: 0, count: 0, above: 0, below: 0 };
  const wanted = Math.ceil(Math.max(viewportHeight, 0) / rowHeight) + 1 + overscan * 2;
  const first = Math.max(0, Math.min(total - 1, Math.floor(Math.max(scrollTop, 0) / rowHeight) - overscan));
  const count = Math.min(wanted, total - first);
  return { first, count, above: first * rowHeight, below: (total - first - count) * rowHeight };
};

// The row indices a window covers.
export const windowRows = (rows: readonly number[], window: RowWindow): readonly number[] =>
  rows.slice(window.first, window.first + window.count);

// The sort a click on a column header produces: the same column the other way, or that column
// ascending when it was not the one being sorted by.
export const toggleSort = (sort: TableSort | undefined, column: string): TableSort =>
  sort !== undefined && sort.column === column && sort.direction === 'ascending'
    ? { column, direction: 'descending' }
    : { column, direction: 'ascending' };
