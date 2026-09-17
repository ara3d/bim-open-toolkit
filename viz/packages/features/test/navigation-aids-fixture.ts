// A two-storey building small enough to reason about by hand, shared by the FB feature tests.
//
// Two storey objects at 0 and 3 metres, and four placed objects: a wall and a door on each storey.
// Storeys draw nothing, which is what a real model does, so the instance table has four rows and
// six objects. Every position is a whole number so an expected offset is written down, not computed.

import {
  identityMatrix,
  instanceRecords,
  mesh,
  metresZUpLocal,
  modelIdentity,
  objectKey,
  objectRef,
  translation,
  type Geometry,
  type InstanceRecord,
  type Mesh,
  type ModelData,
  type ModelRef,
  type ObjectKey,
  type ObjectRecord,
} from '@bim-open-toolkit/model';
import { buildInstanceTable, type InstanceTable } from '@bim-open-toolkit/render';

// The model every fixture object belongs to.
export const fixtureModel: ModelRef = modelIdentity({ id: 'features-fb', revision: '1' });

// The key of one fixture object.
export const keyOf = (objectId: string): ObjectKey => objectKey(objectRef(fixtureModel, objectId));

const record = (objectId: string, category: string, name: string, at: readonly [number, number, number]): ObjectRecord => ({
  ref: objectRef(fixtureModel, objectId),
  name,
  category,
  transform: translation([at[0], at[1], at[2]]),
});

// The objects that draw something, in the order their instance rows are built.
export const drawnObjectIds: readonly string[] = ['wall-0', 'door-0', 'wall-1', 'door-1'];

// A two-storey building: storeys at 0 and 3, a wall and a door on each.
export const building = (): ModelData => ({
  ref: fixtureModel,
  coordinates: metresZUpLocal,
  objects: [
    record('storey-0', 'Storey', 'Level 1', [0, 0, 0]),
    record('storey-1', 'Storey', 'Level 2', [0, 0, 3]),
    record('wall-0', 'Wall', 'Wall 1', [2, 0, 1]),
    record('door-0', 'Door', 'Door 1', [4, 0, 1]),
    record('wall-1', 'Wall', 'Wall 2', [2, 0, 4]),
    record('door-1', 'Door', 'Door 2', [4, 0, 4]),
  ],
});

// The same building as a format that places its instances and leaves every object record at the
// identity, which is what BFAST does and why a layout cannot read placements off the records alone.
// The objects, their order and their categories are unchanged, so `buildingGeometry(building())`
// places the same rows in the same places for this model as it does for the one above.
export const rowPlacedBuilding = (): ModelData => {
  const placed = building();
  return { ...placed, objects: placed.objects.map((item) => ({ ...item, transform: identityMatrix })) };
};

// A unit cube, two triangles per face.
const cube = (): Mesh => {
  const corners: readonly (readonly [number, number, number])[] = [
    [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
  ];
  const faces = [
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0,
  ];
  return mesh(new Float32Array(corners.flatMap((corner) => [...corner])), Uint32Array.from(faces));
};

// One instance per drawn object, placed where the model's own record places it.
export const buildingGeometry = (model: ModelData): Geometry => {
  const rows: readonly InstanceRecord[] = model.objects.flatMap((item, index) =>
    drawnObjectIds.includes(item.ref.objectId)
      ? [{ meshIndex: 0, transform: item.transform, color: [1, 1, 1] as const, opacity: 1, objectIndex: index }]
      : [],
  );
  return { meshes: [cube()], instances: instanceRecords(rows) };
};

// The object key of each object ordinal, which is what an instance table addresses.
export const buildingKeys = (model: ModelData): readonly ObjectKey[] =>
  model.objects.map((item) => objectKey(item.ref));

// The instance table of the fixture building, or a thrown error when it could not be built.
export const buildingTable = (model: ModelData, geometry: Geometry): InstanceTable => {
  const built = buildInstanceTable(geometry, buildingKeys(model));
  if (!built.ok) throw new Error(built.diagnostics.map((item) => item.message).join('; '));
  return built.value;
};
