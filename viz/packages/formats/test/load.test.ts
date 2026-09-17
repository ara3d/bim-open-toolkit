import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatCode } from '../src/diagnostics.js';
import { loadModel, readModel } from '../src/load.js';
import { validateLoadedModel } from '../src/loaded-model.js';
import type { LoadProgress } from '../src/progress.js';
import { mapResolver } from '../src/resolver.js';
import {
  asBuffer,
  asciiStlText,
  sampleBfast,
  stlTriangle,
  triangleBuffer,
  triangleGlb,
  triangleGltfText,
  writeBinaryStl,
} from './fixtures.js';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const objText = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadModel', () => {
  it('detects and loads every format from bytes alone', async () => {
    const cases: readonly (readonly [Uint8Array, string])[] = [
      [sampleBfast(), 'bfast'],
      [triangleGlb(), 'glb'],
      [utf8(objText), 'obj'],
      [writeBinaryStl([stlTriangle()]), 'stl'],
      [utf8(asciiStlText()), 'stl'],
    ];
    for (const [bytes, format] of cases) {
      const result = await loadModel(bytes, { validate: true });
      expect(result.ok, `${format} should load`).toBe(true);
      if (result.ok) expect(result.value.format).toBe(format);
    }
  });

  it('loads a glTF document once the host supplies its buffer', async () => {
    const result = await loadModel(utf8(triangleGltfText()), {
      resolver: mapResolver([['scene.bin', asBuffer(triangleBuffer())]]),
      validate: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.format).toBe('gltf');
  });

  it('names the model after the source when the caller states no identity', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(asBuffer(sampleBfast()), { status: 200 })));
    const result = await loadModel('https://host/models/tower.bfast');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.ref.id).toBe('https://host/models/tower.bfast');
      expect(result.value.data.ref.source).toBe('https://host/models/tower.bfast');
    }
  });

  it('takes the identity, frame and metadata level the caller states', async () => {
    const result = await loadModel(sampleBfast(), {
      ref: { id: 'tower', revision: '9' },
      coordinates: { units: 'metres', up: 'z', registration: { kind: 'local' } },
      metadata: 'none',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.ref).toEqual({ id: 'tower', revision: '9' });
      expect(result.value.coordinates.units).toBe('metres');
    }
  });

  it('uses the format the caller names instead of detecting one', async () => {
    const result = await loadModel(utf8('solid but actually OBJ\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'), {
      format: 'obj',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.format).toBe('obj');
  });

  it('carries the loader’s own diagnostics onto the result', async () => {
    const result = await loadModel(sampleBfast());
    expect(result.ok).toBe(true);
    expect(result.diagnostics.map((each) => each.code)).toContain(formatCode.missingEntityTable);
    if (result.ok) expect(result.diagnostics).toEqual(expect.arrayContaining([...result.value.diagnostics]));
  });

  it('reports fetch, parse and convert progress in that order', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response(asBuffer(sampleBfast()), { status: 200, headers: { 'content-length': '512' } })),
    );
    const seen: LoadProgress[] = [];
    await loadModel('https://host/tower.bfast', { onProgress: (progress) => seen.push(progress) });
    expect(seen[0]?.phase).toBe('fetch');
    expect(seen.map((each) => each.phase)).toContain('parse');
    expect(seen[seen.length - 1]?.phase).toBe('convert');
  });
});

describe('loadModel when it cannot', () => {
  it('reports an unrecognizable source rather than throwing', async () => {
    const result = await loadModel(utf8('this is prose and not a model'));
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe(formatCode.unknownFormat);
  });

  it('reports an empty source', async () => {
    const result = await loadModel(new Uint8Array(0));
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe(formatCode.emptySource);
  });

  it('reports a damaged file with the format’s own code', async () => {
    const result = await loadModel(sampleBfast().subarray(0, 400));
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe(formatCode.invalidBfast);
  });

  it('reports a failed fetch', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('gone', { status: 404 })));
    const result = await loadModel('https://host/tower.bfast');
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe(formatCode.fetchFailed);
  });

  it('reports a cancellation as a diagnostic, not as an exception', async () => {
    const result = await loadModel(sampleBfast(), { signal: AbortSignal.abort() });
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe(formatCode.cancelled);
  });

  it('fails when validation finds a problem the loader could not', async () => {
    const good = await loadModel(sampleBfast());
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    good.value.geometry.instances.objectIndex[0] = 99;
    expect(validateLoadedModel(good.value)[0]?.code).toBe(formatCode.invalidModel);
  });
});

describe('readModel', () => {
  it('raises rather than reports, so a caller that already knows can let it through', async () => {
    await expect(readModel('bfast', utf8('not a model'))).rejects.toMatchObject({ code: formatCode.invalidBfast });
  });

  it('reads each format it is told', async () => {
    expect((await readModel('obj', utf8(objText))).format).toBe('obj');
    expect((await readModel('stl', utf8(asciiStlText()))).format).toBe('stl');
    expect((await readModel('glb', triangleGlb())).format).toBe('glb');
    expect((await readModel('bfast', sampleBfast())).format).toBe('bfast');
  });
});
