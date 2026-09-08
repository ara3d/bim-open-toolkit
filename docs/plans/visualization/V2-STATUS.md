# Visualization V2 status

Rolling status for [V2-PLAN.md](V2-PLAN.md). Decisions go to [README.md](README.md), not here.

## Wave 0: contracts and skeleton — in progress (started 2026-09-07)

Supervisor: this session. Concurrent sessions in the checkout at wave start: three other interactive sessions, one of them committing BFAST loader work in `viewer/packages/loaders` (commits `851a91e`, `274f925` and later). Alpha packages are read-only for V2 tracks; their built `dist` is what V2 resolves against.

### Landed

| Chunk | Commit | Verification |
|---|---|---|
| Pre-flight: MCP wrapper, plan sections, decision record | `a879b8b` | MCP smoke test over `viewer/`: 33 tools |
| Retrofit + tooling + 13 package skeletons | `5988f73` | see baseline below |

Baseline after the skeleton chunk, alpha built from HEAD: `npm test` per alpha package unchanged (core 77, controls 32, loaders 33, visualization 149 passed, 1 skipped); `demo:check` passes; `node ../platonic-ts/node_modules/tsx/dist/cli.mjs tools/platonic-check.mts` passes (typecheck, lint, ratchet, 13 V2 smoke tests). Ratchet baseline rewritten to current counts: 2 `any`, 145 `as`, 181 `!`, 0 directives, 0 lint disables, 137 undocumented exports (all in alpha packages).

Tooling decisions taken while landing the retrofit:
- Root `viewer/tsconfig.json` is the strict typecheck of every V2 package (`paths` map sibling `@bim-open-toolkit/*` imports to source). Per-package `tsconfig.json` extends it for editors and lint; `tsconfig.build.json` emits `dist` for publication and resolves siblings through `dist`, so `build:v2` must run in dependency order.
- V2 tests: per-package `vitest.config.ts` re-exports `viewer/vitest.shared.ts` (source aliases). The combined run is `npm run test:v2` with `viewer/vitest.v2.config.ts`; it is not named `vitest.config.ts` because vitest finds a root config from package directories and that hid the alpha tests.
- Lint covers `packages/*/{src,test}` minus the four alpha packages, with the untyped rule set since 2026-09-07 (2 to 4.5 s for every package). The type-aware set runs only as `npm run lint:typed` over demos, mcp and viewer at wave integration. Reasons and measurements: TOOLING-LEDGER.md review log. `@types/node` added to the workspace for the I/O packages.
- Performance tests are explicit: `*.perf.ts` under `test/perf`, run with `npm run perf -w @bim-open-toolkit/testing`; never part of `npm test`.
- Wrapper scripts use `.mts` because the repository root has no `package.json` and tsx would otherwise load them as CommonJS.
- Commit turns: subagents launched through the Agent tool cannot exchange messages with the supervisor mid-run, so each track holds a standing commit grant limited to its own fence: stage and commit by explicit pathspec only, retry on `index.lock`, never push. This deviates from the one-holder rule in the parallel-wave skill; fences are disjoint and the supervisor reviews every chunk commit at integration.

### Tracks

| Track | Model | Fence | State | Checkpoint |
|---|---|---|---|---|
| M model contracts | Opus | `viewer/packages/model/**` | verified and accepted as M1 (`641624b`): 19 modules, 198 tests, zero escape hatches; supervisor re-ran tsc, lint, tests; decision record in README.md | `viewer/packages/model/docs/CHECKPOINT-M.md` |
| S synthetic generators | Opus | `viewer/packages/synthetic/**` | verified: PRNG, primitives, building generator with gap-filled door and room schedules, stress generator; 78 tests; commits `7f896b2` `0bb504a` `a9c32ba` `de74166` `ac28ec0` `b634d14` `8a587af`; built against M1-stub `325e9d1`; supervisor re-ran tsc and tests clean; awaiting combined gate | `viewer/packages/synthetic/docs/CHECKPOINT-S.md` |
| PERF instance-update study (user request 2026-09-07) | Opus | `viewer/packages/testing/src/perf/**`, `test/perf/*.perf.ts`, its two docs | working | `viewer/packages/testing/docs/CHECKPOINT-perf.md` |
| BIND normalized-binding cost study (user request 2026-09-07) | Opus | `viewer/packages/testing/src/bindings/**`, `test/bindings/**`, `test/perf/bindings/**`, its two docs | working | `viewer/packages/testing/docs/CHECKPOINT-bind.md` |
| I interact (pulled forward from wave 1; decides wrap-or-replace of viewer-controls) | Opus | `viewer/packages/interact/**` | working | `viewer/packages/interact/docs/CHECKPOINT-I.md` |
| W0 hand-written expected tables for the ten workflows | Sonnet | `viewer/packages/workflows/test/expected/**`, `docs/**` | verified: ten `.md` plus `.json` pairs, all JSON parses, 23 exception rows across workflows; committed by the supervisor as `10dd88f`; eight open questions for Track W in its checkpoint (observation nesting versus `facts.ts`, two-revision identity, unified exception-row shape) | `viewer/packages/workflows/docs/CHECKPOINT-W0.md` |
| D0 BFAST fixture server (pulled forward from wave 2) | Opus | `viewer/packages/demos/src/server/**`, `test/server/**`, `docs/**` | verified: node:http server, catalog-only names, byte ranges, cached SHA-256, 62 tests; smoke on port 5175 served snowdon-bim.bfast (111 MB in 369 ms over loopback, hash matches bfast-loading.md); commits `84a43ef` `dd8f898` `5b671e8` `c137380`; supervisor re-ran tsc and tests, added `serve:fixtures` script | `viewer/packages/demos/docs/CHECKPOINT-D0.md` |

