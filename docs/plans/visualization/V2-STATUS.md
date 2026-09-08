# Visualization V2 status

Rolling status for [V2-PLAN.md](V2-PLAN.md). Decisions go to [README.md](README.md), not here. A new agent joining the wave starts at [JOIN-THE-WAVE.md](JOIN-THE-WAVE.md).

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
| PERF instance-update study (user request 2026-09-07) | Opus | `viewer/packages/testing/src/perf/**`, `test/perf/*.perf.ts`, its two docs | verified: six perf files, 14 benchmark tests stable over six runs after a protocol revision (interleaved rounds, 25 repetitions, assert on the fastest); findings in `viewer/packages/testing/docs/instance-updates.md` with fifteen ranked recommendations; headline: publishing changes costs more than writing them (version bump per touched group 3.5× the write, dirty ranges 20%), row order beats call overhead (sorted rows save 65%), wide columns must be copied with `set`, bounds are the expensive part of moves, binding objects at 500k cost 340 ms and 127 MB versus 30 ms and 4.3 MB for columns; commits `b08d6b4` `e91d856` `36d9f87` `9c071b2` `ac21641`; supervisor re-ran tsc and tests, added `--reporter=verbose` to the perf script | `viewer/packages/testing/docs/CHECKPOINT-perf.md` |
| BIND normalized-binding cost study (user request 2026-09-07) | Opus | `viewer/packages/testing/src/bindings/**`, `test/bindings/**`, `test/perf/bindings/**`, its two docs | verified: columnar binding with parity against the alpha on all 456,598 Snowdon instances; Snowdon medians parse 94 ms, entity table 14 ms, group conversion 574 ms, alpha binding 348 ms, columnar binding 75 ms (26 ms once duplicated validation and a material rebuild move to the converter); end to end 1687 ms alpha versus 896 ms columnar; 235 MB of objects versus 9.8 MB; commits `e936857` `3ccea84` `947f395` `c318094` `898e06b` `db96407`; supervisor re-ran tsc and tests, added the package's dependencies, `--expose-gc` in the perf config and the index export | `viewer/packages/testing/docs/CHECKPOINT-bind.md` |
| I interact (pulled forward from wave 1; decides wrap-or-replace of viewer-controls) | Opus | `viewer/packages/interact/**` | verified: replaces viewer-controls (decision record); camera math about a declared up axis, projections, fit-to-bounds, bindings, three pure mode reducers, interruptible flight, one DOM adapter; 202 tests; last commit `015e648`; supervisor re-ran tsc and tests and removed the unused dependency | `viewer/packages/interact/docs/CHECKPOINT-I.md` |
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

Ready condition met: M1 accepted at `641624b`. Launched F, R, S2 and W alongside the still-running wave 0 tracks PERF, BIND, I and D0. T (testing package) started once PERF and BIND finished. Perf configs added to formats and render (`npm run perf -w`).

| Track | Model | Fence | State | Checkpoint |
|---|---|---|---|---|
| F formats, BFAST first | Opus | `viewer/packages/formats/**` | verified: one `loadModel` entry returning `Result<LoadedModel>`, BFAST straight from the loaders' render tables to M1 `Geometry` with no grouping step, BOS through `bosToBfast`, pure glTF/OBJ/STL readers, detection, resolver, progress, diagnostics; 149 tests; Snowdon medians BFAST 353 to 455 ms and BOS 2082 to 2126 ms end to end (alpha: 1981 and 3797), 51,139 objects of which 28,976 geometry-free; a closure-allocating precondition helper cost 260 ms per load until inlined; commits `8c4f530` `4617096` `ebbfeaa` `36c441b` `5325138` `bf002e3` `df9b671`; supervisor re-ran tsc and tests | `viewer/packages/formats/docs/CHECKPOINT-F.md` |
| R render, instance table | Opus | `viewer/packages/render/**` | verified: instance table, bulk column updates with change detection and dirty ranges, picking, clipping, representations and replacement, overlays, environment, capture, timing, scene binding onto viewer-core; no three import in src, six adapter interfaces are the whole WebGL surface; 214 tests, 14 perf cases (10,000 of 456,598 rows: colour 3.39/2.11/0.45 ms scattered/sorted/contiguous; publishing 5.31 ms versus 3.66 ms writing); last commit `3d3e302`; supervisor re-ran tsc and tests | `viewer/packages/render/docs/CHECKPOINT-R.md` |
| T testing: fixtures, fake clock, headless scene, browser runner, benchmark protocol | Opus | `viewer/packages/testing/**` minus the PERF and BIND areas | verified: three deterministic fixtures with fingerprints (small building, ten-thousand objects, stress at 7.78 M triangles), fake clock, headless scene over viewer-core with a three mirror for rays, playwright-core runner (Edge and Chrome channels launch here; no bundled browser), benchmark protocol with camera paths, percentiles, budgets and reports naming device, browser and method; 133 tests; real browser run with a screenshot under `viewer/artifacts/testing`; commits `41c42ef` `65d38d7` `058603d` `5ccd617` `b22ab8b` `88c4793` `7ea9322`; supervisor exported the modules from the index, added the interact dependency and playwright-core as an optional peer, re-ran tsc and tests | `viewer/packages/testing/docs/CHECKPOINT-T.md` |
| F2 formats consumes M1.2 (mesh table from file buffers, hidden flag as `visible`) | Opus | `viewer/packages/formats/**` | working | `viewer/packages/formats/docs/CHECKPOINT-F2.md` |
| M3 model additions for formats and render (F requests) | Opus | `viewer/packages/model/**` | verified: optional `visible`, `roughness`, `metallic` columns (materials are model-level because BFAST carries them per placement), `MeshTable` with copy-free `meshAt`, `Geometry.meshTable?`, `representation` documented; additive, section M1.2; 239 tests; commits `45014e7` `ea3ddf2` `bc75733` `b57c237` `42e0af0`; supervisor re-ran model tests and the formats, render, interact, synthetic and testing typechecks |

