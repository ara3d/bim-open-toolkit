// The smallest thing that is a model: two objects, one triangle each, a metre apart.
//
// Deliberately hand-built rather than taken from `@bim-open-toolkit/synthetic`, so a failure here is
// a failure of this package and the tests need no generator.

import {
  defaultAppearance,
  instanceRecords,
  mesh,
  metresZUpLocal,
  objectKey,
  translation,
  type Appearance,
  type Geometry,
  type ModelData,
  type ModelRef,
  type ObjectKey,
} from '@bim-open-toolkit/model';
import type { LoadedModel } from '@bim-open-toolkit/formats';

// One triangle in the xy plane, a metre on a side.
const triangle = mesh(Float32Array.of(0, 0, 0, 1, 0, 0, 0, 1, 0), Uint32Array.of(0, 1, 2));

const red: Appearance = { color: [1, 0, 0], opacity: 1, visible: true };
const grey: Appearance = defaultAppearance;

// A model of two objects, each drawing the triangle once.
export const twoObjectModel = (id = 'fixture', revision = 'r1'): LoadedModel => {
  const ref: ModelRef = { id, revision };
  const data: ModelData = {
    ref,
    coordinates: metresZUpLocal,
    objects: [
      {
        ref: { modelId: id, revision, objectId: 'a' },
        name: 'First',
        category: 'Wall',
        transform: translation([0, 0, 0]),
        appearance: grey,
        representation: 0,
      },
      {
        ref: { modelId: id, revision, objectId: 'b' },
        name: 'Second',
        category: 'Door',
        transform: translation([2, 0, 0]),
        appearance: red,
        representation: 1,
      },
    ],
  };
  const geometry: Geometry = {
    meshes: [triangle],
    instances: instanceRecords([
      { meshIndex: 0, transform: translation([0, 0, 0]), color: grey.color, opacity: 1, objectIndex: 0 },
      { meshIndex: 0, transform: translation([2, 0, 0]), color: red.color, opacity: 1, objectIndex: 1 },
    ]),
  };
  return { format: 'bfast', data, geometry, coordinates: data.coordinates, sourceBytes: 0, diagnostics: [] };
};

// The object keys of the fixture, in the order the instance records address them.
export const fixtureKeys = (loaded: LoadedModel): readonly ObjectKey[] =>
  loaded.data.objects.map((record) => objectKey(record.ref));
