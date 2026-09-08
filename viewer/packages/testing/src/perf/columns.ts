/**
 * A columnar instance table over borrowed group buffers.
 *
 * This is the layout the V2 `render` package is meant to use: one row per
 * rendered instance, integer columns saying which group buffer and which slot
 * a row lives in, and bulk writes that take a table of changed values and
 * write straight into the group buffers. There are no per-instance JavaScript
 * objects. It exists here so the layout can be measured against the alpha's
 * per-instance binding objects.
 */
import { InstancedGroup } from '@ara3d/viewer-core';
import { COLOR_FLOATS, TRANSFORM_FLOATS } from './scene.js';

/** The two per-instance attributes the group buffers hold. */
export type InstanceAttribute = 'color' | 'transform';

/** Floats per row for an attribute. */
export const attributeStride = (attribute: InstanceAttribute): number =>
  attribute === 'color' ? COLOR_FLOATS : TRANSFORM_FLOATS;

/** Column-oriented view of a set of instanced groups. The buffers are borrowed, never copied. */
export interface InstanceColumns {
  readonly rowCount: number;
  readonly groupCount: number;
  /** Group ordinal of each row. */
  readonly groupOf: Int32Array;
  /** Instance slot inside that group, for each row. */
  readonly indexInGroup: Int32Array;
  readonly colors: readonly Float32Array[];
  readonly transforms: readonly Float32Array[];
}

/** Builds the row index for `groups`, in group order. */
export function createInstanceColumns(groups: readonly InstancedGroup[]): InstanceColumns {
  let rowCount = 0;
  for (const group of groups) rowCount += group.instanceCount;
  const groupOf = new Int32Array(rowCount);
  const indexInGroup = new Int32Array(rowCount);
  let row = 0;
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    if (!group) throw new Error('missing group');
    for (let i = 0; i < group.instanceCount; i++) {
      groupOf[row] = g;
      indexInGroup[row] = i;
      row++;
    }
  }
  return {
    rowCount,
    groupCount: groups.length,
    groupOf,
    indexInGroup,
    colors: groups.map((group) => group.colors),
    transforms: groups.map((group) => group.transforms),
  };
}

/** Columns whose per-group buffers are views into one allocation per attribute. */
export interface SharedInstanceColumns extends InstanceColumns {
  /** Every instance colour, in row order. */
  readonly colorStore: Float32Array;
  /** Every instance transform, in row order. */
  readonly transformStore: Float32Array;
}

/**
 * The same row index, but with every group's values held in one allocation per
 * attribute and each group's buffer a view into it. Current values are copied
 * in. This is the layout under test: the rows of a bulk update land in one
 * array instead of thousands of small ones, one dirty range can cover them, and
 * an update that covers the whole model needs no per-row indirection at all.
 */
export function createSharedColumns(groups: readonly InstancedGroup[]): SharedInstanceColumns {
  const base = createInstanceColumns(groups);
  const flatColors = new Float32Array(base.rowCount * COLOR_FLOATS);
  const flatTransforms = new Float32Array(base.rowCount * TRANSFORM_FLOATS);
  const colors: Float32Array[] = [];
  const transforms: Float32Array[] = [];
  let row = 0;
  for (const group of groups) {
    const count = group.instanceCount;
    const colorView = flatColors.subarray(row * COLOR_FLOATS, (row + count) * COLOR_FLOATS);
    colorView.set(group.colors);
    colors.push(colorView);
    const transformView = flatTransforms.subarray(row * TRANSFORM_FLOATS, (row + count) * TRANSFORM_FLOATS);
    transformView.set(group.transforms);
    transforms.push(transformView);
    row += count;
  }
  return { ...base, colors, transforms, colorStore: flatColors, transformStore: flatTransforms };
}

/**
 * The instance slots each group had written to it, as one range per group.
 * A renderer uses these to upload a sub-range instead of a whole buffer.
 */
export class DirtyRanges {
  /** First touched slot per group, or -1. */
  readonly first: Int32Array;
  /** Last touched slot per group, or -1. */
  readonly last: Int32Array;
  private touched = 0;

  constructor(groupCount: number) {
    this.first = new Int32Array(groupCount).fill(-1);
    this.last = new Int32Array(groupCount).fill(-1);
  }

  /** Number of groups with at least one touched slot. */
  get touchedGroups(): number { return this.touched; }

  mark(group: number, slot: number): void {
    const first = this.first[group];
    if (first === undefined) throw new Error(`group ${group} out of range`);
    if (first === -1) {
      this.first[group] = slot;
      this.last[group] = slot;
      this.touched++;
      return;
    }
    if (slot < first) this.first[group] = slot;
    const last = this.last[group] ?? slot;
    if (slot > last) this.last[group] = slot;
  }

  reset(): void {
    this.first.fill(-1);
    this.last.fill(-1);
    this.touched = 0;
  }
}

/**
 * Writes `values` into the group buffers for the listed rows.
 *
 * `values` is either one value per row (`rows.length * stride` floats) or a
 * single value broadcast to every row (`stride` floats). It must already be a
 * Float32Array so change detection compares like with like: a double written
 * into a Float32Array is rounded, and comparing the unrounded double would
 * report a change that did not happen.
 *
 * Returns the number of rows actually written. With `detectChanges`, rows
 * whose stored value already equals the new one are skipped and not marked
 * dirty.
 */
