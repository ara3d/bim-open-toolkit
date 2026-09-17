// A value a result row can carry. JSON only, so a row compares, saves and travels as a command input.
export type ResultValue = string | number | boolean | null | readonly ResultValue[] | ResultRecord;

// A record of result values: the shape of every result row and every recipe step input.
export type ResultRecord = { readonly [key: string]: ResultValue };

// One row of a result table.
export type ResultRow = ResultRecord;

// A named table of rows, in the order a reader should see them.
export type ResultTable = { readonly id: string; readonly title: string; readonly rows: readonly ResultRow[] };

// A record with its absent fields left out, so a field nothing is known about is absent, not null.
export const resultRecord = (fields: Readonly<Record<string, ResultValue | undefined>>): ResultRecord =>
  Object.fromEntries(
    Object.entries(fields).flatMap(([key, value]) => (value === undefined ? [] : [[key, value] as const])),
  );

// A list of values, or nothing when the list is empty, for a field only written when it has content.
export const listOrNothing = (values: readonly ResultValue[]): readonly ResultValue[] | undefined =>
  values.length === 0 ? undefined : values;

// Text, or nothing when it is empty, for a field only written when it says something.
export const textOrNothing = (value: string): string | undefined => (value === '' ? undefined : value);

// A named table of result rows.
export const resultTable = (id: string, title: string, rows: readonly ResultRow[]): ResultTable => ({ id, title, rows });

// The column names of a table, in the order the rows first use them.
export const resultColumns = (table: ResultTable): readonly string[] => {
  const names: string[] = [];
  for (const row of table.rows) for (const name of Object.keys(row)) if (!names.includes(name)) names.push(name);
  return names;
};

// The rows of the named table, or none when there is no table of that name.
export const rowsOf = (tables: readonly ResultTable[], id: string): readonly ResultRow[] =>
  tables.find((table) => table.id === id)?.rows ?? [];
