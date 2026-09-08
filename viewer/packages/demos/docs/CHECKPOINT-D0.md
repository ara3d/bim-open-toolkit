# Checkpoint D0 — V2 fixture server

Track D0, wave 0. Contract revision: none consumed; this track imports nothing from `model`.

**State: implemented and locally verified, with one blocker outside the fence.**

Every behavior in the brief is delivered, tested and smoke-tested against the real Snowdon file.
The package typecheck does not pass because `@types/node` is not installed in the workspace. With
node types supplied from a scratch config, the same sources typecheck clean. See **Blocker**.

## Blocker (needs the supervisor)

`viewer/package.json` has no `@types/node`, and no copy exists anywhere under
`viewer/node_modules`. A server cannot be written without `node:http`, so
`npx tsc --noEmit -p packages/demos/tsconfig.json` reports 22 errors, all of the form
`Cannot find module 'node:http'`, `Cannot find name 'process'`, and the implicit-`any` parameters
that follow from them.

`viewer/tsconfig.json` includes `packages/demos/src` and `packages/demos/test`, so this also breaks
the workspace-wide `npm run typecheck` and `tools/platonic-check.mts` until it is fixed. Per-package
typechecks of other tracks are unaffected: they override `include`. Nothing else in the wave depends
on these files.

**Requested fix (one line plus an install, supervisor-owned):** add `"@types/node": "^22.20.0"` to
`viewer/package.json` `devDependencies` and run `npm install` in `viewer/`. Version 22.20.1 is what
the sibling `../platonic-ts` checkout uses and is what this track verified against; Node here is
22.13.1.

**Proof the code is otherwise clean:** the same two directories typecheck with zero errors under a
scratch config that is `viewer/tsconfig.json` plus
`typeRoots: ["C:/Users/cdigg/git/platonic-ts/node_modules/@types"]` and `types: ["node"]`. That
config lives in the session scratchpad; no repository file was changed to obtain it.

This was raised as a stop-and-reassess condition (work needing edits outside the fence). The work
was carried to completion rather than halted, because the missing dependency changes nothing about
the design, the tests run and pass without it, and the alternative — leaving unwritten or
uncommitted files — has exactly the same effect on the shared typecheck.

## Requests to the supervisor

1. **`@types/node` in `viewer/package.json`** — the blocker above. Everything else waits on it.
2. **A package script** in `viewer/packages/demos/package.json`:
   `"serve:fixtures": "node ../../../platonic-ts/node_modules/tsx/dist/cli.mjs src/server/main.ts"`,
   or a workspace-level `"fixtures"` script in `viewer/package.json`. The path is the same tsx the
   repository already uses for `tools/*.mts`. Until then the command in `docs/fixture-server.md`
   works as written. If `tsx` is added to `viewer` devDependencies, the script becomes
   `tsx src/server/main.ts`.
3. **Port 5175** was used for the manual smoke and released. No process is left running.
4. If the fixture server should also be reachable as `@bim-open-toolkit/demos`, `src/index.ts`
   (supervisor-owned) needs `export * from './server/index.js';`. Not required by this brief.

## Files

Written (all inside the fence):

| File | Pure? | Owns |
|---|---|---|
| `src/server/catalog.ts` | yes | name safety rule, format detection, catalog construction, listing |
| `src/server/range.ts` | yes | `Range` header parsing (RFC 9110) |
| `src/server/plan.ts` | yes | routing one request to a `RequestPlan`; the safe path rule |
| `src/server/respond.ts` | yes | statuses, headers and JSON bodies |
| `src/server/config.ts` | yes | default directories, `V2_FIXTURES_DIRS` and port parsing |
| `src/server/scan.ts` | no | reading directories into a catalog |
| `src/server/integrity.ts` | no | streamed SHA-256 with a per-path cache |
| `src/server/server.ts` | no | the HTTP service and its lifetime |
| `src/server/main.ts` | no | the only reader of environment variables |
| `src/server/index.ts` | — | public surface |
| `test/server/{catalog,range,plan,config,server}.test.ts` | — | 61 tests |
| `docs/fixture-server.md` | — | how to run, endpoints, safety rules, what is not there |
| `docs/CHECKPOINT-D0.md` | — | this file |