Contract additions announced to running tracks (see R's process finding): M1.2 adds `visible`, `roughness`, `metallic` on `InstanceRecords` and the `visible`/`roughness`/`metallic` columns on `instanceTable`; `MeshTable`, `meshAt`, `meshCount`, `meshBoundsAt`; `isInstanceVisible`, `instanceRoughness`, `instanceMetallic`. R already honours `visible`. Formats should fill `MeshTable` from the file's own buffers (no `Mesh` objects) and `visible` from the BFAST hidden flag at its next chunk; both are follow-ups for a Track F2. `viewer/packages/model/docs/CHECKPOINT-M3.md` |
| M2 model bridges (review follow-up) | Opus | `viewer/packages/model/**` | verified: `instanceTable` (4.1 ms at 100k rows versus 15.5 ms per-row, shared index arrays, transposed in 512-row blocks), `rowsInSet`/`setOfRows`, `joinTablesOn` for string keys, typed column accessors, `tableFromRecord`, `Vec2` helpers, README fixed and its example tested; additive, contract stays M1 (section M1.1 in CONTRACTS-M1.md); 224 tests; commits `d1d3bb6` `b489031` `31ef243` `b6885cb` `d1645b8` `560c91d`; supervisor re-ran tsc and tests | `viewer/packages/model/docs/CHECKPOINT-M2.md` |
| E2E vertical slice (review follow-up) | Opus | `viewer/packages/demos/{src/slice,test/slice}/**`, `slice.html`, `vite.slice.config.mjs`, `docs/slice.md` | working | `viewer/packages/demos/docs/CHECKPOINT-E2E.md` |
| S2 remaining generators | Opus | `viewer/packages/synthetic/**` | verified: services, revisions, schedule, quantities, costs, carbon, assets, clearances, city, field, plus a fixture catalog and JSON snapshots for all twelve; 212 tests, every default fixture under 500 ms; W0 column convention chosen (`foo`, `fooUnit`, `fooState`, `fooMissingReason`, `fooConflict`, `fooEvidence`) with M1 vocabulary; last commit `c7efbd2`; supervisor re-ran tsc and tests | `viewer/packages/synthetic/docs/CHECKPOINT-S2.md` |
| W workflow adapters | Opus | `viewer/packages/workflows/**` | verified: ten pure adapters with M1 input schemas, a registry, one exception shape, recipes as command names, a second input for the door schedule from the building-workflow projection; tested exactly against W0's expected files and against S2's generated fixtures (coverage counts appear as exceptions); 121 tests; 22 commits ending `80e110b`; three Sonnet workers wrote six adapters, review found and fixed four honesty gaps in them; supervisor re-ran tsc and tests, added the synthetic dev dependency | `viewer/packages/workflows/docs/CHECKPOINT-W.md` |

### Independent review, 2026-09-08

[REVIEW-2026-09-08.md](REVIEW-2026-09-08.md) (fresh-eyes Opus, read-only, own numbers, composition probe). Verdict: real progress with waste. Evidence for progress: a throwaway script used `model` and `synthetic` together to list doors with fire-rating coverage, reconcile a conflict and colour unrated doors red, each in a few lines and as documented. Waste named: 156k tokens of workflow fixtures written before the facts contract existed; 1,736 lines of checkpoint and decision prose for one day of work on two packages. Gaps found by the probe: no bridge from instance records to `Table` without a per-row allocation; no bridge from `ObjectSet` to table rows; joins need integer keys on both sides so schedules keyed by string ids cannot join; no string column accessor; three README mismatches. Nothing user-visible yet.

Actions taken: Track M2 launched to add the bridges and fix the README (model fence was free). Track W's brief already allows it to correct the W0 fixtures against M1 and S2's generators; the review's first recommendation (regenerate them from `synthetic` and `facts.ts`) is recorded here for W's integration review. The second recommendation, one end-to-end slice (synthetic building drawn in a page with unrated doors red), is queued as Track E2E to start when Track R's instance-table chunk lands, because it needs that binding and would otherwise duplicate R.

### Next optimization target (from BIND)

Binding is no longer the cost. Of the 896 ms columnar path on Snowdon, `bfastToGroups` in the loaders package is 574 ms and allocates 316,110 small `Float32Array`s for 158,055 groups averaging under three instances each. Track F builds the BFAST path and should consider producing render groups straight from the `RenderModel` columns instead of through `bfastToGroups`, measured against the same benchmark. Requests to the loader session (read-only for V2): export `writeBFast` and `bytesOf` so downstream packages can build BFAST fixtures; emit opaque materials from the converters; let consumers trust `parseBfastModel`'s transform validation.

### Model contract requests from F (Track M3 launched)

Status: all four answered by M3 (M1.2). Remaining: Track F2 to consume them (fill `MeshTable` and `visible` from BFAST directly; 14,864 hidden placements and 171,569 mesh records are the numbers to beat).
1. A columnar mesh table beside `Geometry.meshes: readonly Mesh[]`: 171,569 mesh records on Snowdon cost about 850,000 allocations and 73 to 94 ms for what is three buffers.
2. A visibility column on `InstanceRecords`: 14,864 hidden placements in Snowdon are dropped today because a row without one would be drawn.
3. Per-instance material columns (roughness, metallic), or a decision that they belong to render.
4. Document or drop `ObjectRecord.representation` (one row, but objects have many placements).
Also to the loader session: export the `renderModel.ts` accessors and `writeBFast`; formats and BIND both re-implemented the byte layout.

Git incident (F, chunk 3): a `git commit --amend` without a pathspec re-committed the whole index and took four of S2's staged files into `ebbfeaa` (`synthetic/src/{city,field,index}.ts`, `test/city.test.ts`). Content intact, S2 committed on top; only attribution is wrong. History not rewritten. Rule: never amend in the shared checkout; write the message to a file before the first commit.

### Requests from R

- To the loader session (viewer-core, read-only for V2): `InstancedGroup.markColorsChanged(start, count)` and `markTransformsChanged(start, count)` so a bulk update can publish a range without a `setColors` self-copy (5.31 ms per 10,000-row update today); and a note that the `colors`/`transforms` getters allocate a view per call, which put garbage collection inside every per-row loop until the table captured the views once.
- To the model docs: `resolveStyles` omits keys equal to the fallback and deleted keys, so a binding iterating `byKey` never restores an object a rule stopped applying to; render addresses every row and relies on change detection.
- Process: an additive contract change that adds a name a downstream track already invented is not neutral (M2's `instance-table` columns versus R's own vocabulary; reconciled by R in `db9a63c`). Announce contract additions to running tracks through their checkpoints or the status file.

### Requests between tracks

- T to M: 3D cross product still missing from `model/math.ts` (third local copy, after interact's and bench's). Same request as I's.
- T finding: browser runs cost 4 s on a quiet machine and 147 s while five tracks compiled; wave 3 Track P must not share the machine with compiling tracks.
- W to M: `object()` and `tuple()` schemas return the value they were given, so a schema cannot convert what it accepts; request a `mapped` combinator, an `enumeration`, and a `CoordinateContext` schema (worked around locally in workflows). For the next model chunk.
- S2 to M: workflow 07 needs a bounds-valued observation; `FactValue` is quantity, text, flag or reference only, so `clearances` writes the box state into columns. Request: a bounds `FactValue` in a later revision.
- S2 finding: `tsconfig.build.json` fails for every V2 package because siblings resolve through unbuilt `dist`; a `build:v2` script in dependency order is a supervisor task before publication (not a track check).
- I to M: `frameBounds` ignores viewport aspect for orthographic projections (portrait viewports cut the box off; interact uses `height = 2 * radius * max(1, 1/aspect)`); dot, cross and `unitSlerp` live in interact's `src/vec.ts` and belong in `model/math.ts`. Queued for Track M2 or the next model chunk.
- S to M: `Vec2` landed in M2 (`d1645b8`); synthetic can drop its local `Vec2`, `turn` and `signedArea` in `src/triangulate.ts` at its next chunk. `Mesh.normals` stays optional (M's decision; synthetic's `ShadedMesh` narrows once).

### Queue

- Tooling review at wave end per [TOOLING-LEDGER.md](TOOLING-LEDGER.md).
- Wave 1 briefs once revision M1 is reviewed.

### Findings

- platonic-ts: the check gate's ratchet step shells out to a platonic-ts-only command, so the wrapper reuses its pure scanner instead. Its scan globs are fixed to `packages/*/src`, so alpha edits by other sessions move the counts; a regression caused by alpha edits is re-baselined by the supervisor and noted here. Upstream items: `--repo <dir>` for the entry points, configurable scan globs.
