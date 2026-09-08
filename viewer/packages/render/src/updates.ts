// Bulk column updates written straight into the borrowed group buffers.
//
// Every writer takes a row selection and a typed array of values, either one value broadcast to
// every selected row or one value per row, and returns how many rows it actually changed. The
// design follows the measured recommendations in
// `viewer/packages/testing/docs/instance-updates.md`:
//
//  1. No per-group version bump per change: publishing that way cost 3.25 times the write it
//     published. `publishDirty` publishes once per touched group at the end instead.
//  2. Dirty slot ranges are recorded during the write, which cost 3 % and is what an uploader
//     needs to send a sub-range.
//  3. A selection of `everyRow` drops the row index entirely and walks the group buffers, which
//     was 2.4 times faster than driving the same values through a row list.
//  5. Rows are written in the order given; `InstanceTable` already orders rows so a group's rows
//     are contiguous, which was the cheapest case measured.
//  8. A value per row is supported directly, so no separate broadcast fast path is needed.
//
// Change detection compares the stored float with `Math.fround` of the incoming value, because a
// double written into a Float32Array is rounded and comparing the unrounded double would report a
// change that did not happen.
//
// The five writers repeat a similar loop shape. That repetition is deliberate: the study measured
// the cost of this work in the tens of nanoseconds per row, so a shared per-row callback would be
// a large fraction of it.

import {
  colorStride,
  columnOf,
  diagnostic,
  failure,
  numberAt,
  numericColumnOf,
  stringAt,
  success,
  transformStride,
  type Column,
  type Diagnostic,
  type ObjectKey,
  type Result,
  type Table,
} from '@bim-open-toolkit/model';
import {
  alphaChannel,
  translationOffset,
  translationStride,
  type InstanceTable,
} from './instance-table.js';

// Selects every row in buffer order, which lets a writer skip the row index entirely.
export const everyRow = 'every-row';

// Which rows a bulk update writes: an explicit list, or every row.
export type RowSelection = Int32Array | typeof everyRow;

// Whether a writer compares before writing. Off is only for measuring what detection costs.
export type UpdateOptions = {
  readonly detectChanges: boolean;
};

// Detection on, which is what a caller should use: it suppresses dirty ranges for unchanged rows.
export const defaultUpdateOptions: UpdateOptions = { detectChanges: true };

// The slots each group had written to, as one range per group. An uploader sends those ranges
// instead of whole buffers.
export class DirtyRanges {
  // First touched slot of each group, or -1.
  readonly first: Int32Array;
  // Last touched slot of each group, or -1.
  readonly last: Int32Array;
  private groups = 0;

  constructor(groupCount: number) {
    this.first = new Int32Array(groupCount).fill(-1);
    this.last = new Int32Array(groupCount).fill(-1);
  }

  // Groups with at least one touched slot.
  get touchedGroups(): number {
    return this.groups;
  }

  // Records that one slot of one group changed.
  mark(group: number, slot: number): void {
    const first = this.first[group];
    if (first === undefined) return;
    if (first === -1) {
      this.first[group] = slot;
      this.last[group] = slot;
      this.groups++;
      return;
    }
    if (slot < first) this.first[group] = slot;
    if (slot > (this.last[group] ?? slot)) this.last[group] = slot;
  }

  // Records that every slot of one group changed.
  markAll(group: number, count: number): void {
    if (count <= 0) return;
    this.mark(group, 0);
    this.mark(group, count - 1);
  }

  // Forgets every range, so the same object can be reused for the next update.
  reset(): void {
    this.first.fill(-1);
    this.last.fill(-1);
    this.groups = 0;
  }
}

// Colour and transform dirtiness are tracked apart because viewer-core publishes them apart.
export type DirtySets = {
  readonly colors: DirtyRanges;
  readonly transforms: DirtyRanges;
};

// Empty dirty sets sized for a table's groups.
export const dirtySets = (table: InstanceTable): DirtySets => ({
  colors: new DirtyRanges(table.groups.length),
  transforms: new DirtyRanges(table.groups.length),
});

// Rows a selection covers.
export const selectionSize = (table: InstanceTable, rows: RowSelection): number =>
  rows === everyRow ? table.rowCount : rows.length;

