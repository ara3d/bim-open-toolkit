# V2 fixture server

A small HTTP service that serves local model files to the V2 demos and browser specs. It uses only
`node:http`, `node:fs`, `node:path` and `node:crypto`; it adds no dependency.

It is the one place private models such as Snowdon are exposed to a browser, so it never copies a
model into the repository and never serves a file it did not catalogue at start.

## Running it

```
cd viewer
node <tsx-cli> packages/demos/src/server/main.ts
```

`<tsx-cli>` is any TypeScript runner. This repository already uses
`../platonic-ts/node_modules/tsx/dist/cli.mjs` for its `tools/*.mts` wrappers, so:

```
node ../platonic-ts/node_modules/tsx/dist/cli.mjs packages/demos/src/server/main.ts
```

A package script has been requested from the supervisor (see `CHECKPOINT-D0.md`); until it exists,
use the command above.

`main.ts` prints one JSON line with the URL, the port and the directories it is serving, then waits.

### Environment

| Variable | Default | Meaning |
|---|---|---|
| `V2_FIXTURES_DIRS` | the two directories below | semicolon-separated list of directories to serve |
| `V2_FIXTURES_HOST` | `127.0.0.1` | interface to bind |
| `V2_FIXTURES_PORT` | `5175` | port to bind; `0` picks any free port |

Default directories:

- `C:/Users/cdigg/git/bim-open-toolkit/viewer/packages/visualization/artifacts/bfast`
- `C:/Users/cdigg/git/bim-open-toolkit/viewer/artifacts`

They are absolute and machine-specific on purpose: the private models already live there and are not
copied anywhere else. A directory that does not exist contributes nothing, so the server starts on a
machine that has neither.

`main.ts` is the only file that reads environment variables. Everything else takes its configuration
as arguments.

### From a test or a script

```ts
import { createFixtureServer } from '../src/server/index.js';

const server = await createFixtureServer({ dirs: [modelsDir] }); // 127.0.0.1, any free port
// server.url, server.port
await server.close();
```

`createFixtureServer` returns a promise because the bound port is only known after listening.
Defaults are `127.0.0.1` and port `0`, so concurrent tests never collide. `close()` drops
keep-alive connections as well as the listener, so the port is free as soon as it resolves, and
closing an already-closed server does nothing.

## Endpoints

| Request | Response |
|---|---|
| `GET /health` | `200` `{"status":"ok","fixtures":<count>}` |
| `GET /fixtures` | `200` `{"fixtures":[{"name","bytes","format"}, ...]}`, ordered by name |
| `GET /fixtures/<name>` | `200` the bytes, or `206` for a byte range |
| `GET /fixtures/<name>.json` | `200` `{"name","bytes","format","sha256"}` |

`format` is `bfast` or `bos`. `HEAD` is answered for all of them with the same headers and no body.

Bytes are served as `application/octet-stream` with `Content-Length`, `Accept-Ranges: bytes` and
`Cache-Control: private, max-age=3600`, so a browser reuses a large model instead of refetching it.
Listings and integrity records are `application/json; charset=utf-8` with `Cache-Control: no-store`.

### Byte ranges

One range per request: `bytes=10-19`, `bytes=90-`, `bytes=-4`. A satisfiable range gets `206` with
`Content-Range: bytes <start>-<end>/<size>`. A range that starts past the end, or a zero-length
suffix, gets `416` with `Content-Range: bytes */<size>`. A header that cannot be understood, and a
header naming several ranges, is ignored and the whole file is served; RFC 9110 permits this.

### Integrity

`/fixtures/<name>.json` reports the SHA-256 of the file, streamed in chunks so a large model is never
held in memory, computed at most once per file per server and cached for the life of the process.
Concurrent requests share one read. A read that fails is not cached.

