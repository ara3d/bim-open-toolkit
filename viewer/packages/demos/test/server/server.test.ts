import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createIntegrityCache } from '../../src/server/integrity.js';
import { createFixtureServer, type FixtureServer } from '../../src/server/server.js';

// JSON.parse typed so no `any` escapes into the test.
const parseJson: (text: string) => unknown = JSON.parse;

const ALPHA = Uint8Array.from({ length: 100 }, (_value, index) => (index * 7) % 256);
const BETA = Uint8Array.from({ length: 40 }, (_value, index) => 255 - index);

const hex = (bytes: Uint8Array): string => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const sha256Hex = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> =>
  hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));

let root = '';
let models = '';
let server: FixtureServer | null = null;

const url = (path: string): string => `${server === null ? '' : server.url}${path}`;

const body = async (response: Response): Promise<unknown> => parseJson(await response.text());

const bytesOf = async (response: Response): Promise<Uint8Array> => new Uint8Array(await response.arrayBuffer());

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'v2-fixtures-'));
  models = join(root, 'models');
  await mkdir(models);
  await writeFile(join(root, 'secret.txt'), 'not servable');
  await writeFile(join(models, 'alpha.bfast'), ALPHA);
  await writeFile(join(models, 'beta.bos'), BETA);
  await writeFile(join(models, 'empty.bfast'), new Uint8Array(0));
  await writeFile(join(models, 'notes.txt'), 'ignored');
  server = await createFixtureServer({ dirs: [models, join(root, 'missing-directory')] });
});

afterAll(async () => {
  if (server !== null) await server.close();
  server = null;
  await rm(root, { recursive: true, force: true });
});