// Floats a writer advances per row: 0 when one value is broadcast, `stride` when there is one per
// row. Any other length is a caller error, because guessing what was meant would corrupt buffers.
const valueStep = (given: number, stride: number, rowCount: number): number => {
  if (given === stride) return 0;
  if (given === stride * rowCount) return stride;
  throw new Error(`expected ${stride} or ${stride * rowCount} values, received ${given}`);
};

// Writes the red, green and blue channels, leaving alpha to opacity and visibility.
export const writeColors = (
  table: InstanceTable,
  rows: RowSelection,
  rgb: Float32Array,
  dirty?: DirtySets,
  options: UpdateOptions = defaultUpdateOptions,
): number => {
  const count = selectionSize(table, rows);
  const step = valueStep(rgb.length, 3, count);
  const detect = options.detectChanges;
  const ranges = dirty?.colors;
  let written = 0;
  if (rows === everyRow) {
    for (let g = 0; g < table.groups.length; g++) {
      const buffer = table.groups[g]?.colors;
      const start = table.groupStart[g] ?? 0;
      const end = table.groupStart[g + 1] ?? start;
      if (buffer === undefined) continue;
      for (let row = start; row < end; row++) {
        const at = (row - start) * colorStride;
        const from = row * step;
        const r = rgb[from] ?? 0;
        const g1 = rgb[from + 1] ?? 0;
        const b = rgb[from + 2] ?? 0;
        if (detect && buffer[at] === r && buffer[at + 1] === g1 && buffer[at + 2] === b) continue;
        buffer[at] = r;
        buffer[at + 1] = g1;
        buffer[at + 2] = b;
        ranges?.mark(g, row - start);
        written++;
      }
    }
    return written;
  }
  for (let k = 0; k < rows.length; k++) {
    const row: number = rows[k] ?? 0;
    const group = table.groupOfRow[row] ?? -1;
    const buffer = table.groups[group]?.colors;
    if (buffer === undefined) continue;
    const slot = row - (table.groupStart[group] ?? 0);
    const at = slot * colorStride;
    const from = k * step;
    const r = rgb[from] ?? 0;
    const g1 = rgb[from + 1] ?? 0;
    const b = rgb[from + 2] ?? 0;
    if (detect && buffer[at] === r && buffer[at + 1] === g1 && buffer[at + 2] === b) continue;
    buffer[at] = r;
    buffer[at + 1] = g1;
    buffer[at + 2] = b;
    ranges?.mark(group, slot);
    written++;
  }
  return written;
};

// Writes the opacity a row draws with when shown, and the stored alpha that follows from it.
export const writeOpacity = (
  table: InstanceTable,
  rows: RowSelection,
  values: Float32Array,
  dirty?: DirtySets,
  options: UpdateOptions = defaultUpdateOptions,
): number => {
  const count = selectionSize(table, rows);
  const step = valueStep(values.length, 1, count);
  const detect = options.detectChanges;
  const ranges = dirty?.colors;
  let written = 0;
  for (let k = 0; k < count; k++) {
    const row = rows === everyRow ? k : rows[k] ?? 0;
    const group = table.groupOfRow[row] ?? -1;
    const buffer = table.groups[group]?.colors;
    if (buffer === undefined) continue;
    const value = Math.fround(values[k * step] ?? 0);
    const alpha = table.visible[row] === 1 ? value : 0;
    const slot = row - (table.groupStart[group] ?? 0);
    const at = slot * colorStride + alphaChannel;
    if (detect && table.opacity[row] === value && buffer[at] === alpha) continue;
    table.opacity[row] = value;
    buffer[at] = alpha;
    ranges?.mark(group, slot);
    written++;
  }
  return written;
};

