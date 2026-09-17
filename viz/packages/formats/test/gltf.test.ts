import { instanceTransform } from '@bim-open-toolkit/model';
import { describe, expect, it } from 'vitest';
import { formatCode } from '../src/diagnostics.js';
import { composeTrs, gltfCoordinates, nodeTransform, readGltfModel } from '../src/gltf.js';
import { modelStatistics, validateLoadedModel } from '../src/loaded-model.js';
import { mapResolver } from '../src/resolver.js';
import { asBuffer, triangleBuffer, triangleGlb, triangleGltfJson, triangleGltfText, writeGlb } from './fixtures.js';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const failure = async (bytes: Uint8Array): Promise<unknown> =>
  readGltfModel(bytes).then(
    () => undefined,
    (error: unknown) => error,
  );

describe('readGltfModel on a GLB', () => {
  it('turns one mesh placed by one node into a LoadedModel with both nodes as objects', async () => {
    const model = await readGltfModel(triangleGlb());
    expect(model.format).toBe('glb');
    expect(validateLoadedModel(model)).toEqual([]);
    expect(modelStatistics(model)).toEqual({
      objects: 2,
      geometryFreeObjects: 1,
      meshes: 1,
      instances: 1,
      drawnInstances: 1,
      hiddenInstances: 0,
      meshVertices: 3,
      meshTriangles: 1,
    });
  });

  it('keeps the node names and the parent link', async () => {
    const model = await readGltfModel(triangleGlb());
    expect(model.data.objects.map((each) => each.name)).toEqual(['root', 'placed']);
    expect(model.data.objects[0]?.parentId).toBeUndefined();
    expect(model.data.objects[1]?.parentId).toBe('node:0');
    expect(model.data.objects[1]?.representation).toBe(0);
  });

  it('bakes the node hierarchy into the placement transform', async () => {
    const model = await readGltfModel(triangleGlb());
    expect([...instanceTransform(model.geometry.instances, 0)].slice(12, 15)).toEqual([2, 0, 0]);
  });

  it('reads the material base colour as the placement colour factor', async () => {
    const model = await readGltfModel(triangleGlb());
    expect([...model.geometry.instances.color]).toEqual([1, 0, 0, 0.5]);
  });

  it('reports the frame glTF states rather than assuming one', async () => {
    const model = await readGltfModel(triangleGlb());
    expect(model.coordinates).toEqual(gltfCoordinates);
    expect(model.data.coordinates).toBe(model.coordinates);
  });

  it('reads the mesh positions and indices through its accessors', async () => {
    const model = await readGltfModel(triangleGlb());
    expect([...(model.geometry.meshes[0]?.positions ?? [])]).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect([...(model.geometry.meshes[0]?.indices ?? [])]).toEqual([0, 1, 2]);
  });
});

describe('readGltfModel on a glTF document', () => {
  it('asks the resolver for a buffer the document does not contain', async () => {
    const resolver = mapResolver([['scene.bin', asBuffer(triangleBuffer())]]);
    const model = await readGltfModel(utf8(triangleGltfText()), { resolver });
    expect(model.format).toBe('gltf');
    expect(model.geometry.instances.count).toBe(1);
    expect(validateLoadedModel(model)).toEqual([]);
  });

  it('refuses to reach for a buffer when no resolver was supplied, naming it', async () => {
    await expect(failure(utf8(triangleGltfText()))).resolves.toMatchObject({
      code: formatCode.unresolvedResource,
      path: ['scene.bin'],
    });
  });

  it('decodes a base64 data uri in place', async () => {
    const base64 = Buffer.from(triangleBuffer()).toString('base64');
    const text = JSON.stringify(triangleGltfJson(`data:application/octet-stream;base64,${base64}`));
    const model = await readGltfModel(utf8(text));
    expect([...(model.geometry.meshes[0]?.positions ?? [])]).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  });

  it('warns that textures and animation are not carried', async () => {
    const json = triangleGltfJson();
    const withExtras = { ...(json as object), textures: [{ source: 0 }], animations: [{ channels: [], samplers: [] }] };
    const model = await readGltfModel(writeGlb(withExtras, triangleBuffer()));
    const codes = model.diagnostics.map((each) => each.code);
    expect(codes).toContain(formatCode.droppedTextures);
    expect(codes).toContain(formatCode.droppedAnimation);
  });
});

