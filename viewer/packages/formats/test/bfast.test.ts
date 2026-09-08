import { parseBfastModel } from '@ara3d/viewer-loaders';
import { instanceTransform, isInstanceVisible, meshAt, meshCount, noMesh } from '@bim-open-toolkit/model';
import { describe, expect, it } from 'vitest';
import {
  bfastCoordinates,
  bfastEntityRows,
  bfastMeshTable,
  entityFactsFrom,
  readBfastModel,
} from '../src/bfast.js';
import { formatCode } from '../src/diagnostics.js';
import { modelStatistics, validateLoadedModel } from '../src/loaded-model.js';
import type { LoadProgress } from '../src/progress.js';
import {
  asBuffer,
  bfastModel,
  sampleBfast,
  squareMesh,
  translationRows,
  triangleMesh,
  writeBfast,
  type NamedBuffer,
} from './fixtures.js';

const sample = (): ArrayBuffer => asBuffer(sampleBfast());

describe('readBfastModel', () => {
  it('turns two meshes and three placements into one LoadedModel', async () => {
    const model = await readBfastModel(sample());
    expect(model.format).toBe('bfast');
    expect(model.coordinates).toEqual(bfastCoordinates);
    expect(validateLoadedModel(model)).toEqual([]);
    expect(modelStatistics(model)).toEqual({
      objects: 3,
      geometryFreeObjects: 1,
      meshes: 2,
      instances: 3,
      drawnInstances: 2,
      hiddenInstances: 0,
      meshVertices: 7,
      meshTriangles: 3,
    });
  });

  it('carries its geometry as a mesh table and builds no mesh record at all', async () => {
    const model = await readBfastModel(sample());
    const table = model.geometry.meshTable;
    expect(model.geometry.meshes).toEqual([]);
    expect(table === undefined ? 0 : meshCount(table)).toBe(2);
    expect(validateLoadedModel(model)).toEqual([]);
  });

  it('reads the transform of every placement as a column-major matrix', async () => {
    const { geometry } = await readBfastModel(sample());
    expect([...instanceTransform(geometry.instances, 0)]).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    expect([...instanceTransform(geometry.instances, 1)]).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 0, 1]);
  });

  it('reads the packed instance colour as red, green, blue and opacity factors', async () => {
    const { geometry } = await readBfastModel(sample());
    expect([...geometry.instances.color.subarray(0, 4)]).toEqual([1, 1, 1, 1]);
    expect([...geometry.instances.color.subarray(4, 7)]).toEqual([1, 0, 0]);
    expect(geometry.instances.color[7]).toBeCloseTo(128 / 255, 6);
  });

  it('keeps a placement with no geometry as a row, so its object stays addressable', async () => {
    const model = await readBfastModel(sample());
    expect(model.geometry.instances.meshIndex[2]).toBe(noMesh);
    expect(model.data.objects[2]?.representation).toBeUndefined();
    expect(model.data.objects[0]?.representation).toBe(0);
    expect(model.data.objects[1]?.representation).toBe(1);
  });

  it('names every object by its entity row of the source model', async () => {
    const model = await readBfastModel(sample(), { ref: { id: 'tower', revision: '3' } });
    expect(model.data.objects.map((each) => each.ref.objectId)).toEqual(['bos:0', 'bos:1', 'bos:2']);
    expect(model.data.objects[0]?.ref.modelId).toBe('tower');
    expect(model.data.objects[0]?.ref.revision).toBe('3');
  });

  it('keeps a placement the file marks hidden as a row that is not drawn, and says how many', async () => {
    const bytes = bfastModel({
      meshes: [triangleMesh()],
      instances: [
        { mesh: 0, entity: 0 },
        { mesh: 0, entity: 1, hidden: true },
      ],
    });
    const model = await readBfastModel(asBuffer(bytes));
    expect(model.geometry.instances.count).toBe(2);
    expect(isInstanceVisible(model.geometry.instances, 0)).toBe(true);
    expect(isInstanceVisible(model.geometry.instances, 1)).toBe(false);
    expect(modelStatistics(model).hiddenInstances).toBe(1);
    expect(model.data.objects.length).toBe(2);
    expect(model.data.objects[1]?.representation).toBe(1);
    expect(validateLoadedModel(model)).toEqual([]);
    expect(model.diagnostics.map((each) => each.code)).toContain(formatCode.hiddenInstances);
  });

  it('carries no visibility column when the file hides nothing', async () => {
    const model = await readBfastModel(sample());
    expect(model.geometry.instances.visible).toBeUndefined();
    expect(isInstanceVisible(model.geometry.instances, 0)).toBe(true);
    expect(model.diagnostics.map((each) => each.code)).not.toContain(formatCode.hiddenInstances);
  });

  it('reports a file with no BOS tables rather than pretending it has names', async () => {
    const model = await readBfastModel(sample());
    expect(model.diagnostics.map((each) => each.code)).toContain(formatCode.missingEntityTable);
    expect(model.data.objects[0]?.name).toBeUndefined();
    expect(model.data.objects[0]?.category).toBeUndefined();
  });

  it('reads no tables at all when the caller asks for no metadata', async () => {
    const model = await readBfastModel(sample(), { metadata: 'none' });
    expect(model.diagnostics.map((each) => each.code)).not.toContain(formatCode.missingEntityTable);
  });

  it('reports the coordinate frame it assumed, and takes one the caller states instead', async () => {
    const assumed = await readBfastModel(sample());
    expect(assumed.diagnostics.map((each) => each.code)).toContain(formatCode.assumedCoordinates);
    const stated = await readBfastModel(sample(), {
      coordinates: { units: 'millimetres', up: 'z', registration: { kind: 'local' } },
    });
    expect(stated.coordinates.units).toBe('millimetres');
    expect(stated.data.coordinates).toBe(stated.coordinates);
    expect(stated.diagnostics.map((each) => each.code)).not.toContain(formatCode.assumedCoordinates);
  });

  it('reports parse, metadata and convert progress in order', async () => {
    const seen: LoadProgress[] = [];
    await readBfastModel(sample(), { onProgress: (progress) => seen.push(progress) });
    expect(seen.map((each) => each.phase)).toEqual(['parse', 'parse', 'convert', 'convert', 'convert']);
  });

  it('stops before doing any work when the caller has already cancelled', async () => {
    await expect(readBfastModel(sample(), { signal: AbortSignal.abort() })).rejects.toMatchObject({
      code: formatCode.cancelled,
    });
  });
});

