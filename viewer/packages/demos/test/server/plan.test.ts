import { describe, expect, it } from 'vitest';
import { createCatalog } from '../../src/server/catalog.js';
import { planRequest, requestPath, type FixtureRequest, type RequestPlan } from '../../src/server/plan.js';

const catalog = createCatalog([
  { name: 'small.bfast', path: '/models/small.bfast', bytes: 100 },
  { name: 'small.bos', path: '/models/small.bos', bytes: 50 },
]);

const get = (target: string, rangeHeader: string | null = null): RequestPlan =>
  planRequest(catalog, { method: 'GET', target, rangeHeader });

const request = (method: string, target: string): FixtureRequest => ({ method, target, rangeHeader: null });

describe('requestPath', () => {
  it('normalizes dot segments and backslashes away from the fixture prefix', () => {
    expect(requestPath('/fixtures/../secret.txt')).toBe('/secret.txt');
    expect(requestPath('/fixtures/..%2Fsecret.txt')).toBe('/fixtures/..%2Fsecret.txt');
    expect(requestPath('/fixtures\\..\\secret.txt')).toBe('/secret.txt');
  });

  it('keeps the query out of the path', () => {
    expect(requestPath('/fixtures/small.bfast?v=1')).toBe('/fixtures/small.bfast');
  });
});

describe('planRequest routing', () => {
  it('plans health and the listing', () => {
    expect(get('/health')).toEqual({ kind: 'health' });
    expect(get('/fixtures')).toEqual({ kind: 'list' });
  });

  it('plans fixture bytes', () => {
    expect(get('/fixtures/small.bfast')).toEqual({
      kind: 'bytes',
      entry: { name: 'small.bfast', path: '/models/small.bfast', bytes: 100, format: 'bfast' },
      range: null,
    });
  });

  it('plans the integrity record', () => {
    const plan = get('/fixtures/small.bos.json');
    expect(plan.kind).toBe('info');
  });

  it('carries a byte range into the plan', () => {
    const plan = get('/fixtures/small.bfast', 'bytes=0-9');
    expect(plan).toEqual({
      kind: 'bytes',
      entry: { name: 'small.bfast', path: '/models/small.bfast', bytes: 100, format: 'bfast' },
      range: { start: 0, end: 9 },
    });
  });

  it('refuses an unsatisfiable range with the file size', () => {
    expect(get('/fixtures/small.bfast', 'bytes=500-')).toEqual({
      kind: 'error',
      status: 416,
      error: 'range_not_satisfiable',
      reason: 'The requested range lies outside the fixture.',
      totalBytes: 100,
    });
  });
});

describe('planRequest refusals', () => {
  const status = (plan: RequestPlan): number | null => (plan.kind === 'error' ? plan.status : null);

  it('refuses methods other than GET and HEAD', () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS', ''])
      expect(status(planRequest(catalog, request(method, '/fixtures'))), method).toBe(405);
    expect(planRequest(catalog, request('HEAD', '/health'))).toEqual({ kind: 'health' });
  });

  it('refuses anything that is not a catalogued name', () => {
    for (const target of [
      '/fixtures/missing.bfast',
      '/fixtures/small.txt',
      '/fixtures/small.bfast.gz',
      '/fixtures/',
      '/fixtures/SMALL.BFAST',
      '/fixtures/small.bfast/extra',
      '/other',
      '/',
    ])
      expect(status(get(target)), target).toBe(404);
  });

  it('refuses traversal attempts, however they are spelled', () => {
    for (const target of [
      '/fixtures/../../../../etc/passwd',
      '/fixtures/..%2F..%2Fsecret.txt',
      '/fixtures/%2e%2e/secret.txt',
      '/fixtures/..\\..\\secret.txt',
      '/fixtures//etc/passwd',
      '/fixtures/C:/Windows/win.ini',
      '/fixtures/small.bfast%00.txt',
    ])
      expect(status(get(target)), target).toBe(404);
  });

  it('does not reflect an unsafe requested name back to the caller', () => {
    const plan = get('/fixtures/%3Cscript%3E');
    expect(plan.kind === 'error' ? plan.reason : '').toBe('No such fixture. List them with GET /fixtures.');
  });

  it('names a safe but unknown fixture so a typo is visible', () => {
    const plan = get('/fixtures/snowdon.bfast');
    expect(plan.kind === 'error' ? plan.reason : '').toBe('No fixture named snowdon.bfast is catalogued.');
  });
});