describe('readGltfModel on documents it cannot read', () => {
  it('refuses a required extension by name', async () => {
    const bytes = writeGlb({ asset: { version: '2.0' }, extensionsRequired: ['KHR_draco_mesh_compression'] });
    await expect(failure(bytes)).resolves.toMatchObject({
      code: formatCode.invalidGltf,
      message: expect.stringContaining('KHR_draco_mesh_compression'),
    });
  });

  it('refuses a GLB whose declared length is longer than the file', async () => {
    const bytes = triangleGlb();
    new DataView(bytes.buffer).setUint32(8, bytes.byteLength + 64, true);
    await expect(failure(bytes)).resolves.toMatchObject({ code: formatCode.invalidGltf });
  });

  it('refuses a truncated GLB', async () => {
    await expect(failure(triangleGlb().subarray(0, 16))).resolves.toMatchObject({ code: formatCode.invalidGltf });
  });

  it('refuses JSON that is not JSON', async () => {
    await expect(failure(utf8('{ this is not json'))).resolves.toMatchObject({ code: formatCode.invalidGltf });
  });

  it('refuses an index accessor naming a vertex the primitive does not have', async () => {
    const buffer = triangleBuffer();
    new Uint16Array(buffer.buffer, 36, 3).set([0, 1, 9]);
    await expect(failure(writeGlb(triangleGltfJson(), buffer))).resolves.toMatchObject({
      code: formatCode.invalidGltf,
      message: expect.stringContaining('names vertex 9 of 3'),
    });
  });

  it('refuses a buffer view that needs more bytes than its buffer holds', async () => {
    const json = triangleGltfJson();
    const shortened = { ...(json as object), bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 6 }] };
    await expect(failure(writeGlb(shortened, triangleBuffer().subarray(0, 12)))).resolves.toMatchObject({
      code: formatCode.invalidGltf,
    });
  });

  it('refuses a node with two parents', async () => {
    const json = {
      asset: { version: '2.0' },
      nodes: [{ children: [2] }, { children: [2] }, {}],
    };
    await expect(failure(writeGlb(json))).resolves.toMatchObject({
      code: formatCode.invalidGltf,
      message: expect.stringContaining('more than one parent'),
    });
  });

  it('reports a document that draws nothing rather than failing', async () => {
    const model = await readGltfModel(writeGlb({ asset: { version: '2.0' }, nodes: [{ name: 'empty' }] }));
    expect(model.geometry.instances.count).toBe(0);
    expect(model.data.objects.length).toBe(1);
    expect(model.diagnostics.map((each) => each.code)).toContain(formatCode.noGeometry);
  });

  it('skips a primitive whose mode is not triangles, and says so', async () => {
    const json = triangleGltfJson();
    const lines = { ...(json as object), meshes: [{ primitives: [{ mode: 1, attributes: { POSITION: 0 } }] }] };
    const model = await readGltfModel(writeGlb(lines, triangleBuffer()));
    expect(model.geometry.meshes.length).toBe(0);
    expect(model.diagnostics.map((each) => each.code)).toContain(formatCode.droppedPrimitives);
  });

  it('stops when the caller has already cancelled', async () => {
    await expect(readGltfModel(triangleGlb(), { signal: AbortSignal.abort() })).rejects.toMatchObject({
      code: formatCode.cancelled,
    });
  });
});

describe('node transforms', () => {
  it('reads a matrix when the node has one', () => {
    const matrix = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 1, 2, 3, 1];
    expect([...nodeTransform({ matrix })]).toEqual(matrix);
  });

  it('composes translation, rotation and scale when it does not', () => {
    expect([...nodeTransform({ translation: [1, 2, 3] })]).toEqual([...composeTrs(1, 2, 3, 0, 0, 0, 1, 1, 1, 1)]);
    expect([...nodeTransform({})]).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });

  it('turns a quarter turn about z into the matrix that rotates x onto y', () => {
    const quarter = Math.SQRT1_2;
    const matrix = composeTrs(0, 0, 0, 0, 0, quarter, quarter, 1, 1, 1);
    expect(matrix[0]).toBeCloseTo(0, 6);
    expect(matrix[1]).toBeCloseTo(1, 6);
    expect(matrix[4]).toBeCloseTo(-1, 6);
    expect(matrix[5]).toBeCloseTo(0, 6);
  });
});
