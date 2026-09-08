import { emptyBounds, expandBounds, identityMatrix, transformBounds, unionBounds, type Bounds, type Color, type Matrix4, type Vec3 } from './math.js';

// Mesh index of an instance that has no geometry.
export const noMesh = -1;

// Floats per instance transform: a column-major 4x4 matrix.
export const transformStride = 16;

// Floats per instance colour factor: linear RGB then opacity.
export const colorStride = 4;

// Floats per mesh in a mesh table's bounds column: minimum xyz then maximum xyz.
export const boundsStride = 6;

// Roughness of an instance whose records carry no roughness column: fully diffuse.
export const defaultRoughness = 1;

// Metallic factor of an instance whose records carry no metallic column: not metal.
export const defaultMetallic = 0;

// A triangle mesh as plain data. `positions` is xyz per vertex, `indices` is three per triangle.
export type Mesh = {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly normals?: Float32Array | undefined;
  readonly bounds: Bounds;
};

// Many meshes as buffers rather than records: one position buffer, one index buffer, and one row per
// mesh saying where its vertices and its indices start and how many it has. A mesh's indices count
// from its own first vertex, so a mesh reads back as views on the buffers with nothing copied.
// `bounds` is `boundsStride` floats per mesh; `normals` is present only when every mesh has them and
// is laid out like `positions`.
export type MeshTable = {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly normals?: Float32Array | undefined;
  readonly vertexStart: Int32Array;
  readonly vertexCount: Int32Array;
  readonly indexStart: Int32Array;
  readonly indexCount: Int32Array;
  readonly bounds: Float32Array;
};

// Instances as columns rather than objects: one row per drawn or geometry-free placement.
// `meshIndex` is `noMesh` when the row has no geometry; `objectIndex` is the row in `ModelData.objects`.
// `visible` holds 1 for a drawn row and 0 for a hidden one; absent means every row is visible, so
// hiding is a column write on a records value that keeps every row. `roughness` and `metallic` are
// the surface factors a source file carries per placement; absent reads as the defaults below.
export type InstanceRecords = {
  readonly count: number;
  readonly meshIndex: Int32Array;
  readonly transform: Float32Array;
  readonly color: Float32Array;
  readonly objectIndex: Int32Array;
  readonly visible?: Uint8Array | undefined;
  readonly roughness?: Float32Array | undefined;
  readonly metallic?: Float32Array | undefined;
};

// One instance read out of the columns, for building and for tests. Bulk code uses the columns.
// An optional field left out reads as its default, and only a row that gives one allocates a column.
export type InstanceRecord = {
  readonly meshIndex: number;
  readonly transform: Matrix4;
  readonly color: Color;
  readonly opacity: number;
  readonly objectIndex: number;
  readonly visible?: boolean | undefined;
  readonly roughness?: number | undefined;
  readonly metallic?: number | undefined;
};

