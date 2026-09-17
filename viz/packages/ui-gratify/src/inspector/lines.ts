// A property sheet flattened into fixed-height lines. The inspector scrolls by virtualization, so
// everything it can show has to be countable and addressable by index before anything is drawn.
import { cellAt, columnNames, type Table } from '@bim-open-toolkit/model';
import type { OverlayAction } from '@bim-open-toolkit/render';
import type { PropertyRow, PropertySheet, PropertyValue, SheetTable } from '../contracts.js';

// One line of the inspector. Every kind is one row high, which is what makes the scroll arithmetic
// a division rather than a running total.
export type SheetLine =
  | { readonly kind: 'group'; readonly key: string; readonly title: string }
  | {
      readonly kind: 'row';
      readonly key: string;
      readonly row: PropertyRow;
      // True when the value has a reason or evidence to show, so the line can be opened.
      readonly tellable: boolean;
      readonly open: boolean;
    }
  | { readonly kind: 'evidence'; readonly key: string; readonly text: string }
  | { readonly kind: 'table'; readonly key: string; readonly title: string }
  | { readonly kind: 'columns'; readonly key: string; readonly table: SheetTable }
  | { readonly kind: 'cells'; readonly key: string; readonly table: SheetTable; readonly row: number };

// What a value has to say for itself beyond its text: why it is missing, and what disagreed.
export const valueStory = (value: PropertyValue): readonly string[] => [
  ...(value.missingReason === undefined ? [] : [value.missingReason]),
  ...(value.evidence ?? []),
];

// Whether a line can be opened to show that story.
const tellable = (row: PropertyRow): boolean => valueStory(row.value).length > 0;

// The lines a sheet shows, with the opened rows expanded. Keys are stable addresses: the same row
// keeps its key across a re-derived sheet, so opening one survives the next change event.
export const sheetLines = (sheet: PropertySheet, open: ReadonlySet<string>): readonly SheetLine[] => {
  const lines: SheetLine[] = [];
  for (const group of sheet.groups) {
    lines.push({ kind: 'group', key: `g:${group.id}`, title: group.title });
    for (const row of group.rows) {
      const key = `r:${group.id}/${row.key}`;
      const canTell = tellable(row);
      const isOpen = canTell && open.has(key);
      lines.push({ kind: 'row', key, row, tellable: canTell, open: isOpen });
      if (isOpen) {
        valueStory(row.value).forEach((text, index) => lines.push({ kind: 'evidence', key: `${key}#${index}`, text }));
      }
    }
  }
  for (const table of sheet.tables ?? []) {
    lines.push({ kind: 'table', key: `t:${table.id}`, title: table.title });
    lines.push({ kind: 'columns', key: `h:${table.id}`, table });
    for (let row = 0; row < table.table.rowCount; row += 1) {
      lines.push({ kind: 'cells', key: `c:${table.id}/${row}`, table, row });
    }
  }
  return lines;
};

// The action a line runs when it is clicked, if any.
export const lineAction = (line: SheetLine): OverlayAction | undefined =>
  line.kind === 'row' ? line.row.action : line.kind === 'cells' ? line.table.rowAction?.(line.row) : undefined;

// One cell of a table as the inspector prints it. A whole number keeps no decimals; anything else
// keeps two, which is what a quantity or a cost needs and no more.
export const formatCell = (table: Table, column: string, row: number): string => {
  const found = table.columns.get(column);
  const value = found === undefined ? undefined : cellAt(found, row);
  if (value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'string') return value;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

// The columns of a sheet table, in table order.
export const tableColumns = (table: SheetTable): readonly string[] => columnNames(table.table);

const sameAction = (a: OverlayAction | undefined, b: OverlayAction | undefined): boolean => {
  if (a === undefined || b === undefined) return a === b;
  if (a.command !== b.command) return false;
  const keys = Object.keys(a.input);
  return keys.length === Object.keys(b.input).length && keys.every((key) => a.input[key] === b.input[key]);
};

const sameList = (a: readonly string[] | undefined, b: readonly string[] | undefined): boolean =>
  (a ?? []).length === (b ?? []).length && (a ?? []).every((text, index) => text === (b ?? [])[index]);

const sameValue = (a: PropertyValue, b: PropertyValue): boolean =>
  a.kind === b.kind &&
  a.text === b.text &&
  a.unit === b.unit &&
  a.state === b.state &&
  a.missingReason === b.missingReason &&
  sameList(a.evidence, b.evidence);

const sameRow = (a: PropertyRow, b: PropertyRow): boolean =>
  a.key === b.key &&
  a.label === b.label &&
  sameValue(a.value, b.value) &&
  sameAction(a.action, b.action) &&
  a.edit?.command === b.edit?.command &&
  a.edit?.inputKey === b.edit?.inputKey;

const sameTable = (a: SheetTable, b: SheetTable): boolean =>
  a.id === b.id &&
  a.title === b.title &&
  a.rowAction === b.rowAction &&
  a.table.rowCount === b.table.rowCount &&
  a.table.columns.size === b.table.columns.size &&
  [...a.table.columns].every(([name, column]) => b.table.columns.get(name) === column);

// Whether two sheets would draw the same thing. Re-deriving a sheet after every change event is
// cheap; rebuilding the scene and losing the scroll position is not, so an equal sheet is dropped.
// Table contents are compared by column identity, which is what an immutable table gives.
export const sameSheet = (a: PropertySheet, b: PropertySheet): boolean =>
  a.title === b.title &&
  a.subtitle === b.subtitle &&
  a.groups.length === b.groups.length &&
  a.groups.every((group, index) => {
    const other = b.groups[index];
    return (
      other !== undefined &&
      group.id === other.id &&
      group.title === other.title &&
      group.rows.length === other.rows.length &&
      group.rows.every((row, at) => {
        const twin = other.rows[at];
        return twin !== undefined && sameRow(row, twin);
      })
    );
  }) &&
  (a.tables ?? []).length === (b.tables ?? []).length &&
  (a.tables ?? []).every((table, index) => {
    const other = (b.tables ?? [])[index];
    return other !== undefined && sameTable(table, other);
  });