Nothing outside the fence was written. `src/index.ts`, `package.json`, `tsconfig*.json` and
`vitest.config.ts` are untouched.

## Delivered behavior

- **Catalog.** Built once, before listening, from the directories in `V2_FIXTURES_DIRS`
  (semicolon-separated) or the two defaults. Lists `.bfast` and `.bos` regular files by name only.
  The first directory holding a name wins it. A directory that does not exist contributes nothing.
- **`GET /health`** — `{"status":"ok","fixtures":<count>}`.
- **`GET /fixtures`** — `{"fixtures":[{"name","bytes","format"}, ...]}`, ordered by name. Local paths
  are never disclosed.
- **`GET /fixtures/<name>`** — the bytes as `application/octet-stream` with `Content-Length`,
  `Accept-Ranges: bytes` and `Cache-Control: private, max-age=3600`. One byte range per request
  (`bytes=a-b`, `bytes=a-`, `bytes=-n`) answered `206` with `Content-Range`; a range past the end
  answered `416` with `Content-Range: bytes */<size>`; an unreadable or multi-range header ignored
  and the whole file served, which RFC 9110 permits.
- **`GET /fixtures/<name>.json`** — `{"name","bytes","format","sha256"}`. The digest is streamed in
  chunks, computed at most once per file per process, shared by concurrent callers, and not cached
  when the read fails.
- **`HEAD`** on all four, same headers, no body.
- **Refusals are JSON** `{"error","reason"}`: `400 bad_target`, `404 unknown_route`,
  `404 unknown_fixture`, `404 fixture_unreadable`, `405 method_not_allowed` (with
  `Allow: GET, HEAD`), `416 range_not_satisfiable`. A file that disappeared between the scan and the
  request is a `404`, not a crash: headers are written when the read stream opens.
- **`createFixtureServer(options)`** returns `{url, port, close}` — a promise, because the bound port
  is only known after listening. Defaults `127.0.0.1` and port `0`. `close()` drops keep-alive
  connections as well as the listener, and closing twice is harmless.
- **No compression.** Noted in the README as a later, separate task.

### Safe path handling

A request can only name a key of the catalog. There is no path joining anywhere on the request path,
and the path is never percent-decoded, so `%2e%2e`, `%2f` and `%00` fail to match rather than
decoding into anything. The WHATWG URL parser normalizes `..` segments and backslashes away before
the `/fixtures/` prefix is even checked. A catalogued name must match
`^[A-Za-z0-9][A-Za-z0-9._-]*$`, contain no `..`, be at most 200 characters, and end in `.bfast` or
`.bos`. Only regular files are catalogued, so a symbolic link cannot reach outside a configured
directory. An unknown name is echoed in the reason only when it passes the name rule.

### Design notes

Request planning is separated from IO as the brief asks. `catalog`, `range`, `plan`, `respond` and
`config` import nothing from Node and hold every decision; `scan`, `integrity`, `server` and `main`
do the reading. `planRequest(catalog, request) -> RequestPlan` is a total function over a
discriminated union, so every route, refusal and range case is testable without a socket.

Zero escape hatches: no `any`, no `as` casts (three `as const`), no non-null `!`, no `@ts-` or
eslint-disable comments. Verified by grep over `src/server` and `test/server`; the only matches for
`any` and `as` are English words in comments.

One `// TODO:` is recorded, in `config.ts`: the default fixture directories are absolute and
machine-specific, and should be derived from a repository root once the demos package resolves one.
The brief specifies these paths, and a private model must not be copied into the repository, so this
is deliberate for now.

## Commands and actual results

Run from `viewer/` unless stated.

| Command | Result |
|---|---|
| `npm test -w @bim-open-toolkit/demos` | **pass** — 6 files, 61 tests, 672 ms (first run 1.49 s) |
| `npx eslint packages/demos` | **pass** — 17 files linted, 0 errors, 0 warnings, 4.4 s |
| `npx tsc --noEmit -p packages/demos/tsconfig.json` | **fail** — 22 errors, all from the missing `@types/node` (see Blocker), 4.6 s |
| `npx tsc --noEmit -p <scratch>/tsconfig.demos-with-node.json` | **pass** — 0 errors, 3.2 s. Same sources, node types supplied from `../platonic-ts` |
| escape-hatch grep over `src/server` and `test/server` | **pass** — 0 `any`, 0 `as` casts, 0 `!`, 0 directives, 0 disables |

