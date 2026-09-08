import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormatError, formatCode } from '../src/diagnostics.js';
import type { LoadProgress } from '../src/progress.js';
import {
  fetchBytes,
  mapResolver,
  noResolver,
  resolveSource,
  sourceName,
  wholeBuffer,
} from '../src/resolver.js';

const utf8 = (value: string): Uint8Array => new TextEncoder().encode(value);
const buffer = (value: string): ArrayBuffer => utf8(value).slice().buffer;
const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

const streamResponse = (chunks: readonly Uint8Array[], headers: Record<string, string> = {}): Response =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    { status: 200, headers },
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveSource', () => {
  it('takes the bytes of an ArrayBuffer, a view and a Blob', async () => {
    const bytes = buffer('abcdef');
    expect(text((await resolveSource(bytes, {})).bytes)).toBe('abcdef');
    expect(text((await resolveSource(new Uint8Array(bytes, 2, 3), {})).bytes)).toBe('cde');
    expect(text((await resolveSource(new Blob([bytes]), {})).bytes)).toBe('abcdef');
  });

  it('names a source by its url, and a File by its file name', async () => {
    expect(sourceName('https://host/a.bfast')).toBe('https://host/a.bfast');
    expect(sourceName(new URL('https://host/a.bfast'))).toBe('https://host/a.bfast');
    expect(sourceName(new File([buffer('x')], 'tower.obj'))).toBe('tower.obj');
    expect(sourceName(buffer('x'))).toBeUndefined();
    expect((await resolveSource(new File([buffer('x')], 'tower.obj'), {})).name).toBe('tower.obj');
  });

  it('refuses an empty source by name', async () => {
    await expect(resolveSource(new Uint8Array(0), {})).rejects.toMatchObject({ code: formatCode.emptySource });
  });

  it('refuses to start when the caller has already cancelled', async () => {
    const signal = AbortSignal.abort();
    await expect(resolveSource(buffer('abc'), { signal })).rejects.toMatchObject({
      code: formatCode.cancelled,
    });
  });
});

describe('fetchBytes', () => {
  it('reports every chunk as fetch progress with the declared total', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(streamResponse([utf8('abc'), utf8('de')], { 'content-length': '5' })),
    );
    const seen: LoadProgress[] = [];
    const bytes = await fetchBytes('https://host/model', { onProgress: (p) => seen.push(p) });
    expect(text(new Uint8Array(bytes))).toBe('abcde');
    expect(seen).toEqual([
      { phase: 'fetch', loaded: 3, total: 5 },
      { phase: 'fetch', loaded: 5, total: 5 },
    ]);
  });

  it('omits the total when the server does not declare one', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(streamResponse([utf8('abc')])));
    const seen: LoadProgress[] = [];
    await fetchBytes('https://host/model', { onProgress: (p) => seen.push(p) });
    expect(seen).toEqual([{ phase: 'fetch', loaded: 3 }]);
  });

  it('fails by status', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('missing', { status: 404 })));
    await expect(fetchBytes('https://host/model', {})).rejects.toMatchObject({
      code: formatCode.fetchFailed,
    });
  });

  it('fails when a server answers a model request with HTML', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(streamResponse([utf8('<!doctype html>')], { 'content-type': 'text/html' })),
    );
    await expect(fetchBytes('https://host/model', {})).rejects.toMatchObject({
      code: formatCode.fetchFailed,
    });
  });

  it('stops mid-stream when the caller cancels', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            start(stream) {
              stream.enqueue(utf8('abc'));
              controller.abort();
              stream.enqueue(utf8('def'));
              stream.close();
            },
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(fetchBytes('https://host/model', { signal: controller.signal })).rejects.toMatchObject({
      code: formatCode.cancelled,
    });
  });
});

describe('resolvers', () => {
  it('the default resolver refuses every reference, naming it', async () => {
    const failed: unknown = await noResolver.resolve('scene.bin', {}).catch((error: unknown) => error);
    expect(failed).toBeInstanceOf(FormatError);
    expect(failed).toMatchObject({ code: formatCode.unresolvedResource, path: ['scene.bin'] });
  });

  it('a map resolver answers what it holds and refuses the rest', async () => {
    const resolver = mapResolver([['scene.bin', buffer('data')]]);
    expect(text(new Uint8Array(await resolver.resolve('scene.bin', {})))).toBe('data');
    await expect(resolver.resolve('other.bin', {})).rejects.toMatchObject({
      code: formatCode.unresolvedResource,
    });
  });
});

describe('wholeBuffer', () => {
  it('passes a whole buffer through and copies only a view of one', () => {
    const bytes = utf8('abcdef');
    expect(wholeBuffer(bytes)).toBe(bytes.buffer);
    const slice = new Uint8Array(bytes.buffer, 2, 2);
    expect(wholeBuffer(slice)).not.toBe(bytes.buffer);
    expect(text(new Uint8Array(wholeBuffer(slice)))).toBe('cd');
  });
});
