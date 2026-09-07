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
- Lint covers `packages/*/{src,test}` minus the four alpha packages. The first lint run over the skeletons took 63 s, the second 22 s; watch this as packages grow.
- Performance tests are explicit: `*.perf.ts` under `test/perf`, run with `npm run perf -w @bim-open-toolkit/testing`; never part of `npm test`.
- Wrapper scripts use `.mts` because the repository root has no `package.json` and tsx would otherwise load them as CommonJS.
- Commit turns: subagents launched through the Agent tool cannot exchange messages with the supervisor mid-run, so each track holds a standing commit grant limited to its own fence: stage and commit by explicit pathspec only, retry on `index.lock`, never push. This deviates from the one-holder rule in the parallel-wave skill; fences are disjoint and the supervisor reviews every chunk commit at integration.

### Tracks

| Track | Model | Fence | State | Checkpoint |
|---|---|---|---|---|
| M model contracts | Opus | `viewer/packages/model/**` | not started | `viewer/packages/model/docs/CHECKPOINT-M.md` |
| S synthetic generators | Opus | `viewer/packages/synthetic/**` | not started | `viewer/packages/synthetic/docs/CHECKPOINT-S.md` |
| PERF instance-update study (user request 2026-09-07) | Opus | `viewer/packages/testing/{src/perf,test/perf,docs}/**` | working | `viewer/packages/testing/docs/CHECKPOINT-perf.md` |

### BFAST versus BOS loading (user request 2026-09-07)

Method: the alpha `loadBosModel` (parse, group conversion, normalized bindings; file read excluded) on Snowdon in fresh Node 22.13.1 processes, five alternating runs per format, Windows, 64 GB. BOS is the original 9,362,255-byte file; `snowdon-bim.bfast` (111,630,208 bytes) is the loader session's conversion that keeps the Parquet tables; `snowdon.bfast` (101,607,040 bytes) is the geometry-only conversion. All three produce 456,598 bindings.

| Format | Load ms, five runs | Median | Objects |
|---|---|---:|---:|
| BOS | 3808, 3797, 4009, 3771, 3690 | 3797 | 51,139 |
| BFAST with tables | 2153, 2212, 1955, 1612, 1981 | 1981 | 51,139 |
| BFAST geometry only | 1890, 1910, 1966, 1492, 1650 | 1890 | 25,675 |

Result: 1.9× (with tables) to 2.0× (geometry only) faster end to end on the CPU. The loader session measured 3.5× on parse plus conversion alone; the difference is the alpha's normalized-binding step, which costs the same for both formats and which V2 removes. The BFAST file is 11 to 12 times larger, so over a network the gain depends on transfer; not measured. Proposed decision, awaiting the user: BFAST becomes the default prepared format for local fixtures and the fixture server in V2, BOS stays the source and interchange format, and Track F measures both again on the columnar path.

### Queue

- Tooling review at wave end per [TOOLING-LEDGER.md](TOOLING-LEDGER.md).
- Wave 1 briefs once revision M1 is reviewed.

### Findings

- platonic-ts: the check gate's ratchet step shells out to a platonic-ts-only command, so the wrapper reuses its pure scanner instead. Its scan globs are fixed to `packages/*/src`, so alpha edits by other sessions move the counts; a regression caused by alpha edits is re-baselined by the supervisor and noted here. Upstream items: `--repo <dir>` for the entry points, configurable scan globs.
