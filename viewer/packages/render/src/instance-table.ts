// A columnar binding from a model `Geometry` to viewer-core instanced groups.
//
// One row per rendered instance. Rows are ordered by mesh, so the rows of a group are contiguous
// and a group's buffer is a straight slice of the row space. Everything a caller addresses -
// object keys, object ordinals, groups, slots - is reached through typed-array index columns, so
// no per-instance JavaScript object is ever created. The instance-update study
// (`viewer/packages/testing/docs/instance-updates.md`) measured contiguous rows at a tenth of the
// cost of scattered ones, which is why the row order is part of this structure rather than a
// caller's problem.
//
// The group buffers are borrowed. This module writes into them through `updates.ts` and never
// copies instance data back out.

import {
  InstancedGroup,
  defaultMaterial,
  type MaterialConfig,
  type MeshBuffers,
} from '@ara3d/viewer-core';
import {
  colorStride,
  diagnostic,
  failure,
  isInstanceVisible,
  noMesh,
  success,
  transformStride,
  type Geometry,
  type Mesh,
  type ObjectKey,
  type Result,
} from '@bim-open-toolkit/model';
import { geometryMeshAt, geometryMeshCount, geometryMeshTriangles } from './geometry-meshes.js';

// Offset of the alpha channel inside an RGBA instance colour.
export const alphaChannel = 3;

// Offset of the translation inside a column-major 4x4 transform.
export const translationOffset = 12;

// Floats in a translation.
export const translationStride = 3;

// What a row is bound to, in typed-array columns. Every array is owned by the table and read by
// `updates.ts`; `groups` is borrowed by whatever scene the caller adds them to.
export type InstanceTable = {
  // Rendered instances. Geometry-free instance records contribute no row.
  readonly rowCount: number;
  // One group per mesh that has at least one instance, in mesh order.
  readonly groups: readonly InstancedGroup[];
  // Each group's live colour buffer, captured once. `InstancedGroup.colors` allocates a new view
  // on every access, so a per-row loop must never read it; these are the views the writers use.
  // The table borrows them, so nothing may append instances to a group after the table is built.
  readonly colors: readonly Float32Array[];
  // Each group's live transform buffer, captured once, on the same terms as `colors`.
  readonly transforms: readonly Float32Array[];
  // First row of each group, with a final entry equal to `rowCount`. Length is groups + 1.
  readonly groupStart: Int32Array;
  // Group ordinal of each row.
  readonly groupOfRow: Int32Array;
  // Mesh index each group draws, addressing whichever form the geometry carries.
  readonly meshOfGroup: Int32Array;
  // Object ordinal of each row.
  readonly objectOfRow: Int32Array;
  // Every row, grouped by object ordinal; the rows of one object are contiguous here.
  readonly objectRows: Int32Array;
  // First entry in `objectRows` for each object, with a final entry equal to `rowCount`.
  readonly objectStart: Int32Array;
  // Row of the source instance record each row came from.
  readonly instanceOfRow: Int32Array;
  // Object key of each object ordinal.
  readonly keys: readonly ObjectKey[];
  // Object ordinal of each key. One entry per object, never per instance.
  readonly objectOfKey: ReadonlyMap<ObjectKey, number>;
  // The opacity a row draws with when it is visible. Hiding a row does not lose it.
  readonly opacity: Float32Array;
  // 1 when a row is shown, 0 when it is hidden. The stored alpha is `visible ? opacity : 0`.
  readonly visible: Uint8Array;
};

// How to build the groups. The material is shared by every group; per-material grouping is the
// caller's job because only the caller knows what a material means in its format.
export type InstanceTableOptions = {
  readonly material: MaterialConfig;
};

// One shared opaque material, which is what a format with no material information should use.
export const defaultTableOptions: InstanceTableOptions = { material: defaultMaterial };

// A model mesh as the buffers viewer-core draws. Typed arrays are shared, not copied.
export const meshBuffers = (source: Mesh): MeshBuffers => ({
  positions: source.positions,
  indices: source.indices,
  ...(source.normals === undefined ? {} : { normals: source.normals }),
});

// Group ordinal of a row, or -1 when the row is out of range.
export const groupOf = (table: InstanceTable, row: number): number =>
  table.groupOfRow[row] ?? -1;

// Slot of a row inside its group's buffers, or -1 when the row is out of range.
export const slotOf = (table: InstanceTable, row: number): number => {
  const group = table.groupOfRow[row];
  if (group === undefined) return -1;
  return row - (table.groupStart[group] ?? 0);
};

// Number of groups the table built.
export const groupCount = (table: InstanceTable): number => table.groups.length;

// Number of objects the table knows, including objects with no rendered instance.
export const objectCount = (table: InstanceTable): number => table.keys.length;

// Rows of one object ordinal, as a view into `objectRows`. Empty when the object has no geometry.
export const rowsOfObject = (table: InstanceTable, object: number): Int32Array => {
  const start = table.objectStart[object];
  const end = table.objectStart[object + 1];
  if (start === undefined || end === undefined) return new Int32Array(0);
  return table.objectRows.subarray(start, end);
};

