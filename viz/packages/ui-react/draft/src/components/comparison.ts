// Comparing two revisions of one table, without proposing a correspondence of its own.
//
// Two rows correspond when they carry the same key. That is the only rule here, and it is stated
// rather than inferred: a key in one revision and not the other is an addition or a removal only
// because the caller said those keys are comparable. A match somebody proposed but nobody settled
// is passed in as `unresolved` and is reported as such - never quietly resolved into an addition
// and a removal, which is the mistake the product brief names.

import type { Table } from '@bim-open-toolkit/model';
import { cellText, tableColumns } from './table-rows.js';

// What became of one key between the two revisions.
export type ChangeKind = 'added' | 'removed' | 'changed' | 'unchanged' | 'unresolved';

// One key and what became of it. `differences` names the columns whose text differs, and is empty
// for every kind but `changed`.
export type ComparisonRow = {
  readonly key: string;
  readonly kind: ChangeKind;
  readonly differences: readonly string[];
};

// The two revisions and how to read them.
export type ComparisonInput = {
  readonly before: Table;
  readonly after: Table;
  // The column holding the identity a row is compared by.
  readonly keyColumn: string;
  // The columns compared. Defaults to every column of the later revision except the key.
  readonly columns?: readonly string[] | undefined;
  // Keys whose correspondence a source proposed and nobody settled. They are reported as
  // `unresolved` and never as an addition or a removal.
  readonly unresolved?: readonly string[] | undefined;
};

// The row of each key, by key, for the revision given.
const rowsByKey = (table: Table, keyColumn: string): ReadonlyMap<string, number> => {
  const found = new Map<string, number>();
  for (let row = 0; row < table.rowCount; row++) {
    const key = cellText(table, keyColumn, row);
    if (key !== '' && !found.has(key)) found.set(key, row);
  }
  return found;
};

// The order the kinds are read in: what changed is what a review is for, so it comes first.
const kindOrder: Readonly<Record<ChangeKind, number>> = {
  unresolved: 0,
  changed: 1,
  added: 2,
  removed: 3,
  unchanged: 4,
};

// What became of every key across the two revisions, ordered by kind and then by key.
export const compareTables = (input: ComparisonInput): readonly ComparisonRow[] => {
  const before = rowsByKey(input.before, input.keyColumn);
  const after = rowsByKey(input.after, input.keyColumn);
  const columns = (input.columns ?? tableColumns(input.after)).filter((name) => name !== input.keyColumn);
  const open = new Set(input.unresolved ?? []);
  const keys = [...new Set([...before.keys(), ...after.keys()])];

  const rows = keys.map((key): ComparisonRow => {
    if (open.has(key)) return { key, kind: 'unresolved', differences: [] };
    const first = before.get(key);
    const second = after.get(key);
    if (first === undefined) return { key, kind: 'added', differences: [] };
    if (second === undefined) return { key, kind: 'removed', differences: [] };
    const differences = columns.filter(
      (name) => cellText(input.before, name, first) !== cellText(input.after, name, second),
    );
    return { key, kind: differences.length === 0 ? 'unchanged' : 'changed', differences };
  });

  return [...rows].sort(
    (a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.key.localeCompare(b.key),
  );
};

// How many keys are of each kind.
export const comparisonCounts = (rows: readonly ComparisonRow[]): Readonly<Record<ChangeKind, number>> => {
  const counts: Record<ChangeKind, number> = {
    added: 0,
    removed: 0,
    changed: 0,
    unchanged: 0,
    unresolved: 0,
  };
  for (const row of rows) counts[row.kind] += 1;
  return counts;
};
