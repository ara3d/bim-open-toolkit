import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { sampleBosGeometry } from './helpers.js';
import { bosToBfast } from '../src/bos-to-bfast.js';
import { parseBfastModel, bfastToGroups } from '../src/bfast-loader.js';
import { bosToGroups } from '../src/bos-geometry.js';
import { findBimTable } from '../src/bim-data.js';
import { writeBFast } from '../src/bfast-writer.js';

// Isolate geometry preparation from Parquet decoding; real archives are covered in bos-file.test.
vi.mock('../src/bos-loader.js', () => ({ parseBosGeometryFromZip: vi.fn(async () => sampleBosGeometry()) }));

describe('combined BOS/BFAST serialization', () => {
  it('keeps all Parquet bytes and original paths, including unknown future tables', async () => {
    const zip = new JSZip();
    const files = new Map([
      ['tables/Entities.parquet', new Uint8Array([0, 1, 2, 3])],
      ['Properties.PARQUET', new Uint8Array([255, 7, 8])],
      ['Future/Table.parquet', new Uint8Array([10, 20])],
      ['geometry/VertexBuffer.parquet', new Uint8Array([30, 40])],
    ]);
    for (const [name, bytes] of files) zip.file(name, bytes);
    zip.file('notes.txt', 'not a parquet table');
    const buffer = await bosToBfast(await zip.generateAsync({ type: 'arraybuffer' }));
    const model = parseBfastModel(buffer);
    expect([...model.bimData.keys()]).toEqual([...files.keys()]);
    for (const [name, bytes] of files) {
      expect(model.bimData.get(name)).toEqual(bytes);
      expect(model.bimData.get(name)!.buffer).toBe(buffer);
    }
    expect(findBimTable(model.bimData, 'Entities.parquet')).toEqual(files.get('tables/Entities.parquet'));
    const expected = bosToGroups(sampleBosGeometry());
    const actual = bfastToGroups(model);
    expect(actual.instanceCount).toBe(expected.instanceCount);
    actual.groups.forEach((group, i) => {
      expect(group.mesh).toEqual(expected.groups[i].mesh);
      expect(group.transforms).toEqual(expected.groups[i].transforms);
      expect(group.colors).toEqual(expected.groups[i].colors);
    });
  });
  it('rejects ambiguous table lookups and invalid container names', () => {
    const data = new Map([['a/Entities.parquet', new Uint8Array()], ['b/Entities.parquet', new Uint8Array()]]);
    expect(() => findBimTable(data, 'Entities.parquet')).toThrow(/Ambiguous/);
    expect(findBimTable(data, 'a/Entities.parquet')).toBe(data.get('a/Entities.parquet'));
    expect(() => writeBFast([{ name: 'bad\0name', bytes: new Uint8Array() }])).toThrow(/names/);
  });
});
