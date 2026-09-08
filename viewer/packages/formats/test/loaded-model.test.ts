import {
  identityMatrix,
  instanceRecords,
  mesh,
  metresZUpLocal,
  noMesh,
  objectRef,
  unknownCoordinates,
  type Geometry,
  type ModelData,
  type ModelRef,
} from '@bim-open-toolkit/model';
import { describe, expect, it } from 'vitest';
import { formatCode } from '../src/diagnostics.js';
import { checkedModel, loadedModel, modelStatistics, validateLoadedModel } from '../src/loaded-model.js';

const ref: ModelRef = { id: 'sample', revision: '1' };

const geometry = (): Geometry => ({
  meshes: [
    mesh(Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0]), Uint32Array.from([0, 1, 2])),
    mesh(Float32Array.from([0, 0, 0, 2, 0, 0, 2, 2, 0]), Uint32Array.from([0, 1, 2])),
  ],
  instances: instanceRecords([
    { meshIndex: 0, transform: identityMatrix, color: [1, 1, 1], opacity: 1, objectIndex: 0 },
    { meshIndex: 1, transform: identityMatrix, color: [1, 0, 0], opacity: 0.5, objectIndex: 1 },
    { meshIndex: noMesh, transform: identityMatrix, color: [1, 1, 1], opacity: 1, objectIndex: 2 },
  ]),
});

const data = (): ModelData => ({
  ref,
  coordinates: metresZUpLocal,
  objects: [
    { ref: objectRef(ref, 'a'), transform: identityMatrix, representation: 0 },
    { ref: objectRef(ref, 'b'), transform: identityMatrix, representation: 1 },
    { ref: objectRef(ref, 'c'), transform: identityMatrix },
  ],
});

const sample = (): ReturnType<typeof loadedModel> => loadedModel('bfast', data(), geometry(), 1024);

describe('loadedModel', () => {
  it('takes its coordinate frame from the model data, so the two cannot disagree', () => {
    const model = sample();
    expect(model.coordinates).toBe(model.data.coordinates);
    expect(validateLoadedModel(model)).toEqual([]);
  });

  it('reports a model whose frames were made to disagree', () => {
    const model = { ...sample(), coordinates: unknownCoordinates };
    expect(validateLoadedModel(model)[0]?.path).toEqual(['coordinates']);
  });
});

describe('modelStatistics', () => {
  it('counts objects, meshes, placements and the objects with no drawn geometry', () => {
    expect(modelStatistics(sample())).toEqual({
      objects: 3,
      geometryFreeObjects: 1,
      meshes: 2,
      instances: 3,
      drawnInstances: 2,
      vertices: 6,
      triangles: 2,
    });
  });
});

describe('validateLoadedModel', () => {
  it('accepts the sample and reports nothing', () => {
    expect(checkedModel(sample()).ok).toBe(true);
  });

  it('rejects an instance naming a mesh that is not there', () => {
    const model = sample();
    model.geometry.instances.meshIndex[0] = 7;
    expect(validateLoadedModel(model)[0]?.path).toEqual(['instances', 'meshIndex', 0]);
    expect(checkedModel(model).ok).toBe(false);
  });

  it('rejects an instance naming an object that is not there', () => {
    const model = sample();
    model.geometry.instances.objectIndex[1] = 9;
    expect(validateLoadedModel(model)[0]?.path).toEqual(['instances', 'objectIndex', 1]);
  });

  it('rejects a non-finite instance transform', () => {
    const model = sample();
    model.geometry.instances.transform[5] = Number.NaN;
    expect(validateLoadedModel(model)[0]?.message).toContain('non-finite transform');
  });

  it('rejects a colour factor outside zero to one', () => {
    const model = sample();
    model.geometry.instances.color[2] = 4;
    expect(validateLoadedModel(model)[0]?.message).toContain('outside zero to one');
  });

  it('rejects a mesh index beyond the mesh vertices', () => {
    const model = sample();
    const first = model.geometry.meshes[0];
    if (first === undefined) throw new Error('fixture has no mesh');
    first.indices[2] = 5;
    expect(validateLoadedModel(model)[0]?.message).toContain('names vertex 5 of 3');
  });

  it('rejects an object from another model revision', () => {
    const model = sample();
    const objects = [...model.data.objects];
    objects[0] = { ...objects[0], ref: objectRef({ id: 'other', revision: '1' }, 'a'), transform: identityMatrix };
    const changed = { ...model, data: { ...model.data, objects } };
    expect(validateLoadedModel(changed)[0]?.message).toContain('different model revision');
  });

  it('rejects two objects sharing a key', () => {
    const model = sample();
    const objects = [...model.data.objects];
    objects[1] = { ...objects[1], ref: objectRef(ref, 'a'), transform: identityMatrix, representation: 1 };
    const changed = { ...model, data: { ...model.data, objects } };
    expect(validateLoadedModel(changed).some((each) => each.message.includes('more than one record'))).toBe(true);
  });

  it('rejects an object naming an instance row that belongs to another object', () => {
    const model = sample();
    const objects = [...model.data.objects];
    objects[0] = { ...objects[0], ref: objectRef(ref, 'a'), transform: identityMatrix, representation: 1 };
    const changed = { ...model, data: { ...model.data, objects } };
    expect(validateLoadedModel(changed)[0]?.message).toContain('belongs to another object');
  });

  it('rejects a negative source size', () => {
    expect(validateLoadedModel({ ...sample(), sourceBytes: -1 })[0]?.code).toBe(formatCode.invalidModel);
  });
});
