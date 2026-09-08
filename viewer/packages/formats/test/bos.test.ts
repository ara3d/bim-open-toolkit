import { describe, expect, it } from 'vitest';
import { readBfastModel } from '../src/bfast.js';
import { readBosModel, type BosConverter } from '../src/bos.js';
import { formatCode } from '../src/diagnostics.js';
import { validateLoadedModel } from '../src/loaded-model.js';
import type { LoadProgress } from '../src/progress.js';
import { asBuffer, sampleBfast } from './fixtures.js';

/**
 * BOS is loaded by preparing it as BFAST first, so the conversion is the only part of the path that
 * is specific to BOS. Injecting it here tests the composition against bytes built in memory; the
 * shipped conversion runs against a real archive in `test/perf/bfast-versus-bos.perf.ts`.
 */
const preparesTo = (bytes: Uint8Array): BosConverter => (): Promise<ArrayBuffer> => Promise.resolve(asBuffer(bytes));

const archive = (): ArrayBuffer => new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]).slice().buffer;

describe('readBosModel', () => {
  it('gives the same model as loading the prepared file directly', async () => {
    const prepared = sampleBfast();
    const throughBos = await readBosModel(archive(), { convert: preparesTo(prepared) });
    const direct = await readBfastModel(asBuffer(prepared));
    expect(throughBos.data).toEqual(direct.data);
    expect(throughBos.geometry).toEqual(direct.geometry);
    expect(throughBos.coordinates).toEqual(direct.coordinates);
    expect(throughBos.diagnostics).toEqual(direct.diagnostics);
    expect(validateLoadedModel(throughBos)).toEqual([]);
  });

  it('records the format and the size of what the caller supplied, not of the prepared file', async () => {
    const prepared = sampleBfast();
    const model = await readBosModel(archive(), { convert: preparesTo(prepared) });
    expect(model.format).toBe('bos');
    expect(model.sourceBytes).toBe(8);
    expect(prepared.byteLength).toBeGreaterThan(8);
  });

  it('passes the caller’s identity, frame and metadata level through to the BFAST path', async () => {
    const model = await readBosModel(archive(), {
      convert: preparesTo(sampleBfast()),
      ref: { id: 'tower', revision: '7' },
      coordinates: { units: 'feet', up: 'z', registration: { kind: 'project', projectId: 'p1' } },
      metadata: 'none',
    });
    expect(model.data.ref.id).toBe('tower');
    expect(model.coordinates.units).toBe('feet');
    expect(model.diagnostics.map((each) => each.code)).not.toContain(formatCode.missingEntityTable);
  });

  it('reports the conversion as the first half of the parse phase', async () => {
    const seen: LoadProgress[] = [];
    await readBosModel(archive(), {
      convert: preparesTo(sampleBfast()),
      onProgress: (progress) => seen.push(progress),
    });
    expect(seen[0]).toEqual({ phase: 'parse', loaded: 0, total: 2 });
    expect(seen[1]).toEqual({ phase: 'parse', loaded: 1, total: 2 });
  });

  it('fails with the BOS code when the archive cannot be prepared', async () => {
    const failing: BosConverter = () => Promise.reject(new Error('not a BOS archive'));
    await expect(readBosModel(archive(), { convert: failing })).rejects.toMatchObject({
      code: formatCode.invalidBos,
      message: expect.stringContaining('not a BOS archive'),
    });
  });

  it('fails with the BFAST code when the prepared bytes are not a model', async () => {
    await expect(
      readBosModel(archive(), { convert: preparesTo(new TextEncoder().encode('nonsense')) }),
    ).rejects.toMatchObject({ code: formatCode.invalidBfast });
  });

  it('stops when the caller cancels while the archive is being prepared', async () => {
    const controller = new AbortController();
    const slow: BosConverter = () => {
      controller.abort();
      return Promise.resolve(asBuffer(sampleBfast()));
    };
    await expect(readBosModel(archive(), { convert: slow, signal: controller.signal })).rejects.toMatchObject({
      code: formatCode.cancelled,
    });
  });
});
