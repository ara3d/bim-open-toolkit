// A viewer-core scene built from model geometry, without a browser or a GPU.
//
// `InstancedGroup` and `ViewerScene` are plain bookkeeping: buffers, counts and version numbers.
// Nothing in them needs a WebGL context, so a render or feature test can assert on counts, bounds
// and buffer contents in Node, which is what the PERF and BIND studies in this package already did
// by hand. This builds the same thing from a `Geometry`, keeping the mapping back to instance rows
// and objects so an assertion can say which object it is talking about.
//
// One group per mesh: instances of the same mesh are drawn together, which is the arrangement the
// instance table binds to. Rows with no geometry keep their place in the row mapping and are drawn
// by nothing. The meshes are read from `Geometry.meshTable` when there is one and from `meshes`
// otherwise, so a model whose loader carries only the columns - BFAST, the default format - builds
// the same scene as one carrying records.

import { InstancedGroup, ViewerScene, defaultMaterial, sceneBounds, type Bounds3, type MaterialConfig, type MeshBuffers } from '@ara3d/viewer-core';
import { colorStride, meshAt, meshCount, noMesh, transformStride, type Geometry, type Mesh } from '@bim-open-toolkit/model';

// A built scene, and every mapping needed to talk about it in terms of instance rows and objects.
export type HeadlessScene = {
  readonly scene: ViewerScene;
  readonly groups: readonly InstancedGroup[];
  // Mesh each group draws, by group ordinal.
  readonly meshIndexOfGroup: Int32Array;
  // Group ordinal of each instance row, or -1 for a row that draws nothing.
  readonly groupOfRow: Int32Array;
  // Position of each instance row inside its group, or -1 for a row that draws nothing.
  readonly indexInGroup: Int32Array;
  // Instance rows that are drawn, in group order then instance order.
  readonly rowOfEntry: Int32Array;
  // Where each group's entries start in `rowOfEntry`; the last element is the total.
  readonly entryStartOfGroup: Int32Array;
  // Instance rows that are drawn. Rows without geometry are not counted.
  readonly drawnCount: number;
  readonly triangleCount: number;
};

// How to build the scene. The default material is viewer-core's own.
export type HeadlessSceneOptions = {
  // The material a group gets, by the mesh it draws. One material for everything by default.
  readonly materialOfMesh: (meshIndex: number) => MaterialConfig;
};

// The buffers viewer-core needs, from the model's mesh plain data. Normals are only set when the
// mesh has them, so the renderer computes flat ones rather than being handed an empty buffer.
export const meshBuffersOf = (source: Mesh): MeshBuffers => ({
  positions: source.positions,
  indices: source.indices,
  ...(source.normals === undefined ? {} : { normals: source.normals }),
});

// Meshes the geometry holds, in whichever form it carries them. M1.2 lets a producer keep them as
// the columnar `meshTable` and leave `meshes` empty, which is what the BFAST loader does; when both
// are present they describe the same meshes and the table is the form read.
const meshesInGeometry = (geometry: Geometry): number =>
  geometry.meshTable === undefined ? geometry.meshes.length : meshCount(geometry.meshTable);

// The mesh at an index, or undefined when the geometry holds none there. Reading the table builds a
// `Mesh` of views per call, so this is called once per drawn mesh and never once per row.
const meshInGeometry = (geometry: Geometry, index: number): Mesh | undefined => {
  const table = geometry.meshTable;
  if (table === undefined) return geometry.meshes[index];
  if (index < 0 || index >= meshCount(table)) return undefined;
  return meshAt(table, index);
};

// The mesh a row draws, or `noMesh` when the row draws nothing or names a mesh that is not there.
// `meshes` is the count resolved once, so a per-row loop does not ask the geometry its form again.
const meshOfRow = (geometry: Geometry, row: number, meshes: number): number => {
  const index = geometry.instances.meshIndex[row] ?? noMesh;
  return index >= 0 && index < meshes ? index : noMesh;
};

