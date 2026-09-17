// The box each object occupies, so a demo can fly to one of them.
//
// The gallery viewer frames a box; it does not know which box belongs to which object, and neither
// does the render package. So the demos work it out once from the geometry they opened: every
// instance is added to the box of the object it draws. An object with no instance gets no box, and
// a demo that cannot fly to it says so instead of flying somewhere arbitrary.

import {
  emptyBounds,
  instanceTransform,
  isEmptyBounds,
  meshBoundsAt,
  meshCount,
  noMesh,
  objectKey,
  transformBounds,
  unionBounds,
  type Bounds,
  type Geometry,
  type ModelData,
  type ObjectKey,
} from '@bim-open-toolkit/model';

// The box of the mesh an instance names, from the mesh list or, when the geometry carries only the
// table, from the table. Model keeps this private; asking for it to be exported is a request to M.
const meshBounds = (geometry: Geometry, index: number): Bounds | undefined => {
  if (index === noMesh) return undefined;
  const mesh = geometry.meshes[index];
  if (mesh !== undefined) return mesh.bounds;
  const meshes = geometry.meshTable;
  return meshes !== undefined && index >= 0 && index < meshCount(meshes) ? meshBoundsAt(meshes, index) : undefined;
};

// The box of every object the geometry draws, by object key. Objects with no instances are absent.
export const objectBounds = (model: ModelData, geometry: Geometry): ReadonlyMap<ObjectKey, Bounds> => {
  const keys = model.objects.map((record) => objectKey(record.ref));
  const boxes = new Map<ObjectKey, Bounds>();
  const meshBoxes = new Map<number, Bounds>();
  for (let row = 0; row < geometry.instances.count; row += 1) {
    const objectIndex = geometry.instances.objectIndex[row] ?? -1;
    const key = keys[objectIndex];
    if (key === undefined) continue;
    const meshIndex = geometry.instances.meshIndex[row] ?? -1;
    const cached = meshBoxes.get(meshIndex) ?? meshBounds(geometry, meshIndex);
    if (cached === undefined) continue;
    meshBoxes.set(meshIndex, cached);
    const placed = transformBounds(instanceTransform(geometry.instances, row), cached);
    boxes.set(key, unionBounds(boxes.get(key) ?? emptyBounds, placed));
  }
  return boxes;
};

// The box holding every one of the given objects, or nothing when none of them is drawn.
export const boundsOfKeys = (
  boxes: ReadonlyMap<ObjectKey, Bounds>,
  keys: Iterable<ObjectKey>,
): Bounds | undefined => {
  let held = emptyBounds;
  for (const key of keys) {
    const box = boxes.get(key);
    if (box !== undefined) held = unionBounds(held, box);
  }
  return isEmptyBounds(held) ? undefined : held;
};