// Shows or hides rows. Hiding writes an alpha of zero, which viewer-core's patched material
// discards, and keeps the row's opacity so showing it again restores what it had.
export const writeVisibility = (
  table: InstanceTable,
  rows: RowSelection,
  values: Uint8Array,
  dirty?: DirtySets,
  options: UpdateOptions = defaultUpdateOptions,
): number => {
  const count = selectionSize(table, rows);
  const step = valueStep(values.length, 1, count);
  const detect = options.detectChanges;
  const ranges = dirty?.colors;
  let written = 0;
  for (let k = 0; k < count; k++) {
    const row = rows === everyRow ? k : rows[k] ?? 0;
    const group = table.groupOfRow[row] ?? -1;
    const buffer = table.groups[group]?.colors;
    if (buffer === undefined) continue;
    const shown = (values[k * step] ?? 0) === 0 ? 0 : 1;
    const alpha = shown === 1 ? table.opacity[row] ?? 0 : 0;
    const slot = row - (table.groupStart[group] ?? 0);
    const at = slot * colorStride + alphaChannel;
    if (detect && table.visible[row] === shown && buffer[at] === alpha) continue;
    table.visible[row] = shown;
    buffer[at] = alpha;
    ranges?.mark(group, slot);
    written++;
  }
  return written;
};

// Writes whole column-major 4x4 transforms.
export const writeTransforms = (
  table: InstanceTable,
  rows: RowSelection,
  values: Float32Array,
  dirty?: DirtySets,
  options: UpdateOptions = defaultUpdateOptions,
): number => {
  const count = selectionSize(table, rows);
  const step = valueStep(values.length, transformStride, count);
  const detect = options.detectChanges;
  const ranges = dirty?.transforms;
  let written = 0;
  if (rows === everyRow) {
    for (let g = 0; g < table.groups.length; g++) {
      const buffer = table.groups[g]?.transforms;
      const start = table.groupStart[g] ?? 0;
      const end = table.groupStart[g + 1] ?? start;
      if (buffer === undefined) continue;
      for (let row = start; row < end; row++) {
        const at = (row - start) * transformStride;
        const from = row * step;
        if (detect && sameSpan(buffer, at, values, from, transformStride)) continue;
        for (let j = 0; j < transformStride; j++) buffer[at + j] = values[from + j] ?? 0;
        ranges?.mark(g, row - start);
        written++;
      }
    }
    return written;
  }
  for (let k = 0; k < rows.length; k++) {
    const row: number = rows[k] ?? 0;
    const group = table.groupOfRow[row] ?? -1;
    const buffer = table.groups[group]?.transforms;
    if (buffer === undefined) continue;
    const slot = row - (table.groupStart[group] ?? 0);
    const at = slot * transformStride;
    const from = k * step;
    if (detect && sameSpan(buffer, at, values, from, transformStride)) continue;
    for (let j = 0; j < transformStride; j++) buffer[at + j] = values[from + j] ?? 0;
    ranges?.mark(group, slot);
    written++;
  }
  return written;
};

// Writes only the translation of a transform, which is what moving an object changes.
export const writeTranslations = (
  table: InstanceTable,
  rows: RowSelection,
  values: Float32Array,
  dirty?: DirtySets,
  options: UpdateOptions = defaultUpdateOptions,
): number => {
  const count = selectionSize(table, rows);
  const step = valueStep(values.length, translationStride, count);
  const detect = options.detectChanges;
  const ranges = dirty?.transforms;
  let written = 0;
  for (let k = 0; k < count; k++) {
    const row = rows === everyRow ? k : rows[k] ?? 0;
    const group = table.groupOfRow[row] ?? -1;
    const buffer = table.groups[group]?.transforms;
    if (buffer === undefined) continue;
    const slot = row - (table.groupStart[group] ?? 0);
    const at = slot * transformStride + translationOffset;
    const from = k * step;
    const x = Math.fround(values[from] ?? 0);
    const y = Math.fround(values[from + 1] ?? 0);
    const z = Math.fround(values[from + 2] ?? 0);
    if (detect && buffer[at] === x && buffer[at + 1] === y && buffer[at + 2] === z) continue;
    buffer[at] = x;
    buffer[at + 1] = y;
    buffer[at + 2] = z;
    ranges?.mark(group, slot);
    written++;
  }
  return written;
};

const sameSpan = (
  stored: Float32Array,
  at: number,
  values: Float32Array,
  from: number,
  stride: number,
): boolean => {
  for (let j = 0; j < stride; j++) if (stored[at + j] !== values[from + j]) return false;
  return true;
};

// What a publish did: how many groups were told their colours or transforms moved.
export type PublishReport = {
  readonly colorGroups: number;
  readonly transformGroups: number;
};