// The meshes of a model together with the instances that place them. `meshTable` is those same
// meshes in the same order, so mesh index `i` is both `meshes[i]` and `meshAt(meshTable, i)`; a
// producer that carries the geometry only as buffers leaves `meshes` empty, and whatever `meshes`
// holds never disagrees with the table.
export type Geometry = {
  readonly meshes: readonly Mesh[];
  readonly instances: InstanceRecords;
  readonly meshTable?: MeshTable | undefined;
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

// The number of meshes the table holds.
export const meshCount = (source: MeshTable): number => source.vertexStart.length;

// The box of one mesh of the table. An index outside the table reads as empty bounds.
export const meshBoundsAt = (source: MeshTable, index: number): Bounds => {
  if (index < 0 || index >= meshCount(source)) return emptyBounds;
  const at = (offset: number): number => source.bounds[index * boundsStride + offset] ?? 0;
  return { min: [at(0), at(1), at(2)], max: [at(3), at(4), at(5)] };
};

// One mesh of the table as views on its buffers: no vertex, index or normal is copied. An index
// outside the table reads as an empty mesh.
export const meshAt = (source: MeshTable, index: number): Mesh => {
  const start = source.vertexStart[index] ?? 0;
  const vertices = source.vertexCount[index] ?? 0;
  const first = source.indexStart[index] ?? 0;
  const indices = source.indexCount[index] ?? 0;
  return {
    positions: source.positions.subarray(start * 3, (start + vertices) * 3),
    indices: source.indices.subarray(first, first + indices),
    normals: source.normals?.subarray(start * 3, (start + vertices) * 3),
    bounds: meshBoundsAt(source, index),
  };
};

// Meshes gathered into one position buffer, one index buffer and one row each, keeping their order
// and their bounds. Normals survive only when every mesh has them, since one buffer cannot hold a
// gap. The buffers are copies, so the meshes may be released afterwards.
export const meshTableFrom = (meshes: readonly Mesh[]): MeshTable => {
  const count = meshes.length;
  const vertexStart = new Int32Array(count);
  const vertexCounts = new Int32Array(count);
  const indexStart = new Int32Array(count);
  const indexCounts = new Int32Array(count);
  const bounds = new Float32Array(count * boundsStride);
  let vertices = 0;
  let indices = 0;
  meshes.forEach((source, index) => {
    const own = vertexCount(source);
    vertexStart[index] = vertices;
    vertexCounts[index] = own;
    indexStart[index] = indices;
    indexCounts[index] = source.indices.length;
    bounds.set([...source.bounds.min, ...source.bounds.max], index * boundsStride);
    vertices += own;
    indices += source.indices.length;
  });
  const positions = new Float32Array(vertices * 3);
  const gathered = new Uint32Array(indices);
  const shaded = count > 0 && meshes.every((source) => source.normals !== undefined);
  const normals = shaded ? new Float32Array(vertices * 3) : undefined;
  meshes.forEach((source, index) => {
    const at = (vertexStart[index] ?? 0) * 3;
    const floats = (vertexCounts[index] ?? 0) * 3;
    positions.set(source.positions.subarray(0, floats), at);
    if (normals !== undefined) normals.set(source.normals?.subarray(0, floats) ?? [], at);
    gathered.set(source.indices, indexStart[index] ?? 0);
  });
  return { positions, indices: gathered, normals, vertexStart, vertexCount: vertexCounts, indexStart, indexCount: indexCounts, bounds };
};

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

// One optional float column, allocated only when some row gives a value. A row that gives none holds
// the default, which is what the accessor reads when the column is absent altogether.
const optionalFloats = (
  rows: readonly InstanceRecord[],
  read: (row: InstanceRecord) => number | undefined,
  fallback: number,
): Float32Array | undefined => {
  if (!rows.some((row) => read(row) !== undefined)) return undefined;
  const values = new Float32Array(rows.length);
  rows.forEach((row, index) => {
    values[index] = read(row) ?? fallback;
  });
  return values;
};

// Instance columns built from rows. Use it in generators and tests, not in bulk update paths.
// An optional column is allocated only when some row gives it a value, since absent reads as the
// default: every row visible, `defaultRoughness`, `defaultMetallic`.
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
  const roughness = optionalFloats(rows, (row) => row.roughness, defaultRoughness);
  const metallic = optionalFloats(rows, (row) => row.metallic, defaultMetallic);
  return {
    ...records,
    ...(visible === undefined ? {} : { visible }),
    ...(roughness === undefined ? {} : { roughness }),
    ...(metallic === undefined ? {} : { metallic }),
  };
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

// Surface roughness of one instance, 0 mirror to 1 diffuse. No column reads as `defaultRoughness`.
export const instanceRoughness = (records: InstanceRecords, row: number): number =>
  records.roughness?.[row] ?? defaultRoughness;

// Metallic factor of one instance, 0 dielectric to 1 metal. No column reads as `defaultMetallic`.
export const instanceMetallic = (records: InstanceRecords, row: number): number =>
  records.metallic?.[row] ?? defaultMetallic;

// True when the instance row is drawn. Records with no `visible` column have every row visible.
export const isInstanceVisible = (records: InstanceRecords, row: number): boolean =>
  records.visible === undefined || (records.visible[row] ?? 1) !== 0;

// True when the instance row draws no geometry.
export const isGeometryFree = (records: InstanceRecords, row: number): boolean =>
  (records.meshIndex[row] ?? noMesh) === noMesh;

// The box of the mesh an instance names, read from `meshes` or, when the geometry carries only the
// table, from the table. A row with no mesh, or a mesh index neither holds, has no box.
const meshBoundsOf = (geometry: Geometry, index: number): Bounds | undefined => {
  if (index === noMesh) return undefined;
  const source = geometry.meshes[index];
  if (source !== undefined) return source.bounds;
  const meshes = geometry.meshTable;
  return meshes !== undefined && index >= 0 && index < meshCount(meshes)
    ? meshBoundsAt(meshes, index)
    : undefined;
};

// The box containing every instance of the geometry in model space, hidden rows included.
export const geometryBounds = (geometry: Geometry): Bounds => {
  let bounds = emptyBounds;
  for (let row = 0; row < geometry.instances.count; row += 1) {
    const source = meshBoundsOf(geometry, geometry.instances.meshIndex[row] ?? noMesh);
    if (source !== undefined) {
      bounds = unionBounds(bounds, transformBounds(instanceTransform(geometry.instances, row), source));
    }
  }
  return bounds;
};