// Rows of one object key, empty when the key is unknown or has no geometry.
export const rowsOfKey = (table: InstanceTable, key: ObjectKey): Int32Array => {
  const object = table.objectOfKey.get(key);
  return object === undefined ? new Int32Array(0) : rowsOfObject(table, object);
};

// Object key a row belongs to, or undefined when the row is out of range.
export const keyOfRow = (table: InstanceTable, row: number): ObjectKey | undefined => {
  const object = table.objectOfRow[row];
  return object === undefined ? undefined : table.keys[object];
};

// The stored RGBA of a row, read straight from the group buffer.
export const colorOfRow = (table: InstanceTable, row: number): readonly number[] => {
  const colors = table.colors[groupOf(table, row)];
  if (colors === undefined) return [];
  const at = slotOf(table, row) * colorStride;
  return [colors[at] ?? 0, colors[at + 1] ?? 0, colors[at + 2] ?? 0, colors[at + 3] ?? 0];
};

// The stored transform of a row, as sixteen column-major floats.
export const transformOfRow = (table: InstanceTable, row: number): readonly number[] => {
  const stored = table.transforms[groupOf(table, row)];
  if (stored === undefined) return [];
  const at = slotOf(table, row) * transformStride;
  const values: number[] = [];
  for (let i = 0; i < transformStride; i++) values.push(stored[at + i] ?? 0);
  return values;
};

// Rendered triangles, summed over instances: what the scene actually draws.
export const renderedTriangles = (table: InstanceTable, geometry: Geometry): number => {
  let total = 0;
  for (let g = 0; g < table.groups.length; g++) {
    const triangles = geometryMeshTriangles(geometry, table.meshOfGroup[g] ?? -1);
    if (triangles === 0) continue;
    const rows = (table.groupStart[g + 1] ?? 0) - (table.groupStart[g] ?? 0);
    total += rows * triangles;
  }
  return total;
};

// Rows currently shown. Counted, not cached, because a bulk update must not pay to keep a total.
export const visibleRows = (table: InstanceTable): number => {
  let shown = 0;
  for (let row = 0; row < table.rowCount; row++) if (table.visible[row] === 1) shown++;
  return shown;
};

// Counts a row plan needs before any allocation: rows per mesh and the meshes actually used.
type Plan = {
  readonly rowsOfMesh: Int32Array;
  readonly groupOfMesh: Int32Array;
  readonly meshOfGroup: Int32Array;
  readonly rowCount: number;
};

const planGroups = (geometry: Geometry): Plan => {
  const meshCount = geometryMeshCount(geometry);
  const rowsOfMesh = new Int32Array(meshCount);
  const instances = geometry.instances;
  let rowCount = 0;
  for (let i = 0; i < instances.count; i++) {
    const mesh = instances.meshIndex[i] ?? noMesh;
    if (mesh < 0 || mesh >= meshCount) continue;
    rowsOfMesh[mesh] = (rowsOfMesh[mesh] ?? 0) + 1;
    rowCount++;
  }
  const groupOfMesh = new Int32Array(meshCount).fill(-1);
  const used: number[] = [];
  for (let mesh = 0; mesh < meshCount; mesh++) {
    if ((rowsOfMesh[mesh] ?? 0) === 0) continue;
    groupOfMesh[mesh] = used.length;
    used.push(mesh);
  }
  return { rowsOfMesh, groupOfMesh, meshOfGroup: Int32Array.from(used), rowCount };
};

const checkColumns = (geometry: Geometry): Result<Geometry> => {
  const { count, meshIndex, transform, color, objectIndex } = geometry.instances;
  if (!Number.isInteger(count) || count < 0)
    return failure([diagnostic('bad-instance-count', `Instance count ${count} is not a whole number`, ['instances', 'count'])]);
  const widths: readonly (readonly [string, number, number])[] = [
    ['meshIndex', meshIndex.length, count],
    ['objectIndex', objectIndex.length, count],
    ['transform', transform.length, count * transformStride],
    ['color', color.length, count * colorStride],
  ];
  for (const [name, actual, expected] of widths)
    if (actual !== expected)
      return failure([diagnostic('bad-column-length', `Column ${name} holds ${actual} values, expected ${expected}`, ['instances', name])]);
  return success(geometry);
};