Tests per file: `catalog` 8, `range` 9, `config` 6, `plan` 12, `server` 25 — 60 new — plus the
pre-existing `test/index.test.ts` with 1. Sixty-one across six files. The 35 in `catalog`, `range`,
`config` and `plan` need no socket, no temporary directory and no timing.

### Manual smoke against the real directory

Started `node ../platonic-ts/node_modules/tsx/dist/cli.mjs packages/demos/src/server/main.ts` from
`viewer/` with no environment overrides. Startup line:

```
{"url":"http://127.0.0.1:5175","port":5175,"dirs":["C:/Users/cdigg/git/bim-open-toolkit/viewer/packages/visualization/artifacts/bfast","C:/Users/cdigg/git/bim-open-toolkit/viewer/artifacts"]}
```

`viewer/artifacts` does not exist on this machine; it contributed nothing and did not stop startup.

```
GET /health   -> 200 {"status":"ok","fixtures":2}

GET /fixtures -> 200
{"fixtures":[{"name":"snowdon-bim.bfast","bytes":111630208,"format":"bfast"},
             {"name":"snowdon.bfast","bytes":101607040,"format":"bfast"}]}

GET /fixtures/snowdon-bim.bfast.json -> 200
{"name":"snowdon-bim.bfast","bytes":111630208,"format":"bfast",
 "sha256":"313c247e01a9aeee10d373b8d8ddfb9c13fc5ebb709945e75defcd763f33465b"}

GET /fixtures/snowdon-bim.bfast   Range: bytes=0-31   -> 206
  content-range: bytes 0-31/111630208   content-length: 32
  accept-ranges: bytes   cache-control: private, max-age=3600
  content-type: application/octet-stream

GET /fixtures/snowdon-bim.bfast (whole file) -> 200
  content-length: 111630208, received 111630208 bytes in 369 ms over loopback
  sha256 of the received bytes = 313c247e01a9aeee10d373b8d8ddfb9c13fc5ebb709945e75defcd763f33465b

HEAD /fixtures/snowdon-bim.bfast -> 200, content-length 111630208, 0 bytes of body

GET /fixtures/nope.bfast -> 404
  {"error":"unknown_fixture","reason":"No fixture named nope.bfast is catalogued."}

GET /fixtures/../../secret.txt -> 404
  {"error":"unknown_route","reason":"Serves GET /health, /fixtures, /fixtures/<name> and /fixtures/<name>.json."}
```

`bytes` is 111,630,208 as the brief expects, and the SHA-256 matches the value independently
recorded for that file in `viewer/packages/visualization/docs/bfast-loading.md`, so the served bytes
are the original model.

The 369 ms loopback download is not a network-transfer measurement and is not offered as one.

## Running processes

**None.** The smoke server (Windows PID 39932, child 39016) was terminated with `taskkill /F`;
`netstat` then showed nothing listening on 5175 and `tasklist` showed the PID gone. No background
command from this track is running.

## Chunk commits

| Chunk | Commit | Contents |
|---|---|---|
| 1 | `84a43ef` | `src/server/**`, `test/server/**`, `docs/fixture-server.md` |
| 2 | this file | `docs/CHECKPOINT-D0.md` |

Both staged by explicit pathspec. No `git add .`, no `-A`, no `commit -a`, no push. `git status`
showed uncommitted files from tracks M, PERF, I, BIND and W0 throughout; none were staged.

## Remaining work

- Re-run `npx tsc --noEmit -p packages/demos/tsconfig.json` and `npx eslint packages/demos` once
  `@types/node` lands. The lint pass above was obtained with the node imports unresolved, so their
  values were untyped; real types could surface `no-unsafe-*` findings that the current run could
  not see. The typecheck with node types was clean, so the risk is low, but the lint result is not
  final until then. **This is the one open verification limit.**
- The `SIGINT`/`SIGTERM` shutdown path in `main.ts` is not covered by a test and was not exercised:
  Windows has no real signal delivery for a non-console child, and the smoke server was stopped with
  `taskkill /F`. `close()` itself is covered by two tests.