describe('readBfastModel on damaged files', () => {
  const damaged = async (bytes: Uint8Array): Promise<unknown> =>
    readBfastModel(asBuffer(bytes)).then(
      () => undefined,
      (error: unknown) => error,
    );

  it('rejects bytes that are not a BFAST at all', async () => {
    await expect(damaged(new TextEncoder().encode('not a model'))).resolves.toMatchObject({
      code: formatCode.invalidBfast,
    });
  });

  it('rejects a truncated file', async () => {
    await expect(damaged(sampleBfast().subarray(0, 512))).resolves.toMatchObject({
      code: formatCode.invalidBfast,
    });
  });

  it('rejects a file missing a render buffer', async () => {
    const partial: NamedBuffer[] = [{ name: 'VertexData', bytes: new Uint8Array(12) }];
    await expect(damaged(writeBfast(partial))).resolves.toMatchObject({ code: formatCode.invalidBfast });
  });

  it('rejects a mesh index that names a vertex the slice does not have', async () => {
    const bytes = bfastModel({
      meshes: [{ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 9] }],
      instances: [{ mesh: 0, entity: 0 }],
    });
    await expect(damaged(bytes)).resolves.toMatchObject({ code: formatCode.invalidBfast });
  });

  it('rejects a non-finite vertex', async () => {
    const bytes = bfastModel({
      meshes: [{ positions: [0, 0, 0, Number.NaN, 0, 0, 0, 1, 0], indices: [0, 1, 2] }],
      instances: [{ mesh: 0, entity: 0 }],
    });
    await expect(damaged(bytes)).resolves.toMatchObject({ code: formatCode.invalidBfast });
  });

  it('rejects a non-finite instance transform', async () => {
    const bytes = bfastModel({
      meshes: [triangleMesh()],
      instances: [{ mesh: 0, entity: 0, rows: [1, 0, 0, Number.POSITIVE_INFINITY, 0, 1, 0, 0, 0, 0, 1, 0] }],
    });
    await expect(damaged(bytes)).resolves.toMatchObject({ code: formatCode.invalidBfast });
  });

  it('rejects an instance naming a mesh that is not in the file', async () => {
    const bytes = bfastModel({ meshes: [triangleMesh()], instances: [{ mesh: 4, entity: 0 }] });
    await expect(damaged(bytes)).resolves.toMatchObject({ code: formatCode.invalidBfast });
  });

  it('rejects a negative entity index', async () => {
    const bytes = bfastModel({ meshes: [triangleMesh()], instances: [{ mesh: 0, entity: -1 }] });
    await expect(damaged(bytes)).resolves.toMatchObject({ code: formatCode.invalidBfast });
  });

  it('rejects lines, quads and vertex colours, which this path does not carry', async () => {
    const lines = bfastModel({ meshes: [triangleMesh()], instances: [{ mesh: 0, entity: 0 }], primitiveSize: 2 });
    await expect(damaged(lines)).resolves.toMatchObject({ code: formatCode.invalidBfast });
    const colored = bfastModel({ meshes: [triangleMesh()], instances: [{ mesh: 0, entity: 0 }], flags: 1 });
    await expect(damaged(colored)).resolves.toMatchObject({ code: formatCode.invalidBfast });
  });

  it('rejects an unreadable embedded entity table', async () => {
    const bytes = bfastModel({
      meshes: [triangleMesh()],
      instances: [{ mesh: 0, entity: 0 }],
      extras: [{ name: 'BOS/Entities.parquet', bytes: new Uint8Array([1, 2, 3, 4]) }],
    });
    await expect(damaged(bytes)).resolves.toMatchObject({ code: formatCode.invalidBfast });
  });
});

