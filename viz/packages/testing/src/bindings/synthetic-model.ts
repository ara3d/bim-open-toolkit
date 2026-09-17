/**
 * A prepared model built in memory, with no file and no private data.
 *
 * `RenderModel` is the loaders' view of a BFAST file: typed arrays of mesh
 * slices and 64-byte instance records. Nothing about it requires a file, so the
 * regression tests and the scale benchmark build one directly and hand it to
 * the same `bfastToGroups` the real loader uses. The generated model carries
 * the cases that make binding interesting: hidden instances, instances with no
 * mesh, an empty mesh, several instances per object, and entity rows no
 * instance refers to.
 */
import type { RenderModel } from '@ara3d/viewer-loaders';
import { createRandom } from '../perf/prng.js';

/** Ints per mesh slice: base vertex, vertex count, first index, index count. */
const meshSliceInts = 4;

/** Words per instance record. */
const instanceWords = 16;

export type SyntheticModelShape = {
  /** Instance records, including the hidden ones and the ones with no mesh. */
  readonly instances: number;
  /** Distinct meshes. One of them is empty, so instances that use it produce no group. */
  readonly meshes: number;
  /** Distinct material parameter sets. Groups are roughly `meshes * materials`. */
  readonly materials: number;
  /** Rows of the entity table. Rows beyond those the instances name have no geometry. */
  readonly entities: number;
  readonly hiddenFraction: number;
  readonly noMeshFraction: number;
  readonly seed: number;
};

/** A model shaped like the reference building: many groups, few instances in each. */
export const buildingShape = (instances: number, seed = 1): SyntheticModelShape => ({
  instances,
  meshes: Math.max(2, Math.round(instances / 8)),
  materials: 6,
  entities: Math.max(1, Math.round(instances / 9)),
  hiddenFraction: 0.02,
  noMeshFraction: 0.03,
  seed,
});

const packInstanceWord = (metallic: number, roughness: number, flags: number): number =>
  ((metallic & 255) << 24) | ((roughness & 255) << 16) | ((flags & 255) << 8);

const packColor = (r: number, g: number, b: number, a: number): number =>
  (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) | 0;

/** The generated model together with the entity table a loader would have decoded. */
export type SyntheticModel = {
  readonly model: RenderModel;
  readonly entityLocalIds: Int32Array;
};

/** Builds the model. The same shape and seed always produce the same bytes. */
export function syntheticRenderModel(shape: SyntheticModelShape): SyntheticModel {
  const random = createRandom(shape.seed);
  const meshCount = Math.max(2, shape.meshes);
  const verticesPerMesh = new Int32Array(meshCount);
  for (let mesh = 0; mesh < meshCount; mesh += 1) verticesPerMesh[mesh] = mesh === 0 ? 0 : 3 * (1 + (mesh % 4));

  let totalVertices = 0;
  let totalIndices = 0;
  const meshSlices = new Int32Array(meshCount * meshSliceInts);
  for (let mesh = 0; mesh < meshCount; mesh += 1) {
    const vertices = verticesPerMesh[mesh] ?? 0;
    meshSlices[mesh * meshSliceInts] = totalVertices;
    meshSlices[mesh * meshSliceInts + 1] = vertices;
    meshSlices[mesh * meshSliceInts + 2] = totalIndices;
    meshSlices[mesh * meshSliceInts + 3] = vertices;
    totalVertices += vertices;
    totalIndices += vertices;
  }
  const vertices = new Float32Array(totalVertices * 3);
  for (let i = 0; i < vertices.length; i += 1) vertices[i] = random() * 2 - 1;
  const indices = new Uint32Array(totalIndices);
  for (let mesh = 0; mesh < meshCount; mesh += 1) {
    const first = meshSlices[mesh * meshSliceInts + 2] ?? 0;
    const count = meshSlices[mesh * meshSliceInts + 3] ?? 0;
    for (let i = 0; i < count; i += 1) indices[first + i] = i;
  }

  const buffer = new ArrayBuffer(shape.instances * instanceWords * 4);
  const instanceFloats = new Float32Array(buffer);
  const instanceInts = new Int32Array(buffer);
  const entities = Math.max(1, shape.entities);
  for (let i = 0; i < shape.instances; i += 1) {
    const at = i * instanceWords;
    const scale = 1 + (i % 5) * 0.25;
    instanceFloats.set([scale, 0, 0, i * 0.5, 0, scale, 0, i * 0.25, 0, 0, scale, i * 0.125], at);
    const roll = random();
    const noMesh = roll < shape.noMeshFraction;
    const hidden = !noMesh && roll < shape.noMeshFraction + shape.hiddenFraction;
    const mesh = noMesh ? -1 : 1 + (i % (meshCount - 1));
    const material = i % Math.max(1, shape.materials);
    instanceInts[at + 12] = mesh;
    instanceInts[at + 13] = i % entities;
    instanceInts[at + 14] = packColor(20 + material * 30, 40 + material * 20, 60 + material * 10, material % 3 === 0 ? 128 : 255);
    instanceInts[at + 15] = packInstanceWord(material * 20, 40 + material * 10, hidden ? 1 : 0);
  }

  const entityLocalIds = new Int32Array(entities);
  for (let entity = 0; entity < entities; entity += 1) entityLocalIds[entity] = entity % 4 === 0 ? 0 : entity * 7 + 1;

  return {
    model: {
      floatsPerVertex: 3,
      meshSlices,
      instanceFloats,
      instanceInts,
      meshBounds: new Float32Array(meshCount * 6),
      instanceBounds: new Float32Array(shape.instances * 6),
      meta: {
        boundsMin: [0, 0, 0],
        boundsMax: [1, 1, 1],
        totalVertexCount: totalVertices,
        totalFaceCount: Math.floor(totalIndices / 3),
        primitiveSize: 3,
        flags: 0,
      },
      vertices,
      indices,
    },
    entityLocalIds,
  };
}
