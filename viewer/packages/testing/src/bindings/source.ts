/**
 * What the binding step reads out of a parsed model.
 *
 * The loaders hand back typed arrays that are views on the file: the BFAST
 * instance table is one 64-byte record per instance, so the entity index of
 * every instance already sits in `instanceInts` at word 13 of every 16. The
 * types here address such a column in place, by offset and stride, so that
 * nothing has to be copied out of the loader's output before the binding step
 * can read it.
 */
import type { BosConvertResult, BosGroupEntities, RenderModel } from '@ara3d/viewer-loaders';

// A column of integers inside a larger typed array, addressed by offset and stride.
export type IntColumn = {
  readonly values: Int32Array | Uint32Array;
  readonly count: number;
  readonly offset: number;
  readonly stride: number;
};

// A whole typed array read as one column.
export const denseColumn = (values: Int32Array | Uint32Array): IntColumn =>
  ({ values, count: values.length, offset: 0, stride: 1 });

// One field of a record table read as a column, without copying the table.
export const stridedColumn = (values: Int32Array | Uint32Array, offset: number, stride: number): IntColumn =>
  ({ values, count: Math.max(0, Math.ceil((values.length - offset) / stride)), offset, stride });

// The value of one row. Throws rather than returning a placeholder for a row that is not there.
export const columnAt = (column: IntColumn, row: number): number => {
  const value = column.values[column.offset + row * column.stride];
  if (value === undefined) throw new Error(`column row ${row} is outside the table`);
  return value;
};

/**
 * Everything the binding step needs, all of it borrowed from the loader output.
 *
 * `instanceEntities` covers every instance record of the source, including the
 * hidden ones and the ones with no mesh, because their entities are still
 * objects of the model. `groups` covers only the instances that were converted
 * into render groups.
 */
export type BindingSource = {
  readonly instanceEntities: IntColumn;
  readonly entityLocalIds: Int32Array | null;
  readonly groups: readonly BosGroupEntities[];
};

// Word 13 of every 16-word BFAST instance record holds the entity index.
const bfastEntityWord = 13;

// Words per BFAST instance record.
const bfastInstanceWords = 16;

// The binding source of a parsed BFAST model and its converted groups. Copies nothing.
export const bfastBindingSource = (
  model: Pick<RenderModel, 'instanceInts'>,
  converted: Pick<BosConvertResult, 'groupEntities'>,
  entityLocalIds: Int32Array | null,
): BindingSource => ({
  instanceEntities: stridedColumn(model.instanceInts, bfastEntityWord, bfastInstanceWords),
  entityLocalIds,
  groups: converted.groupEntities,
});