describe('fixture server catalog endpoints', () => {
  it('reports health with the number of catalogued fixtures', async () => {
    const response = await fetch(url('/health'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await body(response)).toEqual({ status: 'ok', fixtures: 3 });
  });

  it('lists names, sizes and formats, and no local paths', async () => {
    const response = await fetch(url('/fixtures'));
    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({
      fixtures: [
        { name: 'alpha.bfast', bytes: 100, format: 'bfast' },
        { name: 'beta.bos', bytes: 40, format: 'bos' },
        { name: 'empty.bfast', bytes: 0, format: 'bfast' },
      ],
    });
  });

  it('starts and serves an empty catalog when no configured directory exists', async () => {
    const empty = await createFixtureServer({ dirs: [join(root, 'missing-directory')] });
    const listed = await body(await fetch(`${empty.url}/fixtures`));
    const health = await body(await fetch(`${empty.url}/health`));
    await empty.close();
    expect(listed).toEqual({ fixtures: [] });
    expect(health).toEqual({ status: 'ok', fixtures: 0 });
  });

  it('binds the loopback address', () => {
    expect(server?.url.startsWith('http://127.0.0.1:')).toBe(true);
  });
});

describe('fixture server byte serving', () => {
  it('serves a whole file with the headers a browser needs', async () => {
    const response = await fetch(url('/fixtures/alpha.bfast'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(response.headers.get('content-length')).toBe('100');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('cache-control')).toBe('private, max-age=3600');
    expect([...(await bytesOf(response))]).toEqual([...ALPHA]);
  });

  it('serves a second format from the same catalog', async () => {
    const response = await fetch(url('/fixtures/beta.bos'));
    expect([...(await bytesOf(response))]).toEqual([...BETA]);
  });

  it('serves a byte range as 206 with the matching slice', async () => {
    const response = await fetch(url('/fixtures/alpha.bfast'), { headers: { range: 'bytes=10-19' } });
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 10-19/100');
    expect(response.headers.get('content-length')).toBe('10');
    expect([...(await bytesOf(response))]).toEqual([...ALPHA.slice(10, 20)]);
  });

  it('serves a suffix range', async () => {
    const response = await fetch(url('/fixtures/alpha.bfast'), { headers: { range: 'bytes=-4' } });
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 96-99/100');
    expect([...(await bytesOf(response))]).toEqual([...ALPHA.slice(96)]);
  });

  it('refuses a range past the end with 416 and the file size', async () => {
    const response = await fetch(url('/fixtures/alpha.bfast'), { headers: { range: 'bytes=500-600' } });
    expect(response.status).toBe(416);
    expect(response.headers.get('content-range')).toBe('bytes */100');
    expect(await body(response)).toEqual({
      error: 'range_not_satisfiable',
      reason: 'The requested range lies outside the fixture.',
    });
  });

  it('serves an empty fixture without a range', async () => {
    const response = await fetch(url('/fixtures/empty.bfast'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('0');
    expect((await bytesOf(response)).length).toBe(0);
  });

  it('answers HEAD with the headers and no body', async () => {
    const response = await fetch(url('/fixtures/alpha.bfast'), { method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('100');
    expect((await bytesOf(response)).length).toBe(0);
  });
});

describe('fixture server integrity records', () => {
  it('reports the size and SHA-256 of a fixture', async () => {
    const response = await fetch(url('/fixtures/alpha.bfast.json'));
    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({
      name: 'alpha.bfast',
      bytes: 100,
      format: 'bfast',
      sha256: await sha256Hex(ALPHA),
    });
  });

  it('reports the same record on a repeat request', async () => {
    const first = await body(await fetch(url('/fixtures/beta.bos.json')));
    const second = await body(await fetch(url('/fixtures/beta.bos.json')));
    expect(first).toEqual(second);
    expect(first).toEqual({ name: 'beta.bos', bytes: 40, format: 'bos', sha256: await sha256Hex(BETA) });
  });

  it('computes a digest once per file', async () => {
    const digest = createIntegrityCache();
    const entry = { name: 'alpha.bfast', path: join(models, 'alpha.bfast'), bytes: 100, format: 'bfast' } as const;
    expect(digest(entry)).toBe(digest(entry));
    expect(await digest(entry)).toBe(await sha256Hex(ALPHA));
  });

  it('does not cache a failed read', async () => {
    const digest = createIntegrityCache();
    const missing = { name: 'gone.bfast', path: join(models, 'gone.bfast'), bytes: 1, format: 'bfast' } as const;
    await expect(digest(missing)).rejects.toThrow();
    await expect(digest(missing)).rejects.toThrow();
  });
});

describe('fixture server refusals', () => {
  const cases = [
    ['an unknown fixture', '/fixtures/nothing.bfast', 404],
    ['an unserved extension', '/fixtures/notes.txt', 404],
    ['the fixture prefix alone', '/fixtures/', 404],
    ['an unknown route', '/models/alpha.bfast', 404],
    ['a traversal to a sibling directory', '/fixtures/../secret.txt', 404],
    ['an encoded traversal', '/fixtures/..%2F..%2Fsecret.txt', 404],
    ['an absolute local path', '/fixtures/C:/Windows/win.ini', 404],
  ] as const;

  for (const [description, path, status] of cases)
    it(`refuses ${description}`, async () => {
      const response = await fetch(url(path));
      expect(response.status).toBe(status);
      expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
      const parsed = await body(response);
      expect(typeof parsed === 'object' && parsed !== null && 'reason' in parsed).toBe(true);
    });

  it('refuses a method other than GET or HEAD', async () => {
    const response = await fetch(url('/fixtures/alpha.bfast'), { method: 'POST' });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD');
    expect(await body(response)).toEqual({ error: 'method_not_allowed', reason: 'Only GET and HEAD are served.' });
  });

  it('never serves a file from outside the configured directories', async () => {
    const response = await fetch(url('/fixtures/secret.txt'));
    expect(response.status).toBe(404);
  });
});

describe('fixture server lifetime', () => {
  it('binds a free port and releases it on close', async () => {
    const first = await createFixtureServer({ dirs: [models] });
    const port = first.port;
    expect(port).toBeGreaterThan(0);
    await first.close();
    const second = await createFixtureServer({ dirs: [models], port });
    expect(second.port).toBe(port);
    await second.close();
  });

  it('closing twice is harmless', async () => {
    const started = await createFixtureServer({ dirs: [models] });
    await started.close();
    await started.close();
  });
});
