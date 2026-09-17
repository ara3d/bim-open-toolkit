import { describe, expect, it } from 'vitest';
import { formatCode } from '../src/diagnostics.js';
import { modelStatistics, validateLoadedModel } from '../src/loaded-model.js';
import { isBinaryStl, readStlModel, stlCoordinates } from '../src/stl.js';
import { asciiStlText, stlTriangle, writeBinaryStl } from './fixtures.js';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const failure = (bytes: Uint8Array): unknown => {
  try {
    readStlModel(bytes);
    return undefined;
  } catch (error) {
    return error;
  }
};

describe('readStlModel on a binary file', () => {
  it('reads one triangle into one object, one mesh and one placement', () => {
    const model = readStlModel(writeBinaryStl([stlTriangle()]));
    expect(model.format).toBe('stl');
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
    expect([...(model.geometry.meshes[0]?.normals ?? [])]).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  });

  it('gives every triangle its own three vertices, since STL shares none', () => {
    const model = readStlModel(writeBinaryStl([stlTriangle(), stlTriangle()]));
    expect(model.geometry.meshes[0]?.positions.length).toBe(18);
    expect([...(model.geometry.meshes[0]?.indices ?? [])]).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('names the object from the header when it holds one', () => {
    expect(readStlModel(writeBinaryStl([stlTriangle()], 'tower')).data.objects[0]?.name).toBe('tower');
    expect(readStlModel(writeBinaryStl([stlTriangle()], '')).data.objects[0]?.name).toBeUndefined();
  });

  it('is told apart from ASCII by its exact length', () => {
    expect(isBinaryStl(writeBinaryStl([stlTriangle()]))).toBe(true);
    expect(isBinaryStl(utf8(asciiStlText()))).toBe(false);
  });

  it('refuses a file whose length does not match its triangle count', () => {
    const bytes = writeBinaryStl([stlTriangle(), stlTriangle()]);
    expect(failure(bytes.subarray(0, bytes.byteLength - 10))).toMatchObject({ code: formatCode.invalidStl });
  });

  it('refuses a non-finite vertex', () => {
    const bytes = writeBinaryStl([stlTriangle()]);
    new DataView(bytes.buffer).setFloat32(84 + 12, Number.NaN, true);
    expect(failure(bytes)).toMatchObject({ code: formatCode.invalidStl });
  });
});

describe('readStlModel on an ASCII file', () => {
  it('reads facets and their vertices', () => {
    const model = readStlModel(utf8(asciiStlText('tower')));
    expect(model.data.objects[0]?.name).toBe('tower');
    expect([...(model.geometry.meshes[0]?.positions ?? [])]).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect([...(model.geometry.meshes[0]?.normals ?? [])]).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    expect(validateLoadedModel(model)).toEqual([]);
  });

  it('refuses a facet with more than three vertices', () => {
    const broken = asciiStlText().replace('      vertex 0 1 0\n', '      vertex 0 1 0\n      vertex 1 1 0\n');
    expect(failure(utf8(broken))).toMatchObject({ code: formatCode.invalidStl });
  });

  it('refuses a file that ends inside a facet', () => {
    const truncated = 'solid t\n  facet normal 0 0 1\n    outer loop\n      vertex 0 0 0\n      vertex 1 0 0\n';
    expect(failure(utf8(truncated))).toMatchObject({ code: formatCode.invalidStl });
  });

  it('refuses a vertex that is not three numbers', () => {
    const broken = asciiStlText().replace('vertex 0 0 0', 'vertex 0 0');
    expect(failure(utf8(broken))).toMatchObject({ code: formatCode.invalidStl });
  });

  it('refuses bytes that are neither form of STL', () => {
    expect(failure(utf8('this is prose, not a solid'))).toMatchObject({ code: formatCode.invalidStl });
  });

  it('reports an empty solid rather than failing', () => {
    const model = readStlModel(utf8('solid empty\nendsolid empty\n'));
    expect(model.geometry.instances.count).toBe(0);
    expect(model.data.objects.length).toBe(1);
    expect(model.data.objects[0]?.representation).toBeUndefined();
    expect(model.diagnostics.map((each) => each.code)).toContain(formatCode.noGeometry);
  });
});

describe('readStlModel', () => {
  it('says the format carries no colour it can read', () => {
    const model = readStlModel(writeBinaryStl([stlTriangle()]));
    expect(model.diagnostics.map((each) => each.code)).toContain(formatCode.droppedVertexColors);
    expect([...model.geometry.instances.color]).toEqual([1, 1, 1, 1]);
  });

  it('reports the frame it assumed, and takes one the caller states instead', () => {
    expect(readStlModel(writeBinaryStl([stlTriangle()])).coordinates).toEqual(stlCoordinates);
    const stated = readStlModel(writeBinaryStl([stlTriangle()]), {
      coordinates: { units: 'millimetres', up: 'z', registration: { kind: 'local' } },
    });
    expect(stated.coordinates.units).toBe('millimetres');
    expect(stated.diagnostics.map((each) => each.code)).not.toContain(formatCode.assumedCoordinates);
  });

  it('stops when the caller has already cancelled', () => {
    expect(() => readStlModel(writeBinaryStl([stlTriangle()]), { signal: AbortSignal.abort() })).toThrowError(/cancelled/i);
  });
});