// Tells viewer-core that the borrowed buffers moved, once per touched group.
//
// viewer-core offers no way to say "this range changed" without also supplying the values, so the
// colour publish hands a group back the slice it already holds and the transform publish rewrites
// one slot with the value already there. Both bump the group's version counter exactly once, which
// is what a mirror syncs on. A `markColorsChanged(start, count)` on `InstancedGroup` would remove
// both self-copies; it is requested in the track checkpoint.
export const publishDirty = (table: InstanceTable, dirty: DirtySets): PublishReport => {
  let colorGroups = 0;
  let transformGroups = 0;
  for (let g = 0; g < table.groups.length; g++) {
    const group = table.groups[g];
    if (group === undefined) continue;
    const firstColor = dirty.colors.first[g] ?? -1;
    if (firstColor >= 0) {
      const last = dirty.colors.last[g] ?? firstColor;
      group.setColors(
        firstColor,
        group.colors.subarray(firstColor * colorStride, (last + 1) * colorStride),
      );
      colorGroups++;
    }
    const firstTransform = dirty.transforms.first[g] ?? -1;
    if (firstTransform >= 0) {
      const at = firstTransform * transformStride;
      group.setTransform(firstTransform, group.transforms.subarray(at, at + transformStride));
      transformGroups++;
    }
  }
  return { colorGroups, transformGroups };
};

// The column names a change table is read through. A table names objects, not rows, because an
// object is what a command, a rule or a workflow result talks about.
export const updateColumns = {
  // Integer object ordinals, the fastest addressing.
  object: 'object',
  // Object keys, used when the caller has no ordinals.
  key: 'key',
  // Red, green and blue in [0, 1]; all three or none.
  red: 'red',
  green: 'green',
  blue: 'blue',
  // Opacity in [0, 1].
  opacity: 'opacity',
  // Non-zero shows the object.
  visible: 'visible',
  // Sixteen column-major transform elements named transform0 to transform15; all or none.
  transform: 'transform',
} as const;

// Names of the sixteen transform element columns, in column-major order.
export const transformColumnNames: readonly string[] = Array.from(
  { length: transformStride },
  (_unused, i) => `${updateColumns.transform}${i}`,
);

// What applying a change table did.
export type UpdateReport = {
  // Table rows the change table addressed, counting one per rendered instance.
  readonly rowsAddressed: number;
  // Rows whose stored value actually moved.
  readonly rowsWritten: number;
  // Change rows naming an object the table does not hold.
  readonly objectsMissing: number;
};

type Addressing = {
  readonly rows: Int32Array;
  readonly sourceOfRow: Int32Array;
  readonly missing: number;
};

const addressRows = (table: InstanceTable, changes: Table): Result<Addressing> => {
  const objects = numericColumnOf(changes, updateColumns.object);
  const keys = columnOf(changes, updateColumns.key);
  const byKey = keys !== undefined && keys.type === 'string';
  if (objects === undefined && !byKey)
    return failure([
      diagnostic(
        'no-addressing-column',
        `A change table needs an "${updateColumns.object}" or "${updateColumns.key}" column`,
        ['columns'],
      ),
    ]);
  const ordinals = new Int32Array(changes.rowCount).fill(-1);
  let missing = 0;
  let total = 0;
  for (let row = 0; row < changes.rowCount; row++) {
    const ordinal = objects !== undefined ? numberAt(objects, row) : ordinalOfKey(table, keys, row);
    if (ordinal === undefined || ordinal < 0 || ordinal >= table.keys.length) {
      missing++;
      continue;
    }
    ordinals[row] = ordinal;
    total += (table.objectStart[ordinal + 1] ?? 0) - (table.objectStart[ordinal] ?? 0);
  }
  const rows = new Int32Array(total);
  const sourceOfRow = new Int32Array(total);
  let at = 0;
  for (let row = 0; row < changes.rowCount; row++) {
    const ordinal = ordinals[row] ?? -1;
    if (ordinal < 0) continue;
    const start = table.objectStart[ordinal] ?? 0;
    const end = table.objectStart[ordinal + 1] ?? start;
    for (let i = start; i < end; i++) {
      rows[at] = table.objectRows[i] ?? 0;
      sourceOfRow[at] = row;
      at++;
    }
  }
  return success({ rows, sourceOfRow, missing });
};

