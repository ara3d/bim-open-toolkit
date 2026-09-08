/**
 * Two ways to say which rendered instances belong to which model object.
 *
 * The alpha keeps one frozen JavaScript object per rendered instance and three
 * maps over them; see `viewer/packages/visualization/src/render.ts`, where
 * `RenderBinding` holds `models`, `objects` and `instances`. This module
 * reproduces that layout closely enough to measure it, and puts the columnar
 * alternative beside it: object ordinals, a compressed row index, and no
 * per-instance objects at all.
 *
 * Nothing here is imported by production code. It exists so the two layouts can
 * be built at the same sizes and compared for build time and memory.
 */
import type { InstancedGroup } from '@ara3d/viewer-core';
import type { SyntheticScene } from './scene.js';

/** Mirrors the alpha's `ObjectRef`. */
export interface ObjectRef {
  readonly modelId: string;
  readonly objectId: string;
}

/** Mirrors the alpha's `objectKey`: the map key is a JSON string. */
export const objectKey = (ref: ObjectRef): string => JSON.stringify([ref.modelId, ref.objectId]);

/** Mirrors the alpha's `InstanceBinding`. One of these exists per rendered instance. */
export interface InstanceBinding {
  readonly ref: ObjectRef;
  readonly representationId: string;
  readonly group: InstancedGroup;
  readonly instanceIndex: number;
}

/** Mirrors the three maps `RenderBinding` keeps. */
export interface BindingObjects {
  readonly modelId: string;
  readonly byModel: readonly InstanceBinding[];
  readonly byObject: Map<string, InstanceBinding[]>;
  readonly byInstance: Map<InstancedGroup, Map<number, InstanceBinding>>;
}

/**
 * The columnar alternative: one row range per object, no per-instance objects.
 *
 * Objects are numbered, their rows are stored consecutively in `rows`, and
 * `rowStart[o]` to `rowStart[o + 1]` is object `o`'s slice. Looking an object up
 * by identity is one map lookup returning an integer.
 */
export interface ObjectColumns {
  readonly objectCount: number;
  readonly rowStart: Int32Array;
  readonly rows: Int32Array;
  readonly ordinalOf: Map<string, number>;
}

/** The object each row belongs to. Consecutive rows share an object, as in a real model. */
export function objectOfRow(rowCount: number, objectCount: number): Int32Array {
  if (objectCount < 1 || objectCount > rowCount)
    throw new Error(`${objectCount} objects cannot cover ${rowCount} rows`);
  const owner = new Int32Array(rowCount);
  for (let row = 0; row < rowCount; row++) owner[row] = Math.floor((row * objectCount) / rowCount);
  return owner;
}

/** Object identifiers, in ordinal order. */
export const objectIds = (objectCount: number): string[] =>
  Array.from({ length: objectCount }, (_, o) => `object-${o}`);

/** Builds the alpha's layout: a frozen binding per instance, plus its three maps. */
export function buildBindingObjects(
  scene: SyntheticScene,
  owner: Int32Array,
  ids: readonly string[],
  modelId: string,
): BindingObjects {
  const byModel: InstanceBinding[] = [];
  const byObject = new Map<string, InstanceBinding[]>();
  const byInstance = new Map<InstancedGroup, Map<number, InstanceBinding>>();
  for (let row = 0; row < scene.rowCount; row++) {
    const groupIndex = scene.groupOf[row] ?? 0;
    const group = scene.groups[groupIndex];
    const objectId = ids[owner[row] ?? 0];
    if (!group || objectId === undefined) throw new Error(`row ${row} has no group or object`);
    const instanceIndex = scene.indexInGroup[row] ?? 0;
    const binding = Object.freeze({
      ref: Object.freeze({ modelId, objectId }),
      representationId: `representation-${groupIndex}`,
      group,
      instanceIndex,
    });
    byModel.push(binding);
    const key = objectKey(binding.ref);
    const entries = byObject.get(key) ?? [];
    entries.push(binding);
    byObject.set(key, entries);
    const slots = byInstance.get(group) ?? new Map<number, InstanceBinding>();
    slots.set(instanceIndex, binding);
    byInstance.set(group, slots);
  }
  return { modelId, byModel, byObject, byInstance };
}

/** Builds the columnar layout from the same assignment. */
export function buildObjectColumns(
  rowCount: number,
  owner: Int32Array,
  ids: readonly string[],
  modelId: string,
): ObjectColumns {
  const objectCount = ids.length;
  const counts = new Int32Array(objectCount);
  for (let row = 0; row < rowCount; row++) counts[owner[row] ?? 0] = (counts[owner[row] ?? 0] ?? 0) + 1;
  const rowStart = new Int32Array(objectCount + 1);
  for (let o = 0; o < objectCount; o++) rowStart[o + 1] = (rowStart[o] ?? 0) + (counts[o] ?? 0);
  const rows = new Int32Array(rowCount);
  const head = Int32Array.from(rowStart.subarray(0, objectCount));
  for (let row = 0; row < rowCount; row++) {
    const o = owner[row] ?? 0;
    rows[head[o] ?? 0] = row;
    head[o] = (head[o] ?? 0) + 1;
  }
  const ordinalOf = new Map<string, number>();
  for (let o = 0; o < objectCount; o++) {
    const objectId = ids[o];
    if (objectId === undefined) throw new Error(`object ${o} has no id`);
    ordinalOf.set(objectKey({ modelId, objectId }), o);
  }
  return { objectCount, rowStart, rows, ordinalOf };
}

/** The rows of object `ordinal`. A view, not a copy. */
export const rowsOfObject = (columns: ObjectColumns, ordinal: number): Int32Array =>
  columns.rows.subarray(columns.rowStart[ordinal] ?? 0, columns.rowStart[ordinal + 1] ?? 0);
