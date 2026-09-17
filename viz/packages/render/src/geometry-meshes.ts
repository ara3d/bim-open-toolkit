// The one place this package reads a `Geometry`'s meshes.
//
// M1.2 gave `Geometry` two forms for the same meshes: the `meshes` records and the columnar
// `meshTable`. A producer may carry either, and BFAST - the default format - carries only the
// table, leaving `meshes` empty. Reading `meshes` directly therefore binds nothing for a BFAST
// model. Everything here prefers the table when both are present, because the contract says the two
// describe the same meshes in the same order and the table is the form that costs nothing to hold.
//
// `meshAt` builds a `Mesh` of views: one object and up to three `subarray` calls per call, no vertex
// copied. That is cheap but not free, so a binding resolves a mesh once per group and never once per
// instance; `geometryMeshTriangles` exists so counting triangles needs no `Mesh` at all.

import { meshAt, meshCount, type Geometry, type Mesh } from '@bim-open-toolkit/model';

// Meshes the geometry holds, in either form. Zero when it holds neither.
export const geometryMeshCount = (geometry: Geometry): number =>
  geometry.meshTable === undefined ? geometry.meshes.length : meshCount(geometry.meshTable);

// The mesh at an index, or undefined when the geometry does not hold one there. From the table when
// there is one, in which case the result is views on the table's buffers and allocates one object.
export const geometryMeshAt = (geometry: Geometry, index: number): Mesh | undefined => {
  const table = geometry.meshTable;
  if (table === undefined) return geometry.meshes[index];
  if (index < 0 || index >= meshCount(table)) return undefined;
  return meshAt(table, index);
};

// Triangles in the mesh at an index, 0 when there is no mesh there. Allocation-free on a table, so a
// per-frame statistic over every group does not build a `Mesh` per group.
export const geometryMeshTriangles = (geometry: Geometry, index: number): number => {
  const table = geometry.meshTable;
  if (table === undefined) return Math.floor((geometry.meshes[index]?.indices.length ?? 0) / 3);
  if (index < 0 || index >= meshCount(table)) return 0;
  return Math.floor((table.indexCount[index] ?? 0) / 3);
};
