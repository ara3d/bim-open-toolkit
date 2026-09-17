// A `PropertySheet` drawn as DOM.
//
// The inspector is meant to be a Gratify surface (GALLERY-PLAN.md decision 1), and it will be as
// soon as `ui-gratify` publishes `hostInspector`. This is the fallback the plan's risk table names,
// written against the same `PropertySheet` contract, so the demos never learn which one they got
// and a slip in one track cannot stop the other. It is also what the DOM mirror falls back to for
// the inspector, since it is already reachable by keyboard.

import { cellAt, columnNames, type Table } from '@bim-open-toolkit/model';
import type { PropertyRow, PropertySheet, PropertyValue, SheetTable } from '@bim-open-toolkit/ui-gratify';
import { valueStateColors } from './analytical.js';
import { clear, el } from './elements.js';

// What a value reads as, with the reason in place of an empty box when nobody recorded it.
export const valueText = (value: PropertyValue): string => {
  if (value.state === 'missing') return value.missingReason ?? 'not recorded';
  return value.unit === undefined || value.unit === '' ? value.text : `${value.text} ${value.unit}`;
};

const valueCell = (value: PropertyValue): HTMLElement => {
  const cell = el('dd', `sheet-value state-${value.state}`, valueText(value));
  // The state colour is analytical, so it is set from the fixed table rather than from a token.
  cell.style.setProperty('--state-color', valueStateColors[value.state]);
  if (value.evidence !== undefined && value.evidence.length > 0)
    cell.append(el('span', 'sheet-evidence', value.evidence.join(' · ')));
  return cell;
};

const rowPair = (row: PropertyRow, onAction: (row: PropertyRow) => void): readonly Node[] => {
  const label = el('dt', 'sheet-label', row.label);
  const value = valueCell(row.value);
  if (row.action === undefined) return [label, value];
  const act = el('button', 'sheet-action', 'Show');
  act.type = 'button';
  act.addEventListener('click', () => onAction(row));
  value.append(act);
  return [label, value];
};

const tableBlock = (source: SheetTable): HTMLElement => {
  const block = el('section', 'sheet-table');
  block.append(el('h4', 'sheet-table-title', source.title));
  const grid = el('table', 'sheet-grid');
  const head = el('tr', '');
  const names = columnNames(source.table);
  for (const name of names) head.append(el('th', '', name));
  const heading = el('thead', '');
  heading.append(head);
  grid.append(heading);
  const body = el('tbody', '');
  for (let row = 0; row < source.table.rowCount; row++) {
    const line = el('tr', '');
    for (const name of names) line.append(el('td', '', cellText(source.table, name, row)));
    body.append(line);
  }
  grid.append(body);
  block.append(grid);
  return block;
};

const cellText = (source: Table, name: string, row: number): string => {
  const column = source.columns.get(name);
  if (column === undefined) return '';
  const value = cellAt(column, row);
  return value === undefined ? '' : String(value);
};

// Draws a sheet into `into`, replacing whatever was there. `onAction` runs when a row's action is
// clicked; the caller turns it into a command, because this file knows nothing about a session.
export const renderSheet = (
  into: HTMLElement,
  sheet: PropertySheet | undefined,
  onAction: (row: PropertyRow) => void,
): void => {
  clear(into);
  if (sheet === undefined) {
    into.append(el('p', 'sheet-empty', 'This demo has nothing to inspect yet.'));
    return;
  }
  into.append(el('h3', 'sheet-title', sheet.title));
  if (sheet.subtitle !== undefined) into.append(el('p', 'sheet-subtitle', sheet.subtitle));
  for (const group of sheet.groups) {
    const block = el('section', 'sheet-group');
    block.append(el('h4', 'sheet-group-title', group.title));
    const list = el('dl', 'sheet-rows');
    for (const row of group.rows) list.append(...rowPair(row, onAction));
    block.append(list);
    into.append(block);
  }
  for (const source of sheet.tables ?? []) into.append(tableBlock(source));
};