Verified against the real Snowdon file: `snowdon-bim.bfast`, 111,630,208 bytes, SHA-256
`313c247e01a9aeee10d373b8d8ddfb9c13fc5ebb709945e75defcd763f33465b`, which matches the value
independently recorded in `viewer/packages/visualization/docs/bfast-loading.md`.

### Errors

Every refusal is JSON: `{"error": "<code>", "reason": "<sentence>"}` with the matching status.

| Status | Code | When |
|---|---|---|
| `400` | `bad_target` | the request target is not a URL path |
| `404` | `unknown_route` | a path other than the four above |
| `404` | `unknown_fixture` | a name that is not catalogued |
| `404` | `fixture_unreadable` | the file disappeared between the scan and the request |
| `405` | `method_not_allowed` | anything but `GET` or `HEAD`; carries `Allow: GET, HEAD` |
| `416` | `range_not_satisfiable` | the range lies outside the file |

A missing file is a `404`, not a crash.

## Safety rules

1. **A request can only name a catalogued name.** The catalog is a map from plain file name to local
   path, built once at start. The request path must equal `/fixtures/<name>` or
   `/fixtures/<name>.json` for a name that is a key of that map. There is no path joining anywhere on
   the request path.
2. **Nothing is percent-decoded.** A name matches only when it is spelled exactly as catalogued, so
   `%2e%2e`, `%2f` and `%00` simply fail to match. The WHATWG URL parser also normalizes `..`
   segments and backslashes away before the prefix is even checked.
3. **Names are restricted.** A catalogued name must match `^[A-Za-z0-9][A-Za-z0-9._-]*$`, contain no
   `..`, be at most 200 characters, and end in `.bfast` or `.bos`. Separators, drive letters, dot
   segments, whitespace and leading dots are all excluded.
4. **Only regular files are catalogued.** Symbolic links are not regular files, so a link inside a
   configured directory cannot be used to reach outside it.
5. **Nothing else is disclosed.** The listing reports names, sizes and formats, never local paths. An
   unknown name is echoed back only when it passes the name rule, so arbitrary request text is never
   reflected.
6. **No model is copied into the repository.** The server reads the configured directories in place.

## What is not here

- **No compression.** Network transfer of the larger BFAST file is a separate, later task (see the
  2026-09-07 decision record: BFAST is the default format and transfer is optimized later). Nothing
  in this server negotiates or applies `Content-Encoding`.
- **No ETag or conditional requests.** `If-None-Match` and `If-Modified-Since` are ignored, so a
  revalidation returns the whole file. `Cache-Control` covers the demo use.
- **No `If-Range`.** A range request is served from the current file regardless.
- **No multi-range responses.** `multipart/byteranges` is not produced.
- **No file watching.** The catalog is a snapshot taken before the server listens. A file added,
  removed or resized afterwards is picked up only on restart.
- **No write endpoints, no upload, no directory listing of the file system.**
- **Loopback only by default.** Binding another interface is possible through `V2_FIXTURES_HOST`,
  but there is no authentication, so do not.

## Layout

Request planning is separated from IO. The pure modules import nothing from Node and can be tested
without a socket or a temporary directory.

| File | Pure? | Owns |
|---|---|---|
| `src/server/catalog.ts` | yes | name safety, format detection, catalog construction and listing |
| `src/server/range.ts` | yes | `Range` header parsing |
| `src/server/plan.ts` | yes | routing one request to a `RequestPlan` |
| `src/server/respond.ts` | yes | statuses, headers and JSON bodies |
| `src/server/config.ts` | yes | default directories, `V2_FIXTURES_DIRS` and port parsing |
| `src/server/scan.ts` | no | reading directories into a catalog |
| `src/server/integrity.ts` | no | cached SHA-256 |
| `src/server/server.ts` | no | the HTTP service and its lifetime |
| `src/server/main.ts` | no | the only reader of environment variables |
| `src/server/index.ts` | — | the public surface |

Tests live in `test/server/`, run on port 0 against a temporary directory of small generated files,
and never touch Snowdon.
