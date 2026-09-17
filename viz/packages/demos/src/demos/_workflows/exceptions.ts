// The exceptions of a workflow result as a table the property inspector shows.
//
// The exceptions table is the honest half of every workflow: it is what the adapter could not
// decide and why. So it is built here once, with the columns in reading order, and every workflow
// demo shows the same shape rather than each inventing one.

import { stringColumn, table, type Table } from '@bim-open-toolkit/model';
import type { SheetTable } from '@bim-open-toolkit/ui-gratify';
import type { OverlayAction } from '@bim-open-toolkit/render';
import { exceptionRows } from '@bim-open-toolkit/workflows';
import type { ResultRow, ResultValue, WorkflowResult } from '@bim-open-toolkit/workflows';

// The columns of an exceptions table, in the order a reader reads them. A column a workflow does
// not write is left out; a column this list does not name follows in the order the rows use it.
export const exceptionColumns: readonly string[] = [
  'subjects',
  'field',
  'kind',
  'reason',
  'value',
  'values',
  'unit',
  'scope',
  'detail',
  'related',
  'evidence',
];

// A result value as one cell of text. A list reads as its items and a record as its fields, so a
// nested observation stays legible without a second table.
export const cellText = (value: ResultValue | undefined): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(cellText).join(', ');
  return Object.entries(value)
    .map(([name, held]) => `${name}: ${cellText(held)}`)
    .join('; ');
};

// The column names the rows actually use, the named ones first and the rest in the order they
// appear.
export const orderedColumns = (rows: readonly ResultRow[]): readonly string[] => {
  const used: string[] = [];
  for (const row of rows) for (const name of Object.keys(row)) if (!used.includes(name)) used.push(name);
  return [...exceptionColumns.filter((name) => used.includes(name)), ...used.filter((name) => !exceptionColumns.includes(name))];
};

// Rows of result records as a table of text columns. Every cell is text because an exception cell
// can hold a list, a record or nothing at all, and a numeric column cannot say "nothing at all".
export const textTable = (rows: readonly ResultRow[]): Table =>
  table(orderedColumns(rows).map((name) => [name, stringColumn(rows.map((row) => cellText(row[name])))] as const));

// The exceptions of a result as a sheet table, with the row action a demo gives it.
export const exceptionsSheet = (
  result: WorkflowResult,
  rowAction?: (row: number) => OverlayAction,
): SheetTable => ({
  id: 'exceptions',
  title: `Exceptions (${result.exceptions.length})`,
  table: textTable(exceptionRows(result)),
  rowAction,
});

// The ids of every input row an exception was raised about, without repeats.
export const exceptionSubjects = (result: WorkflowResult): readonly string[] =>
  [...new Set(result.exceptions.flatMap((item) => item.subjects))];

// The items that raised an exception, then the rest, each group keeping the order it was given.
// This is what "exceptions first" means everywhere in the gallery.
export const exceptionsFirst = <T>(items: readonly T[], raised: (item: T) => boolean): readonly T[] => [
  ...items.filter(raised),
  ...items.filter((item) => !raised(item)),
];