describe('bfastEntityRows', () => {
  const parsed = (): BfastTables => {
    const bytes = bfastModel({
      meshes: [triangleMesh(), squareMesh()],
      instances: [
        { mesh: 1, entity: 4, rows: translationRows(1, 2, 3) },
        { mesh: 0, entity: 2 },
        { mesh: 0, entity: 4 },
      ],
    });
    return parseFor(bytes);
  };

  it('lists the declared rows first, then any further entity in placement order', () => {
    const rows = bfastEntityRows(parsed(), 0);
    expect([...rows.entityOfRow]).toEqual([4, 2]);
    expect(rows.rowOfEntity[4]).toBe(0);
    expect(rows.rowOfEntity[2]).toBe(1);
  });

  it('keeps every declared row, including one no placement names', () => {
    const rows = bfastEntityRows(parsed(), 6);
    expect([...rows.entityOfRow]).toEqual([0, 1, 2, 3, 4, 5]);
    expect(rows.declared).toBe(6);
  });

  it('refuses a placement naming an entity beyond a declared table', () => {
    expect(() => bfastEntityRows(parsed(), 3)).toThrowError(/beyond the 3 rows/);
  });
});

describe('bfastMeshTable', () => {
  const twoMeshes = (): ReturnType<typeof parseFor> =>
    parseFor(bfastModel({ meshes: [triangleMesh(), squareMesh()], instances: [{ mesh: 0, entity: 0 }] }));

  it('reads each mesh as a range of the file, with the bounds the file stores', () => {
    const parsed = twoMeshes();
    const table = bfastMeshTable(parsed);
    expect(meshCount(table)).toBe(2);
    expect(table.positions).toBe(parsed.vertices);
    expect(table.indices).toBe(parsed.indices);
    expect(table.bounds).toBe(parsed.meshBounds);
    expect([...table.vertexStart]).toEqual([0, 3]);
    expect([...table.vertexCount]).toEqual([3, 4]);
    expect([...table.indexStart]).toEqual([0, 3]);
    expect([...table.indexCount]).toEqual([3, 6]);
  });

  it('reads back as the same meshes the record list gave, without copying a vertex', () => {
    const table = bfastMeshTable(twoMeshes());
    const first = meshAt(table, 0);
    const second = meshAt(table, 1);
    expect([...first.positions]).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect([...second.indices]).toEqual([0, 1, 2, 0, 2, 3]);
    expect(second.bounds).toEqual({ min: [0, 0, 0], max: [2, 2, 0] });
    expect(second.positions.buffer).toBe(first.positions.buffer);
    expect(first.positions.buffer).toBe(table.positions.buffer);
  });

  it('empties the box of a mesh with no vertices instead of reporting the zeros the file stores', () => {
    const parsed = parseFor(bfastModel({ meshes: [{ positions: [], indices: [] }, triangleMesh()], instances: [] }));
    const table = bfastMeshTable(parsed);
    expect(table.bounds).not.toBe(parsed.meshBounds);
    expect(meshAt(table, 0).bounds).toEqual({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
    expect(meshAt(table, 1).bounds).toEqual({ min: [0, 0, 0], max: [1, 1, 0] });
  });
});

describe('entityFactsFrom', () => {
  const strings = ['', 'Walls', 'Level 1 Wall', 'Doors', '   '];
  const entities = [
    { LocalId: 17n, Name: 1, Category: -1 },
    { LocalId: 19, Name: 2, Category: 0 },
    { LocalId: 0, Name: 3, Category: 99 },
    { LocalId: -4, Name: 4, Category: 0 },
  ];

  it('reads a source id whether the column arrives as a bigint or a number', () => {
    const facts = entityFactsFrom(entities, null);
    expect([...(facts.localId ?? [])]).toEqual([17, 19, 0, -4]);
    expect(facts.name).toBeNull();
  });

  it('reads a name from the string table and a category from the named entity row', () => {
    const facts = entityFactsFrom(entities, strings);
    expect(facts.name).toEqual(['Walls', 'Level 1 Wall', 'Doors', undefined]);
    expect(facts.category).toEqual([undefined, 'Walls', undefined, 'Walls']);
  });

  it('reads an empty or blank string-table entry as no value', () => {
    expect(entityFactsFrom([{ Name: 0 }, { Name: 4 }], strings).name).toEqual([undefined, undefined]);
  });
});

// What the loader hands back, which is what the geometry builders above take.
type BfastTables = ReturnType<typeof parseBfastModel>;

// Parses fixture bytes through the loader, so these tests read exactly what the file says.
function parseFor(bytes: Uint8Array): BfastTables {
  return parseBfastModel(asBuffer(bytes));
}