const ordinalOfKey = (
  table: InstanceTable,
  keys: Column | undefined,
  row: number,
): number | undefined => {
  if (keys === undefined || keys.type !== 'string') return undefined;
  const key: ObjectKey | undefined = stringAt(keys, row);
  return key === undefined ? undefined : table.objectOfKey.get(key);
};

// Expands one value per change row into one value per addressed table row.
const expand = (
  source: (row: number) => number,
  sourceOfRow: Int32Array,
  stride: number,
  element: number,
  target: Float32Array,
): void => {
  for (let k = 0; k < sourceOfRow.length; k++)
    target[k * stride + element] = source(sourceOfRow[k] ?? 0);
};

const readers = (changes: Table, names: readonly string[]): readonly ((row: number) => number)[] | undefined => {
  const columns = names.map((name) => numericColumnOf(changes, name));
  if (columns.some((column) => column === undefined)) return undefined;
  return columns.map((column) => (row: number) => (column === undefined ? 0 : numberAt(column, row) ?? 0));
};

const partial = (changes: Table, names: readonly string[]): boolean =>
  names.some((name) => columnOf(changes, name) !== undefined);

// Applies a table of changed columns: colour, opacity, visibility and transform, in that order.
//
// The table addresses objects; one object expands to every row it draws. Columns that are absent
// are not touched, so a caller sends only what changed. A colour needs all three channels and a
// transform needs all sixteen elements; a partial set is refused rather than half applied.
export const applyUpdates = (
  table: InstanceTable,
  changes: Table,
  dirty?: DirtySets,
  options: UpdateOptions = defaultUpdateOptions,
): Result<UpdateReport> => {
  const addressed = addressRows(table, changes);
  if (!addressed.ok) return addressed;
  const { rows, sourceOfRow, missing } = addressed.value;
  const notes: Diagnostic[] = [];
  if (missing > 0)
    notes.push(
      diagnostic('unknown-object', `${missing} change rows name an object the scene does not hold`, ['rows'], 'warning'),
    );

  const rgbNames = [updateColumns.red, updateColumns.green, updateColumns.blue];
  const rgb = readers(changes, rgbNames);
  if (rgb === undefined && partial(changes, rgbNames))
    return failure([diagnostic('partial-color', 'A colour change needs red, green and blue', ['columns'])]);
  const matrix = readers(changes, transformColumnNames);
  if (matrix === undefined && partial(changes, transformColumnNames))
    return failure([
      diagnostic('partial-transform', `A transform change needs all ${transformStride} elements`, ['columns']),
    ]);

  let written = 0;
  if (rgb !== undefined) {
    const values = new Float32Array(rows.length * 3);
    for (let element = 0; element < 3; element++)
      expand(rgb[element] ?? (() => 0), sourceOfRow, 3, element, values);
    written += writeColors(table, rows, values, dirty, options);
  }
  const opacity = numericColumnOf(changes, updateColumns.opacity);
  if (opacity !== undefined) {
    const values = new Float32Array(rows.length);
    expand((row) => numberAt(opacity, row) ?? 0, sourceOfRow, 1, 0, values);
    written += writeOpacity(table, rows, values, dirty, options);
  }
  const visible = columnOf(changes, updateColumns.visible);
  if (visible !== undefined) {
    const values = new Uint8Array(rows.length);
    for (let k = 0; k < rows.length; k++)
      values[k] = shownAt(visible, sourceOfRow[k] ?? 0) ? 1 : 0;
    written += writeVisibility(table, rows, values, dirty, options);
  }
  if (matrix !== undefined) {
    const values = new Float32Array(rows.length * transformStride);
    for (let element = 0; element < transformStride; element++)
      expand(matrix[element] ?? (() => 0), sourceOfRow, transformStride, element, values);
    written += writeTransforms(table, rows, values, dirty, options);
  }
  return success({ rowsAddressed: rows.length, rowsWritten: written, objectsMissing: missing }, notes);
};

const shownAt = (column: Column, row: number): boolean => {
  if (column.type === 'string') return column.values[row] !== '';
  return (column.values[row] ?? 0) !== 0;
};
