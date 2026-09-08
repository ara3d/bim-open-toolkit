/**
 * The rendered instances of a model as columns over the group buffers.
 *
 * The alpha loader builds one frozen `InstanceBinding` object per rendered
 * instance, and copies that instance's 4x4 transform and RGBA colour factor out
 * of the group buffers into two more frozen arrays inside it. The buffers still
 * hold both values, so the copies say nothing the group does not already say.
 *
 * This table keeps three integers per instance and reads the transform and the
 * colour straight back out of the group. The override columns exist for the
 * case the alpha never produces at load time: a representation whose transform
 * or colour has been changed away from what its group holds. A column is
 * allocated only once some row needs it.
 */
import type { InstancedGroup } from '@ara3d/viewer-core';

/** Floats per instance transform (column-major 4x4). */
export const transformFloats = 16;

/** Floats per instance colour factor (RGBA). */
export const colorFloats = 4;

/** One row per rendered instance. Every column is indexed by row. */
export type RepresentationTable = {
  readonly count: number;
  /** Row of `ObjectTable` the instance represents. */
  readonly objectIndex: Int32Array;
  /** Position of the owning group in the binding's `groups`. */
  readonly groupIndex: Int32Array;
  /** Instance slot inside that group. */
  readonly instanceIndex: Int32Array;
  /** `colorFloats` per row, present only when some row overrides its group's colour. */
  readonly colorFactor?: Float32Array | undefined;
  /** `transformFloats` per row, present only when some row overrides its group's transform. */
  readonly localTransform?: Float32Array | undefined;
};

/** A loaded model's render side: the groups, the instance rows over them, and the objects. */
export type ColumnarBinding = {
  readonly groups: readonly InstancedGroup[];
  readonly table: RepresentationTable;
};

/** What instance `row` is: which object it draws, where, and in what colour. */
export type InstanceView = {
  readonly row: number;
  readonly objectIndex: number;
  readonly groupIndex: number;
  readonly instanceIndex: number;
  /** `transformFloats` floats. A view on the group buffer, or on the override column. */
  readonly transform: Float32Array;
  /** `colorFloats` floats. A view on the group buffer, or on the override column. */
  readonly color: Float32Array;
};

const requireGroup = (groups: readonly InstancedGroup[], index: number): InstancedGroup => {
  const group = groups[index];
  if (group === undefined) throw new Error(`representation row names group ${index}, which is not loaded`);
  return group;
};

const requireRow = (table: RepresentationTable, row: number): number => {
  if (!Number.isInteger(row) || row < 0 || row >= table.count)
    throw new Error(`representation row ${row} is outside the table`);
  return row;
};

/** Object row of instance `row`. */
export const instanceObjectIndex = (table: RepresentationTable, row: number): number =>
  table.objectIndex[requireRow(table, row)] ?? -1;

/** Transform of instance `row` as a view, without copying it. */
export function instanceTransform(binding: ColumnarBinding, row: number): Float32Array {
  const { table } = binding;
  const at = requireRow(table, row) * transformFloats;
  if (table.localTransform !== undefined) return table.localTransform.subarray(at, at + transformFloats);
  const group = requireGroup(binding.groups, table.groupIndex[row] ?? -1);
  const start = (table.instanceIndex[row] ?? 0) * transformFloats;
  return group.transforms.subarray(start, start + transformFloats);
}

/** Colour factor of instance `row` as a view, without copying it. */
export function instanceColor(binding: ColumnarBinding, row: number): Float32Array {
  const { table } = binding;
  const at = requireRow(table, row) * colorFloats;
  if (table.colorFactor !== undefined) return table.colorFactor.subarray(at, at + colorFloats);
  const group = requireGroup(binding.groups, table.groupIndex[row] ?? -1);
  const start = (table.instanceIndex[row] ?? 0) * colorFloats;
  return group.colors.subarray(start, start + colorFloats);
}

/** Which object, transform and colour instance `row` has. Allocates views, never copies values. */
export const instanceAt = (binding: ColumnarBinding, row: number): InstanceView => ({
  row,
  objectIndex: instanceObjectIndex(binding.table, row),
  groupIndex: binding.table.groupIndex[row] ?? -1,
  instanceIndex: binding.table.instanceIndex[row] ?? -1,
  transform: instanceTransform(binding, row),
  color: instanceColor(binding, row),
});

/** The alpha loader's representation id for a row, derived rather than stored. */
export const representationIdAt = (table: RepresentationTable, row: number): string =>
  `bos:${table.groupIndex[requireRow(table, row)] ?? -1}:${table.instanceIndex[row] ?? -1}`;

/** Bytes the table's own columns retain, so two layouts can be compared. */
export const tableBytes = (table: RepresentationTable): number =>
  table.objectIndex.byteLength + table.groupIndex.byteLength + table.instanceIndex.byteLength
  + (table.colorFactor?.byteLength ?? 0) + (table.localTransform?.byteLength ?? 0);

/**
 * The table with a colour override column, so a row can hold a colour its group
 * does not. Rows that had no override keep the group's current colour.
 */
export function withColorOverrides(binding: ColumnarBinding): RepresentationTable {
  const { table } = binding;
  if (table.colorFactor !== undefined) return table;
  const colorFactor = new Float32Array(table.count * colorFloats);
  for (let row = 0; row < table.count; row += 1) colorFactor.set(instanceColor(binding, row), row * colorFloats);
  return { ...table, colorFactor };
}

/**
 * The table with a transform override column, so a row can hold a transform its
 * group does not. Rows that had no override keep the group's current transform.
 */
export function withTransformOverrides(binding: ColumnarBinding): RepresentationTable {
  const { table } = binding;
  if (table.localTransform !== undefined) return table;
  const localTransform = new Float32Array(table.count * transformFloats);
  for (let row = 0; row < table.count; row += 1)
    localTransform.set(instanceTransform(binding, row), row * transformFloats);
  return { ...table, localTransform };
}
