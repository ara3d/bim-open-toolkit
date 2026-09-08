import { describe, expect, it } from 'vitest';
import { formatCode } from '../src/diagnostics.js';
import { modelStatistics, validateLoadedModel } from '../src/loaded-model.js';
import { objCoordinates, readObjModel } from '../src/obj.js';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const read = (text: string): ReturnType<typeof readObjModel> => readObjModel(utf8(text));
const failure = (text: string): unknown => {
  try {
    read(text);
    return undefined;
  } catch (error) {
    return error;
  }
};

const square = ['v 0 0 0', 'v 1 0 0', 'v 1 1 0', 'v 0 1 0', 'f 1 2 3 4'].join('\n');

describe('readObjModel', () => {
  it('reads a triangle into one object, one mesh and one placement', () => {
    const model = read('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
    expect(model.format).toBe('obj');
    expect(validateLoadedModel(model)).toEqual([]);
    expect(modelStatistics(model)).toEqual({
      objects: 1,
      geometryFreeObjects: 0,
      meshes: 1,
      instances: 1,
      drawnInstances: 1,
      hiddenInstances: 0,
      meshVertices: 3,
      meshTriangles: 1,
    });
    expect([...(model.geometry.meshes[0]?.positions ?? [])]).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  });

  it('triangulates a face with more than three corners as a fan', () => {
    const model = read(square);
    expect([...(model.geometry.meshes[0]?.indices ?? [])]).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('makes one object and one mesh per group, keeping the group name', () => {
    const model = read(
      ['o left', 'v 0 0 0', 'v 1 0 0', 'v 0 1 0', 'f 1 2 3', 'o right', 'v 2 0 0', 'v 3 0 0', 'v 2 1 0', 'f 4 5 6'].join('\n'),
    );
    expect(model.data.objects.map((each) => each.name)).toEqual(['left', 'right']);
    expect(model.geometry.meshes.length).toBe(2);
    expect(model.geometry.instances.count).toBe(2);
    expect([...model.geometry.instances.objectIndex]).toEqual([0, 1]);
    expect([...(model.geometry.meshes[1]?.positions ?? [])]).toEqual([2, 0, 0, 3, 0, 0, 2, 1, 0]);
  });

  it('reads normals, giving each distinct position and normal pair its own vertex', () => {
    const model = read(
      ['v 0 0 0', 'v 1 0 0', 'v 0 1 0', 'vn 0 0 1', 'vn 0 0 -1', 'f 1//1 2//1 3//1', 'f 1//2 3//2 2//2'].join('\n'),
    );
    const mesh = model.geometry.meshes[0];
    expect(mesh?.normals).toBeDefined();
    expect(mesh?.positions.length).toBe(18);
    expect([...(mesh?.normals ?? [])].slice(0, 3)).toEqual([0, 0, 1]);
    expect([...(mesh?.normals ?? [])].slice(9, 12)).toEqual([0, 0, -1]);
  });

  it('accepts the v/vt/vn corner forms and negative indices', () => {
    const model = read(['v 0 0 0', 'v 1 0 0', 'v 0 1 0', 'vt 0 0', 'f -3/1 -2/1 -1/1'].join('\n'));
    expect([...(model.geometry.meshes[0]?.indices ?? [])]).toEqual([0, 1, 2]);
  });

  it('ignores comments, blank lines and statements it has no use for', () => {
    const model = read(['# a comment', '', 's off', 'v 0 0 0', 'v 1 0 0', 'v 0 1 0', 'f 1 2 3'].join('\n'));
    expect(model.geometry.instances.count).toBe(1);
  });

  it('says material libraries are not read', () => {
    const model = read(['mtllib walls.mtl', 'v 0 0 0', 'v 1 0 0', 'v 0 1 0', 'usemtl brick', 'f 1 2 3'].join('\n'));
    expect(model.diagnostics.map((each) => each.code)).toContain(formatCode.droppedMaterialLibrary);
    expect([...model.geometry.instances.color]).toEqual([1, 1, 1, 1]);
  });

  it('reports the frame it assumed, and takes one the caller states instead', () => {
    expect(read(square).coordinates).toEqual(objCoordinates);
    const stated = readObjModel(utf8(square), { coordinates: { units: 'feet', up: 'z', registration: { kind: 'local' } } });
    expect(stated.coordinates.units).toBe('feet');
    expect(stated.diagnostics.map((each) => each.code)).not.toContain(formatCode.assumedCoordinates);
  });

  it('reports a file with no faces rather than failing', () => {
    const model = read('v 0 0 0\nv 1 0 0\n');
    expect(model.geometry.instances.count).toBe(0);
    expect(model.diagnostics.map((each) => each.code)).toContain(formatCode.noGeometry);
  });
});

describe('readObjModel on damaged files', () => {
  it('refuses a vertex that is not three numbers', () => {
    expect(failure('v 0 0\nf 1 1 1')).toMatchObject({ code: formatCode.invalidObj });
    expect(failure('v 0 0 nope\n')).toMatchObject({ code: formatCode.invalidObj });
  });

  it('refuses a face index outside the vertices declared so far', () => {
    expect(failure('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 9')).toMatchObject({
      code: formatCode.invalidObj,
      message: expect.stringContaining('names element 9 of 3'),
    });
  });

  it('refuses a face index of zero, which the format counts from one', () => {
    expect(failure('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 0 1 2')).toMatchObject({ code: formatCode.invalidObj });
  });

  it('refuses a face with fewer than three corners', () => {
    expect(failure('v 0 0 0\nv 1 0 0\nf 1 2')).toMatchObject({ code: formatCode.invalidObj });
  });

  it('stops when the caller has already cancelled', () => {
    expect(() => readObjModel(utf8(square), { signal: AbortSignal.abort() })).toThrowError(/cancelled/i);
  });
});
