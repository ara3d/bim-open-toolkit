// Status lines, headers and JSON bodies for each plan. Pure, and free of Node imports so it can be
// reused by any transport.

import { listFixtures, type FixtureCatalog, type FixtureEntry } from './catalog.js';
import type { ErrorPlan } from './plan.js';
import type { ByteRange } from './range.js';

// Response headers as sent, with lower-case names.
export type HeaderMap = Readonly<Record<string, string>>;

// A planned response line: the status and the headers that go with it.
export type ResponseHead = { readonly status: number; readonly headers: HeaderMap };

// Both served formats are binary containers with no registered media type.
const OCTET_STREAM = 'application/octet-stream';
const JSON_TYPE = 'application/json; charset=utf-8';

// A fixture file does not change under its name while the server runs, so a browser may reuse it.
const FIXTURE_CACHE = 'private, max-age=3600';

// Listings and integrity records are cheap and must never be stale.
const METADATA_CACHE = 'no-store';

const byteLength = (body: string): number => new TextEncoder().encode(body).length;

// Status and headers for a JSON body.
export const jsonHead = (status: number, body: string): ResponseHead => ({
  status,
  headers: {
    'content-type': JSON_TYPE,
    'content-length': String(byteLength(body)),
    'cache-control': METADATA_CACHE,
  },
});

// Status and headers for fixture bytes: 200 for the whole file, 206 for one range.
export const bytesHead = (entry: FixtureEntry, range: ByteRange | null): ResponseHead =>
  range === null
    ? {
        status: 200,
        headers: {
          'content-type': OCTET_STREAM,
          'content-length': String(entry.bytes),
          'accept-ranges': 'bytes',
          'cache-control': FIXTURE_CACHE,
        },
      }
    : {
        status: 206,
        headers: {
          'content-type': OCTET_STREAM,
          'content-length': String(range.end - range.start + 1),
          'accept-ranges': 'bytes',
          'cache-control': FIXTURE_CACHE,
          'content-range': `bytes ${range.start}-${range.end}/${entry.bytes}`,
        },
      };

// Status and headers for a refusal, including the extra header its status requires.
export const errorHead = (plan: ErrorPlan, body: string): ResponseHead => {
  const head = jsonHead(plan.status, body);
  if (plan.status === 405) return { status: plan.status, headers: { ...head.headers, allow: 'GET, HEAD' } };
  if (plan.totalBytes === null) return head;
  return { status: plan.status, headers: { ...head.headers, 'content-range': `bytes */${plan.totalBytes}` } };
};

// Body of GET /health.
export const healthBody = (catalog: FixtureCatalog): string => JSON.stringify({ status: 'ok', fixtures: catalog.size });

// Body of GET /fixtures. Local paths are deliberately not reported.
export const listBody = (catalog: FixtureCatalog): string =>
  JSON.stringify({
    fixtures: listFixtures(catalog).map((entry) => ({ name: entry.name, bytes: entry.bytes, format: entry.format })),
  });

// Body of GET /fixtures/<name>.json.
export const infoBody = (entry: FixtureEntry, sha256: string): string =>
  JSON.stringify({ name: entry.name, bytes: entry.bytes, format: entry.format, sha256 });

// Body of any refusal.
export const errorBody = (error: string, reason: string): string => JSON.stringify({ error, reason });
