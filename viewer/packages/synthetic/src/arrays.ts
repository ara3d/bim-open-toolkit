// Small array helpers the generators share.
//
// The package uses no non-null assertion, so reading an element of a `readonly T[]` under
// `noUncheckedIndexedAccess` needs one place that turns an out-of-range index into an error.

// Reads an element, treating an out-of-range index as a programming error rather than `undefined`.
export function elementAt<T>(items: readonly T[], index: number): T {
  const value = items[index];
  if (value === undefined) throw new Error(`index ${index} is out of range`);
  return value;
}

// The ids of a candidate list as one cell of a string column, space separated. A `Table` column
// holds one scalar per row, so a list-valued field is joined here and split by the reader; the
// empty string means no candidates, which is why every such column has a count column beside it.
export const joinIds = (ids: readonly string[]): string => ids.join(' ');

// The ids a `joinIds` cell holds. The empty string is no ids rather than one empty id.
export const splitIds = (cell: string): readonly string[] => (cell === '' ? [] : cell.split(' '));