- No browser has loaded from this server yet. That belongs to the gallery task, not this one.
- Compression, `ETag`/conditional requests, `If-Range`, multi-range responses and file watching are
  deliberately absent and listed in `docs/fixture-server.md`.
- The catalog is a snapshot taken before listening. A model added or replaced while the server runs
  needs a restart. If a demo ever needs live re-scanning, that is a new, small change to `scan.ts`
  and `server.ts`.

## Findings

- **`@types/node` is missing from the whole `viewer` workspace.** Any V2 track that writes a Node
  process — the fixture server, the MCP bridge in `packages/mcp`, the browser runner in
  `packages/testing`, any script under a package — hits this immediately. It is worth adding once,
  at the workspace level, rather than per track.
- **The alpha fixture endpoint is a different shape and should not be copied forward.**
  `packages/visualization/examples/vite.config.mjs` hardcodes two model paths from environment
  variables, exposes one fixed name each, and has no range support. The V2 server replaces the
  hardcoded name with a catalog, which is what lets a demo offer a model picker without a config
  edit. The alpha `Cache-Control: private, max-age=3600` was kept deliberately.
- **The 111 MB BFAST file is 369 ms over loopback.** Whatever the transfer optimization turns out to
  be, it will not be visible in local demo work; it needs a real network or a throttled one to
  measure. Worth remembering when that task is scheduled, so it is not "verified" on loopback.
- **`snowdon.bfast` (101,607,040 bytes, geometry only) and `snowdon-bim.bfast` (111,630,208 bytes,
  with the BOS Parquet tables) are both present** in the default directory and both catalogued. A
  demo that wants the source IDs and property tables must ask for `snowdon-bim.bfast` by name; the
  server does not choose.
- **No nested sub-agents were spawned.** The work was one coherent module and splitting it would
  have cost more coordination than it saved. Count: 0.

## Tooling

Scored per the brief, for the wave-end tooling review.

| Check | Runs | Wall time | Real defects caught | False positives / friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit -p packages/demos/tsconfig.json` | 4 | 3.2–4.6 s | 1 real (`Uint8Array<ArrayBufferLike>` not assignable to `BufferSource` in the test's SHA-256 helper — a genuine mistake vitest would never have caught, since esbuild strips types) plus the missing-`@types/node` discovery, which is a real environment defect | 21 of 22 errors were cascade noise from that one missing dependency; needed a scratch config to see past them | **helpful** |
| `eslint packages/demos` | 3 | 4.4 s | 0 | 0. Cheap at this size, but its type-aware rules were reading unresolved imports, so this run proves less than it looks like | **neutral so far** — re-judge once node types resolve |
| escape-hatch grep (`any`, `as`, `!`, `@ts-`, disables) | 1 | under 1 s | 0 | 5 false hits, all English words in comments (`any transport`, `as lower-case hex`) — a word-boundary grep cannot tell prose from code | **helpful, but the pattern needs to skip comments** |
| `vitest run` (`npm test -w @bim-open-toolkit/demos`) | 3 | 0.67–1.49 s | 0 after the first green run; the value was in writing the tests, which is where the range edge cases (`bytes=-0`, empty file, `bytes=19-10`) got settled | 0 | **helpful** — fast enough to run on every edit |
| Manual smoke against the real model | 1 | ~30 s including the 111 MB download | 0, and it confirmed the SHA-256 against an independently recorded value | 0. The one thing tests cannot do: prove the default directories and a 111 MB file work | **helpful, and not replaceable by a unit test** |

Notes for the ledger:

- The strict flags earned their keep quietly. `noUncheckedIndexedAccess` forced explicit handling of
  `RegExpExecArray` groups in `range.ts`, which is exactly where an off-by-one would hide.
- The no-`as` rule had one real cost and one real benefit. Cost: `server.address()` needed a
  `typeof address === 'string'` guard instead of a cast. Benefit: that guard is the code that turns
  a missing port into a thrown error rather than a wrong `url`.
- Writing the pure layer first made the whole track cheap to test: 35 of the 61 tests need no socket,
  no temporary directory and no timing, and the whole suite runs in under a second.
- The one genuine friction was the missing `@types/node`, and it is an environment gap rather than a
  tool being wrong.
