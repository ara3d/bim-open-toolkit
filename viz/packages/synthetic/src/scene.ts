// Collects objects and the instance rows that draw them, keeping the two in step.
//
// Every generator that produces geometry has the same problem: an `ObjectRecord` and the
// `InstanceRecord` that draws it are written at the same moment and must agree on the row index,
// because `objectIndex` is what ties a picked instance back to an addressable object. Doing that by
// hand in ten generators is ten chances to get it wrong, so it is done once here.
//
// An object with no geometry is normal — a storey, a room, a network node are places rather than
// things to draw — and takes `noMesh`, which still produces an instance row so the two arrays stay
// the same length and in the same order as `model.objects`.

import {
  instanceRecords,
  noMesh,
  objectRef,
  triangleCount,
  type Appearance,
  type CoordinateContext,
  type Geometry,
  type InstanceRecord,
  type Matrix4,
  type ModelData,
  type ModelRef,
  type ObjectRecord,
} from '@bim-open-toolkit/model';
import { elementAt } from './arrays.js';
import type { MeshGroup, ShadedMesh } from './mesh-builder.js';

// One object to add to a scene: what it is, where it is and what draws it.
export type ObjectSpec = {
  readonly objectId: string;
  readonly name?: string | undefined;
  readonly category?: string | undefined;
  readonly parentId?: string | undefined;
  readonly transform: Matrix4;
  readonly appearance: Appearance;
  readonly meshIndex: number;
};

// A scene under construction: the objects added so far and their instance rows, always in step.
export type SceneBuilder = {
  readonly ref: ModelRef;
  readonly records: ObjectRecord[];
  readonly rows: InstanceRecord[];
};

// A finished scene: the objects, the geometry that draws them and the named mesh library.
export type Scene = {
  readonly model: ModelData;
  readonly geometry: Geometry;
  readonly meshGroups: readonly MeshGroup[];
};

// An empty scene for one model.
export const sceneBuilder = (ref: ModelRef): SceneBuilder => ({ ref, records: [], rows: [] });

// Adds one object and the instance row that places it. Returns the row index, which is both the
// object's index in `model.objects` and its instance row.
export function add(target: SceneBuilder, spec: ObjectSpec): number {
  const objectIndex = target.records.length;
  target.records.push({
    ref: objectRef(target.ref, spec.objectId),
    name: spec.name,
    category: spec.category,
    parentId: spec.parentId,
    transform: spec.transform,
    appearance: spec.appearance,
    representation: spec.meshIndex === noMesh ? undefined : spec.meshIndex,
  });
  target.rows.push({
    meshIndex: spec.meshIndex,
    transform: spec.transform,
    color: spec.appearance.color,
    opacity: spec.appearance.opacity,
    objectIndex,
  });
  return objectIndex;
}

// Freezes a scene: the model, its columnar instances and one named mesh group per mesh, whose
// `instanceCount` is what the scene actually placed.
export function scene(
  target: SceneBuilder,
  coordinates: CoordinateContext,
  meshes: readonly ShadedMesh[],
  meshNames: readonly string[],
): Scene {
  if (meshes.length !== meshNames.length) {
    throw new Error(`every mesh needs a name, got ${meshes.length} meshes and ${meshNames.length} names`);
  }
  const counts = meshes.map(() => 0);
  for (const row of target.rows) {
    if (row.meshIndex === noMesh) continue;
    counts[row.meshIndex] = elementAt(counts, row.meshIndex) + 1;
  }
  return {
    model: { ref: target.ref, coordinates, objects: target.records },
    geometry: { meshes, instances: instanceRecords(target.rows) },
    meshGroups: meshes.map((item, index) => ({
      name: elementAt(meshNames, index),
      mesh: item,
      instanceCount: elementAt(counts, index),
      triangleCount: triangleCount(item),
    })),
  };
}
