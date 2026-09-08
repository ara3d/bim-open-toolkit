import { emptyBounds, expandBounds, identityMatrix, transformBounds, unionBounds, type Bounds, type Color, type Matrix4, type Vec3 } from './math.js';

// Mesh index of an instance that has no geometry.
export const noMesh = -1;

// Floats per instance transform: a column-major 4x4 matrix.
export const transformStride = 16;

// Floats per instance colour factor: linear RGB then opacity.
export const colorStride = 4;

// A triangle mesh as plain data. `positions` is xyz per vertex, `indices` is three per triangle.
export type Mesh = {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly normals?: Float32Array | undefined;
  readonly bounds: Bounds;
};

// Instances as columns rather than objects: one row per drawn or geometry-free placement.
// `meshIndex` is `noMesh` when the row has no geometry; `objectIndex` is the row in `ModelData.objects`.
// `visible` holds 1 for a drawn row and 0 for a hidden one; absent means every row is visible, so
// hiding is a column write on a records value that keeps every row.
export type InstanceRecords = {
  readonly count: number;
  readonly meshIndex: Int32Array;
  readonly transform: Float32Array;
  readonly color: Float32Array;
  readonly objectIndex: Int32Array;
  readonly visible?: Uint8Array | undefined;
};

// One instance read out of the columns, for building and for tests. Bulk code uses the columns.
// `visible` defaults to true; a row that sets it false is what gives the built records a column.
export type InstanceRecord = {
  readonly meshIndex: number;
  readonly transform: Matrix4;
  readonly color: Color;
  readonly opacity: number;
  readonly objectIndex: number;
  readonly visible?: boolean | undefined;
};

// The meshes of a model together with the instances that place them.
export type Geometry = {
  readonly meshes: readonly Mesh[];
  readonly instances: InstanceRecords;
};

// The box containing every vertex of an xyz position buffer.
export const boundsOfPositions = (positions: Float32Array): Bounds => {
  let bounds = emptyBounds;
  for (let index = 0; index + 2 < positions.length; index += 3) {
    const point: Vec3 = [positions[index] ?? 0, positions[index + 1] ?? 0, positions[index + 2] ?? 0];
    bounds = expandBounds(bounds, point);
  }
  return bounds;
};

// A mesh with its bounds computed from its positions.
export const mesh = (positions: Float32Array, indices: Uint32Array, normals?: Float32Array): Mesh => ({
  positions,
  indices,
  normals,
  bounds: boundsOfPositions(positions),
});

// Number of vertices in the mesh.
export const vertexCount = (source: Mesh): number => Math.floor(source.positions.length / 3);

// Number of triangles in the mesh.
export const triangleCount = (source: Mesh): number => Math.floor(source.indices.length / 3);

// Instance columns sized for a row count, every row geometry-free, at the origin, opaque white.
export const emptyInstances = (count: number): InstanceRecords => {
  const transform = new Float32Array(count * transformStride);
  const color = new Float32Array(count * colorStride);
  for (let row = 0; row < count; row += 1) {
    transform.set(identityMatrix, row * transformStride);
    color.set([1, 1, 1, 1], row * colorStride);
  }
  return {
    count,
    meshIndex: new Int32Array(count).fill(noMesh),
    transform,
    color,
    objectIndex: new Int32Array(count).fill(-1),
  };
};

// Instance columns built from rows. Use it in generators and tests, not in bulk update paths.
// The `visible` column is allocated only when some row is hidden, since absent reads as all visible.
export const instanceRecords = (rows: readonly InstanceRecord[]): InstanceRecords => {
  const records = emptyInstances(rows.length);
  const visible = rows.some((row) => row.visible === false)
    ? new Uint8Array(rows.length).fill(1)
    : undefined;
  rows.forEach((row, index) => {
    records.meshIndex[index] = row.meshIndex;
    records.objectIndex[index] = row.objectIndex;
    records.transform.set(row.transform, index * transformStride);
    records.color.set([row.color[0], row.color[1], row.color[2], row.opacity], index * colorStride);
    if (visible !== undefined && row.visible === false) visible[index] = 0;
  });
  return visible === undefined ? records : { ...records, visible };
};

// The transform of one instance, copied out of the column.
export const instanceTransform = (records: InstanceRecords, row: number): Matrix4 => {
  const at = (offset: number): number => records.transform[row * transformStride + offset] ?? 0;
  return [
    at(0), at(1), at(2), at(3),
    at(4), at(5), at(6), at(7),
    at(8), at(9), at(10), at(11),
    at(12), at(13), at(14), at(15),
  ];
};

// The colour factor of one instance, copied out of the column.
export const instanceColor = (records: InstanceRecords, row: number): Color => [
  records.color[row * colorStride] ?? 1,
  records.color[row * colorStride + 1] ?? 1,
  records.color[row * colorStride + 2] ?? 1,
];

// The opacity factor of one instance.
export const instanceOpacity = (records: InstanceRecords, row: number): number =>
  records.color[row * colorStride + 3] ?? 1;

// True when the instance row is drawn. Records with no `visible` column have every row visible.
export const isInstanceVisible = (records: InstanceRecords, row: number): boolean =>
  records.visible === undefined || (records.visible[row] ?? 1) !== 0;

// True when the instance row draws no geometry.
export const isGeometryFree = (records: InstanceRecords, row: number): boolean =>
  (records.meshIndex[row] ?? noMesh) === noMesh;

// The box containing every instance of the geometry in model space.
export const geometryBounds = (geometry: Geometry): Bounds => {
  let bounds = emptyBounds;
  for (let row = 0; row < geometry.instances.count; row += 1) {
    const index = geometry.instances.meshIndex[row] ?? noMesh;
    const source = index === noMesh ? undefined : geometry.meshes[index];
    if (source !== undefined) {
      bounds = unionBounds(bounds, transformBounds(instanceTransform(geometry.instances, row), source.bounds));
    }
  }
  return bounds;
};