export function writeRows(
  columns: InstanceColumns,
  attribute: InstanceAttribute,
  rows: Int32Array,
  values: Float32Array,
  dirty: DirtyRanges | null,
  detectChanges: boolean,
): number {
  const stride = attributeStride(attribute);
  const broadcast = values.length === stride;
  if (!broadcast && values.length !== rows.length * stride)
    throw new Error(`values length ${values.length} is neither ${stride} nor ${rows.length * stride}`);
  const step = broadcast ? 0 : stride;
  const buffers = attribute === 'color' ? columns.colors : columns.transforms;
  let written = 0;
  for (let k = 0; k < rows.length; k++) {
    const row = rows[k] ?? 0;
    const group = columns.groupOf[row] ?? 0;
    const buffer = buffers[group];
    const slot = columns.indexInGroup[row] ?? 0;
    if (!buffer) throw new Error(`row ${row} has no group buffer`);
    const target = slot * stride;
    const source = k * step;
    if (detectChanges) {
      let same = true;
      for (let j = 0; j < stride; j++) {
        if (buffer[target + j] !== values[source + j]) { same = false; break; }
      }
      if (same) continue;
    }
    for (let j = 0; j < stride; j++) buffer[target + j] = values[source + j] ?? 0;
    if (dirty) dirty.mark(group, slot);
    written++;
  }
  return written;
}

/**
 * The same write as `writeRows` without change detection, but each row is
 * copied with `TypedArray.set` instead of an element loop.
 *
 * `writeRows` has to look at every float to decide whether it changed, so it
 * loops. When no detection is wanted the copy can be one call, which for a wide
 * attribute like a 16-float transform is a different order of work. Kept
 * separate from `writeRows` so the two can be measured against each other.
 */
export function copyRows(
  columns: InstanceColumns,
  attribute: InstanceAttribute,
  rows: Int32Array,
  values: Float32Array,
  dirty: DirtyRanges | null,
): number {
  const stride = attributeStride(attribute);
  const broadcast = values.length === stride;
  if (!broadcast && values.length !== rows.length * stride)
    throw new Error(`values length ${values.length} is neither ${stride} nor ${rows.length * stride}`);
  const buffers = attribute === 'color' ? columns.colors : columns.transforms;
  for (let k = 0; k < rows.length; k++) {
    const row = rows[k] ?? 0;
    const group = columns.groupOf[row] ?? 0;
    const buffer = buffers[group];
    const slot = columns.indexInGroup[row] ?? 0;
    if (!buffer) throw new Error(`row ${row} has no group buffer`);
    buffer.set(broadcast ? values : values.subarray(k * stride, (k + 1) * stride), slot * stride);
    if (dirty) dirty.mark(group, slot);
  }
  return rows.length;
}

/** Floats per translation. */
export const TRANSLATION_FLOATS = 3;
/** Offset of the translation inside a column-major 4x4 transform. */
export const TRANSLATION_OFFSET = 12;

/**
 * Writes only the translation of the listed rows' transforms, leaving the
 * rotation and scale alone. `values` is either three floats broadcast to every
 * row or three per row. Moving objects is the common transform edit, and it
 * touches 3 of the 16 floats.
 */
export function writeTranslations(
  columns: InstanceColumns,
  rows: Int32Array,
  values: Float32Array,
  dirty: DirtyRanges | null,
  detectChanges: boolean,
): number {
  const broadcast = values.length === TRANSLATION_FLOATS;
  if (!broadcast && values.length !== rows.length * TRANSLATION_FLOATS)
    throw new Error(`values length ${values.length} is neither 3 nor ${rows.length * TRANSLATION_FLOATS}`);
  const step = broadcast ? 0 : TRANSLATION_FLOATS;
  let written = 0;
  for (let k = 0; k < rows.length; k++) {
    const row = rows[k] ?? 0;
    const group = columns.groupOf[row] ?? 0;
    const buffer = columns.transforms[group];
    const slot = columns.indexInGroup[row] ?? 0;
    if (!buffer) throw new Error(`row ${row} has no group buffer`);
    const target = slot * TRANSFORM_FLOATS + TRANSLATION_OFFSET;
    const source = k * step;
    const x = values[source] ?? 0, y = values[source + 1] ?? 0, z = values[source + 2] ?? 0;
    if (detectChanges && buffer[target] === x && buffer[target + 1] === y && buffer[target + 2] === z) continue;
    buffer[target] = x;
    buffer[target + 1] = y;
    buffer[target + 2] = z;
    if (dirty) dirty.mark(group, slot);
    written++;
  }
  return written;
}

/** Sets one channel of an attribute for the listed rows. Used for visibility through alpha. */
export function writeChannel(
  columns: InstanceColumns,
  attribute: InstanceAttribute,
  channel: number,
  value: number,
  rows: Int32Array,
  dirty: DirtyRanges | null,
  detectChanges: boolean,
): number {
  const stride = attributeStride(attribute);
  if (channel < 0 || channel >= stride) throw new Error(`channel ${channel} out of range`);
  const rounded = Math.fround(value);
  const buffers = attribute === 'color' ? columns.colors : columns.transforms;
  let written = 0;
  for (let k = 0; k < rows.length; k++) {
    const row = rows[k] ?? 0;
    const group = columns.groupOf[row] ?? 0;
    const buffer = buffers[group];
    const slot = columns.indexInGroup[row] ?? 0;
    if (!buffer) throw new Error(`row ${row} has no group buffer`);
    const target = slot * stride + channel;
    if (detectChanges && buffer[target] === rounded) continue;
    buffer[target] = rounded;
    if (dirty) dirty.mark(group, slot);
    written++;
  }
  return written;
}