// Builds the groups and the scene. One pass counts the instances of each mesh, a second fills the
// buffers, so nothing is grown or copied twice.
export function headlessScene(geometry: Geometry, options: Partial<HeadlessSceneOptions> = {}): HeadlessScene {
  const materialOfMesh = options.materialOfMesh ?? ((): MaterialConfig => defaultMaterial);
  const rows = geometry.instances.count;
  const meshes = meshesInGeometry(geometry);
  const perMesh = new Int32Array(meshes);
  for (let row = 0; row < rows; row += 1) {
    const index = meshOfRow(geometry, row, meshes);
    if (index !== noMesh) perMesh[index] = (perMesh[index] ?? 0) + 1;
  }

  const drawnMeshes: number[] = [];
  for (let index = 0; index < perMesh.length; index += 1) if ((perMesh[index] ?? 0) > 0) drawnMeshes.push(index);
  const groupOfMesh = new Int32Array(meshes).fill(-1);
  drawnMeshes.forEach((meshIndex, ordinal) => { groupOfMesh[meshIndex] = ordinal; });

  const entryStartOfGroup = new Int32Array(drawnMeshes.length + 1);
  drawnMeshes.forEach((meshIndex, ordinal) => {
    entryStartOfGroup[ordinal + 1] = (entryStartOfGroup[ordinal] ?? 0) + (perMesh[meshIndex] ?? 0);
  });
  const drawnCount = entryStartOfGroup[drawnMeshes.length] ?? 0;

  const transforms = drawnMeshes.map((meshIndex) => new Float32Array((perMesh[meshIndex] ?? 0) * transformStride));
  const colors = drawnMeshes.map((meshIndex) => new Float32Array((perMesh[meshIndex] ?? 0) * colorStride));
  const filled = new Int32Array(drawnMeshes.length);
  const groupOfRow = new Int32Array(rows).fill(-1);
  const indexInGroup = new Int32Array(rows).fill(-1);
  const rowOfEntry = new Int32Array(drawnCount);

  for (let row = 0; row < rows; row += 1) {
    const meshIndex = meshOfRow(geometry, row, meshes);
    if (meshIndex === noMesh) continue;
    const ordinal = groupOfMesh[meshIndex] ?? -1;
    const target = transforms[ordinal];
    const tint = colors[ordinal];
    if (target === undefined || tint === undefined) throw new Error('instance counting disagreed with the mesh list');
    const slot = filled[ordinal] ?? 0;
    target.set(geometry.instances.transform.subarray(row * transformStride, (row + 1) * transformStride), slot * transformStride);
    tint.set(geometry.instances.color.subarray(row * colorStride, (row + 1) * colorStride), slot * colorStride);
    groupOfRow[row] = ordinal;
    indexInGroup[row] = slot;
    rowOfEntry[(entryStartOfGroup[ordinal] ?? 0) + slot] = row;
    filled[ordinal] = slot + 1;
  }

  const scene = new ViewerScene();
  let triangles = 0;
  const groups = drawnMeshes.map((meshIndex, ordinal) => {
    const source = meshInGeometry(geometry, meshIndex);
    const transform = transforms[ordinal];
    const color = colors[ordinal];
    if (source === undefined || transform === undefined || color === undefined) throw new Error('mesh list changed while building the scene');
    const group = new InstancedGroup(meshBuffersOf(source), materialOfMesh(meshIndex), Math.max(1, perMesh[meshIndex] ?? 1));
    group.append(transform, color);
    scene.addGroup(group);
    triangles += Math.floor(source.indices.length / 3) * (perMesh[meshIndex] ?? 0);
    return group;
  });

  return {
    scene,
    groups,
    meshIndexOfGroup: Int32Array.from(drawnMeshes),
    groupOfRow,
    indexInGroup,
    rowOfEntry,
    entryStartOfGroup,
    drawnCount,
    triangleCount: triangles,
  };
}

// The instance row an entry of a group stands for, or -1 when there is no such entry.
export const rowOfInstance = (built: HeadlessScene, group: number, instanceIndex: number): number => {
  const start = built.entryStartOfGroup[group];
  const end = built.entryStartOfGroup[group + 1];
  if (start === undefined || end === undefined || instanceIndex < 0 || start + instanceIndex >= end) return -1;
  return built.rowOfEntry[start + instanceIndex] ?? -1;
};

// The object an instance row belongs to, or -1 when the row is not one of the geometry's.
export const objectOfRow = (geometry: Geometry, row: number): number =>
  row >= 0 && row < geometry.instances.count ? geometry.instances.objectIndex[row] ?? -1 : -1;

// The transform of an instance row as it sits in the group buffer, copied.
export const transformInScene = (built: HeadlessScene, row: number): Float32Array => {
  const group = built.groups[built.groupOfRow[row] ?? -1];
  const slot = built.indexInGroup[row] ?? -1;
  if (group === undefined || slot < 0) throw new Error(`instance row ${row} draws nothing`);
  return group.transforms.slice(slot * transformStride, (slot + 1) * transformStride);
};

// The colour and opacity factor of an instance row as they sit in the group buffer, copied.
export const colorInScene = (built: HeadlessScene, row: number): Float32Array => {
  const group = built.groups[built.groupOfRow[row] ?? -1];
  const slot = built.indexInGroup[row] ?? -1;
  if (group === undefined || slot < 0) throw new Error(`instance row ${row} draws nothing`);
  return group.colors.slice(slot * colorStride, (slot + 1) * colorStride);
};

// The box containing every instance of the scene, or null when nothing is drawn.
export const boundsOfScene = (built: HeadlessScene): Bounds3 | null => sceneBounds(built.scene);