// Builds the table and the groups it binds to.
//
// `keys` is the object key of each object ordinal, so `geometry.instances.objectIndex` addresses
// it directly. An instance with no mesh, or with a mesh index outside the library, contributes no
// row and is reported as a warning rather than refused: a model whose objects have no geometry is
// still a model.
export const buildInstanceTable = (
  geometry: Geometry,
  keys: readonly ObjectKey[],
  options: InstanceTableOptions = defaultTableOptions,
): Result<InstanceTable> => {
  const checked = checkColumns(geometry);
  if (!checked.ok) return checked;
  const instances = geometry.instances;
  const plan = planGroups(geometry);
  const groupStart = new Int32Array(plan.meshOfGroup.length + 1);
  for (let g = 0; g < plan.meshOfGroup.length; g++)
    groupStart[g + 1] = (groupStart[g] ?? 0) + (plan.rowsOfMesh[plan.meshOfGroup[g] ?? 0] ?? 0);

  const rowCount = plan.rowCount;
  const groupOfRow = new Int32Array(rowCount);
  const objectOfRow = new Int32Array(rowCount);
  const instanceOfRow = new Int32Array(rowCount);
  const opacity = new Float32Array(rowCount);
  const visible = new Uint8Array(rowCount);
  const transforms = new Float32Array(rowCount * transformStride);
  const colors = new Float32Array(rowCount * colorStride);
  const nextOfGroup = Int32Array.from(groupStart.subarray(0, plan.meshOfGroup.length));

  let skipped = 0;
  let unknownObject = 0;
  for (let i = 0; i < instances.count; i++) {
    const mesh = instances.meshIndex[i] ?? noMesh;
    const group = mesh >= 0 && mesh < plan.groupOfMesh.length ? plan.groupOfMesh[mesh] ?? -1 : -1;
    if (group < 0) {
      skipped++;
      continue;
    }
    const row = nextOfGroup[group] ?? 0;
    nextOfGroup[group] = row + 1;
    groupOfRow[row] = group;
    instanceOfRow[row] = i;
    const object = instances.objectIndex[i] ?? -1;
    if (object < 0 || object >= keys.length) unknownObject++;
    objectOfRow[row] = object >= 0 && object < keys.length ? object : -1;
    transforms.set(
      instances.transform.subarray(i * transformStride, (i + 1) * transformStride),
      row * transformStride,
    );
    colors.set(instances.color.subarray(i * colorStride, (i + 1) * colorStride), row * colorStride);
    // A source that declares a hidden row keeps the opacity it had, and stores an alpha of zero,
    // which is the same composition every later visibility write maintains.
    const shown = isInstanceVisible(instances, i);
    opacity[row] = colors[row * colorStride + alphaChannel] ?? 1;
    visible[row] = shown ? 1 : 0;
    if (!shown) colors[row * colorStride + alphaChannel] = 0;
  }

  const objectStart = new Int32Array(keys.length + 1);
  for (let row = 0; row < rowCount; row++) {
    const object = objectOfRow[row] ?? -1;
    if (object >= 0) objectStart[object + 1] = (objectStart[object + 1] ?? 0) + 1;
  }
  for (let object = 0; object < keys.length; object++)
    objectStart[object + 1] = (objectStart[object + 1] ?? 0) + (objectStart[object] ?? 0);
  const objectRows = new Int32Array(rowCount);
  const nextOfObject = Int32Array.from(objectStart.subarray(0, keys.length));
  for (let row = 0; row < rowCount; row++) {
    const object = objectOfRow[row] ?? -1;
    if (object < 0) continue;
    const at = nextOfObject[object] ?? 0;
    nextOfObject[object] = at + 1;
    objectRows[at] = row;
  }

  const objectOfKey = new Map<ObjectKey, number>();
  const repeated: string[] = [];
  for (let object = 0; object < keys.length; object++) {
    const key = keys[object];
    if (key === undefined) continue;
    if (objectOfKey.has(key)) repeated.push(key);
    else objectOfKey.set(key, object);
  }

  const groups: InstancedGroup[] = [];
  for (let g = 0; g < plan.meshOfGroup.length; g++) {
    const source = geometryMeshAt(geometry, plan.meshOfGroup[g] ?? -1);
    if (source === undefined)
      return failure([diagnostic('missing-mesh', `Group ${g} names a mesh the library does not hold`, ['meshes', g])]);
    const start = groupStart[g] ?? 0;
    const end = groupStart[g + 1] ?? start;
    const group = new InstancedGroup(meshBuffers(source), options.material, end - start);
    group.append(
      transforms.subarray(start * transformStride, end * transformStride),
      colors.subarray(start * colorStride, end * colorStride),
    );
    groups.push(group);
  }

  const table: InstanceTable = {
    rowCount,
    groups,
    colors: groups.map((group) => group.colors),
    transforms: groups.map((group) => group.transforms),
    groupStart,
    groupOfRow,
    meshOfGroup: plan.meshOfGroup,
    objectOfRow,
    objectRows,
    objectStart,
    instanceOfRow,
    keys,
    objectOfKey,
    opacity,
    visible,
  };
  const notes = [
    ...(skipped > 0 ? [diagnostic('geometry-free-instances', `${skipped} instance records have no mesh and draw nothing`, ['instances'], 'info')] : []),
    ...(unknownObject > 0 ? [diagnostic('unknown-object-index', `${unknownObject} instance records name an object outside the key list`, ['instances', 'objectIndex'], 'warning')] : []),
    ...(repeated.length > 0 ? [diagnostic('repeated-object-key', `${repeated.length} object keys repeat; the first ordinal wins`, ['keys'], 'warning')] : []),
  ];
  return success(table, notes);
};
