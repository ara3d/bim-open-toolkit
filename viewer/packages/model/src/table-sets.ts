import type { ObjectKey } from './identity.js';
import { emptySet, setOf, type ObjectSet } from './sets.js';
import { filterRows, integerColumnOf, stringColumnOf, takeRows, type Table } from './table.js';

// True when the row has a key and the set holds it.
const isMember = (set: ObjectSet, key: ObjectKey | undefined): boolean => key !== undefined && set.has(key);

// The key a row of an integer key column names, read out of the object keys the indices point into.
const keyOfIndex = (keys: readonly ObjectKey[], index: number | undefined): ObjectKey | undefined =>
  index === undefined ? undefined : keys[index];

// The rows whose key column names a member of the set, in table order. A string key column holds
// object keys; an integer key column holds indices into `keys`, which is what the `objectIndex` of
// an instance table is. A key column of neither kind, or an integer one with no `keys` to read it
// against, keeps no rows: the table's columns come back with nothing in them.
export const rowsInSet = (
  source: Table,
  keyColumn: string,
  set: ObjectSet,
  keys?: readonly ObjectKey[],
): Table => {
  const objectKeys = stringColumnOf(source, keyColumn);
  if (objectKeys !== undefined) return filterRows(source, (row) => isMember(set, objectKeys.values[row]));
  const indices = integerColumnOf(source, keyColumn);
  if (indices === undefined || keys === undefined) return takeRows(source, []);
  return filterRows(source, (row) => isMember(set, keyOfIndex(keys, indices.values[row])));
};

// The set of objects the rows name, read the same way `rowsInSet` reads them. A key column of
// neither kind, or an integer one with no `keys` to read it against, gives the empty set.
export const setOfRows = (source: Table, keyColumn: string, keys?: readonly ObjectKey[]): ObjectSet => {
  const objectKeys = stringColumnOf(source, keyColumn);
  if (objectKeys !== undefined) return setOf(objectKeys.values.slice(0, source.rowCount));
  const indices = integerColumnOf(source, keyColumn);
  if (indices === undefined || keys === undefined) return emptySet;
  const members = new Set<ObjectKey>();
  for (let row = 0; row < source.rowCount; row += 1) {
    const key = keyOfIndex(keys, indices.values[row]);
    if (key !== undefined) members.add(key);
  }
  return members;
};
