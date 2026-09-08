// Request planning: decides what a request should get without touching the file system. Pure.

import { isSafeFixtureName, type FixtureCatalog, type FixtureEntry } from './catalog.js';
import { parseByteRange, type ByteRange } from './range.js';

// The parts of an HTTP request the planner reads.
export type FixtureRequest = {
  readonly method: string;
  readonly target: string;
  readonly rangeHeader: string | null;
};

// The decision for one request. `error` carries `totalBytes` only for 416, where the response must
// report the file size.
export type RequestPlan =
  | { readonly kind: 'health' }
  | { readonly kind: 'list' }
  | { readonly kind: 'info'; readonly entry: FixtureEntry }
  | { readonly kind: 'bytes'; readonly entry: FixtureEntry; readonly range: ByteRange | null }
  | {
      readonly kind: 'error';
      readonly status: number;
      readonly error: string;
      readonly reason: string;
      readonly totalBytes: number | null;
    };

// The failing variant of a plan, so the response layer can build its headers from one value.
export type ErrorPlan = Extract<RequestPlan, { kind: 'error' }>;

// Only used to give a relative request target an origin; never contacted.
const BASE = 'http://fixture.invalid';

const HEALTH_PATH = '/health';
const LIST_PATH = '/fixtures';
const FIXTURE_PREFIX = '/fixtures/';
const INFO_SUFFIX = '.json';

// The normalized path of a request target, or null when it is not a URL. The path is never
// percent-decoded: a fixture is reachable only when its name is spelled exactly as catalogued, so
// no encoding trick and no dot segment can name a file outside the catalog.
export const requestPath = (target: string): string | null =>
  URL.canParse(target, BASE) ? new URL(target, BASE).pathname : null;

const failure = (status: number, error: string, reason: string): RequestPlan => ({
  kind: 'error',
  status,
  error,
  reason,
  totalBytes: null,
});

// A name that passes the safety rule is echoed so a typo is obvious; anything else is not reflected.
const unknownReason = (name: string): string =>
  isSafeFixtureName(name) ? `No fixture named ${name} is catalogued.` : 'No such fixture. List them with GET /fixtures.';

// Plans one request against a catalog.
export const planRequest = (catalog: FixtureCatalog, request: FixtureRequest): RequestPlan => {
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return failure(405, 'method_not_allowed', 'Only GET and HEAD are served.');
  const path = requestPath(request.target);
  if (path === null) return failure(400, 'bad_target', 'The request target is not a valid URL path.');
  if (path === HEALTH_PATH) return { kind: 'health' };
  if (path === LIST_PATH) return { kind: 'list' };
  if (!path.startsWith(FIXTURE_PREFIX))
    return failure(404, 'unknown_route', 'Serves GET /health, /fixtures, /fixtures/<name> and /fixtures/<name>.json.');
  const rest = path.slice(FIXTURE_PREFIX.length);
  const wantsInfo = rest.endsWith(INFO_SUFFIX);
  const name = wantsInfo ? rest.slice(0, rest.length - INFO_SUFFIX.length) : rest;
  const entry = catalog.get(name);
  if (entry === undefined) return failure(404, 'unknown_fixture', unknownReason(name));
  if (wantsInfo) return { kind: 'info', entry };
  const outcome = parseByteRange(request.rangeHeader, entry.bytes);
  if (outcome.kind === 'unsatisfiable')
    return {
      kind: 'error',
      status: 416,
      error: 'range_not_satisfiable',
      reason: 'The requested range lies outside the fixture.',
      totalBytes: entry.bytes,
    };
  return { kind: 'bytes', entry, range: outcome.kind === 'partial' ? outcome.range : null };
};