Parallelism (user request 2026-09-07 to get more subagents working at once): seven background subagents were accepted by the host at once, and all seven then stalled within a minute of the seventh launch (host watchdog: no progress for 600 s), after the first three had worked for 25 minutes; about two hours were lost before the stall was reported. Correction from the user afterwards: the stall coincided with a disconnection on the user's side, so the count was not the cause. M, S and PERF were relaunched as resumptions of their inspected files, then BIND, I, W0 and D0 were relaunched, back to seven concurrent. Ways used: tracks start against small structural stub types instead of waiting for revision M1 and switch to the model imports when the stub lands; one package is split into sub-fences by directory (three tracks inside `testing`); independent pieces of later waves are pulled forward when they need no unlanded contract (fixture server, expected-result tables); Sonnet takes work that needs only the brief. Track M's stub chunk is the main unblocker for everything else.

### BFAST versus BOS loading (user request 2026-09-07)

Method: the alpha `loadBosModel` (parse, group conversion, normalized bindings; file read excluded) on Snowdon in fresh Node 22.13.1 processes, five alternating runs per format, Windows, 64 GB. BOS is the original 9,362,255-byte file; `snowdon-bim.bfast` (111,630,208 bytes) is the loader session's conversion that keeps the Parquet tables; `snowdon.bfast` (101,607,040 bytes) is the geometry-only conversion. All three produce 456,598 bindings.

| Format | Load ms, five runs | Median | Objects |
|---|---|---:|---:|
| BOS | 3808, 3797, 4009, 3771, 3690 | 3797 | 51,139 |
| BFAST with tables | 2153, 2212, 1955, 1612, 1981 | 1981 | 51,139 |
| BFAST geometry only | 1890, 1910, 1966, 1492, 1650 | 1890 | 25,675 |

Result: 1.9× (with tables) to 2.0× (geometry only) faster end to end on the CPU. The loader session measured 3.5× on parse plus conversion alone; the difference is the alpha's normalized-binding step, which costs the same for both formats and which V2 removes. The BFAST file is 11 to 12 times larger, so over a network the gain depends on transfer; not measured. Decision (user, 2026-09-07): BFAST is the default model format across V2; network transfer is optimized later. Track F re-measures both on the columnar path. Recorded in README.md.

## Wave 1: independent foundations — started 2026-09-08

Ready condition met: M1 accepted at `641624b`. Launched F, R, S2 and W alongside the still-running wave 0 tracks PERF, BIND, I and D0. T (testing package) waits for PERF and BIND to leave that package. Perf configs added to formats and render (`npm run perf -w`).

| Track | Model | Fence | State | Checkpoint |
|---|---|---|---|---|
| F formats, BFAST first | Opus | `viewer/packages/formats/**` | working | `viewer/packages/formats/docs/CHECKPOINT-F.md` |
| R render, instance table | Opus | `viewer/packages/render/**` | working | `viewer/packages/render/docs/CHECKPOINT-R.md` |
| S2 remaining generators | Opus | `viewer/packages/synthetic/**` | working | `viewer/packages/synthetic/docs/CHECKPOINT-S2.md` |
| W workflow adapters | Opus | `viewer/packages/workflows/**` | working | `viewer/packages/workflows/docs/CHECKPOINT-W.md` |

### Requests between tracks

- S to M: export `Vec2 = readonly [number, number]` from model (S exports a local one from `src/triangulate.ts` meanwhile); consider making `Mesh.normals` required or providing a shaded-mesh type, since every consumer narrows it. For the M1 review.

### Queue

- Tooling review at wave end per [TOOLING-LEDGER.md](TOOLING-LEDGER.md).
- Wave 1 briefs once revision M1 is reviewed.

### Findings

- platonic-ts: the check gate's ratchet step shells out to a platonic-ts-only command, so the wrapper reuses its pure scanner instead. Its scan globs are fixed to `packages/*/src`, so alpha edits by other sessions move the counts; a regression caused by alpha edits is re-baselined by the supervisor and noted here. Upstream items: `--repo <dir>` for the entry points, configurable scan globs.
