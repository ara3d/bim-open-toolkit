# Wave flow-demos: tests, module seams, and demos for BimOpenFlow

> Plan, 2026-09-18, session "Flow demos and module tests". Follows the closed
> `nrc-handoff` wave (integration record in `docs/plans/nrc-handoff-wave.md`).
> Checkout: `.claude/worktrees/table-graph-layers`, branch
> `worktree-table-graph-layers`. Commit-turn lock:
> `mkdir docs/plans/nrc-handoff/.commit-turn`. Every agent builds with its own
> in-repo `--artifacts-path artifacts/<track>`; out-of-tree paths break the
> tests that find the repo root from the binary location.

## Goal

A node system that is easy to use and lets people define visualization and
dataflow workflows over IFC, CSV, BFAST, BOS, and DuckDB. This wave makes the
existing system trustworthy and demonstrable:

1. every part has a test and a runnable demo, and one demo runs the whole
   chain (IFC to DuckDB to relations to verdicts to 3D and a 2D chart);
2. modules are uncoupled and the layering test says so;
3. nothing takes longer than about two seconds, especially host start-up,
   unless there is a strong, recorded reason;
4. when the backend API is unreachable, every page says so, always.

## Baseline (2026-09-18, revision 75d7adc)

All wave gates green. Three audits (module coupling, test gaps, demo
inventory) produced these findings, kept here so they are not rediscovered:

- Node packs reference only `Nodes.Support` among packs; nothing enforces it.
  `Compliance`, `Geometry`, `Effects` skip `Support` and copy its helpers
  (`MemoryTable` twice, `ColumnIndex`/`RequireColumn` in `Geometry/TableOps.cs`).
- The tables profile cherry-picks `table.filter/derive/aggregate/sort` from
  `Nodes.Bos`, dragging BOS, Harmonizer, and parquet into a BIM-free profile.
- `rel.*` is bolted on in `HostComposition.BuildServices`; `AllPacks()` and
  `TablePacks()` omit it, so four call sites re-combine by hand and `NodeDocs`
  would miss it without its own special case.
- Repo-root discovery is written five times; the mini IFC fixture six times.
- 101 node kinds, all referenced by some test. Thin spots: the nine
  `view3d.*` recipe kinds share one generic loop; ten `rel.*` kinds share one
  file; `samples/duckdb-analyses/workflows.json` (nine graphs) has no test;
  `samples/nrc-analyses` is listed by name, not enumerated.
- The web `api-client` package has no tests and is outside `gates/web-smoke.mjs`.
- The web app marks the host "offline" only when start-up or opening a flow
  fails. A host that dies later, a failed autosave, or a broken SSE stream
  leaves "connected" on screen. `duckdb.html` has no status at all.
- No demo ends in a chart, report, or dashboard. No demo chains IFC to 3D and
  2D output. BFAST appears only as the browser transport. `bos.load` never
  feeds `rel.*` in any sample. Two sample folders lack READMEs.
- Host start-up cost is unmeasured; known heavy steps are the on-demand
  `duplex-enriched.duckdb` build (about 20 s) and `sample.bos` generation at
  seeding time, and the NRC test fixture pays the IFC conversion even for
  CSV-only runs.

## Tracks

| Track | Owner | Writes only | Ready when |
|---|---|---|---|
| M. Module seams | this session | `tests/BimOpenToolkit.Layering.Tests/**`, `HostComposition.cs`, `Nodes.Bos/**`, `Nodes.TableOps/**`, `Nodes.Support/**`, `Nodes.Compliance/**`, `Nodes.Effects/**` (MemoryTable only), all `.csproj`/`.sln`, `docs/nodes.md`, `NodeDocs/Program.cs`, new `tests/flow/BimOpenFlow.TestSupport/**` | now |
| P. Performance | this session | `SampleSeeding.cs`, `BimSampleSeeding.cs`, `HostRunner.cs`, `tests/flow/BimOpenFlow.NrcWorkflows.Tests/Fixture.cs`, `docs/plans/flow-demos/perf.md` | after measurement |
| W. Backend availability | subagent | `bimopenflow/web/packages/app/src/{hostStatus.ts,topbar.ts,app.ts,main.ts,duckdbDemo.ts,graphDemo.ts,showcase.ts}` and their tests, `bimopenflow/web/packages/api-client/**` (tests and package.json only; `src/index.ts` is generated), `gates/web-smoke.mjs`, checkpoint `track-w.md` | now |
| D. Demos and sample tests | subagent | `tests/flow/BimOpenFlow.TableWorkflows.Tests/DuckDbWorkflowCatalogTests.cs` (new), `tests/flow/BimOpenFlow.NrcWorkflows.Tests/{CsvGraphTests.cs,ModelGraphTests.cs,SampleEnumerationTests.cs}`, `samples/duckdb-analyses/README.md`, `samples/snowdon-analyses/README.md`, READMEs of the seven undocumented packs (`Nodes.DuckDb`, `Tables`, `TableOps`, `Cleaning`, `Dates`, `Viz`, `Support`), checkpoint `track-d.md` | now |
| S. Whole-system demo | this session, after M4 | `samples/showcase-analyses/**`, `tests/flow/BimOpenFlow.ShowcaseWorkflows.Tests/**` (or inside `NrcWorkflows.Tests`), `docs/DEMOS.md` | M4 landed |
| 3D. 3D flows | subagent (running) | `data/**`, `Nodes.Geometry/**`, `Host.Catalog/**`, `View3dWorkflows.Tests/**`, `Nodes.Geometry.Tests/**`, `samples/view3d-analyses/**`, web `viz`, `panes`, 3D files of `app`, checkpoint `track-3d.md` | now |

Anything outside a fence is requested through the checkpoint.

## Chunks

**M1** Layering test gains intra-flow rules: a `Nodes.*` project references
no other `Nodes.*` except `Support`; no `Nodes.*` references `Host.*` or the
output projects; only `Nodes.Effects` references `Ara3D.DataFlowEngine.Runs`;
`BimOpenFlow.Relations` references no DuckDB project.
**M2** `MemoryTable` hoisted to `Nodes.Support`; `Compliance` and `Effects`
reference `Support` and drop their copies. (`Geometry/TableOps.cs` waits for
track 3D to finish.)
**M3** `table.filter/derive/aggregate/sort`, `TableExpressions`, and the
`TableOps` helpers move from `Nodes.Bos` to `Nodes.TableOps`; `Bos` keeps
`bos.load` and `bos.query`; `TablePacks()` stops cherry-picking; the Bos and
TableOps READMEs and `docs/nodes.md` follow.
**M4** `rel.*` becomes part of both profile registries:
`HostComposition.Registry(profile, RelationRuntime)`, with `AllPacks()` and
`TablePacks()` including the pack over an empty runtime for tests and docs.
The four hand-combined call sites collapse.
**M5** `tests/flow/BimOpenFlow.TestSupport`: `RepoPaths` (root, samples,
data, by `[CallerFilePath]`) and `MiniIfc`; the copies go.
**P1** Measure host start-to-listening for both profiles, cold and warm
store; time each seeding step; record in `perf.md`.
**P2** Whatever P1 shows above two seconds is moved off the start-up path
(background build with a "preparing" state the API reports, or a documented
one-time prepare command), and the NRC fixture builds its database lazily.
**W1** `hostStatus.ts`: one status source fed by every API call (a `fetch`
wrapper passed through `ApiClientOptions.fetch`), the SSE `onerror`, and a
periodic cheap probe; states `connected`, `reconnecting`, `offline`; the
topbar and a persistent banner show it; the reducer-style module has unit
tests. **W2** `duckdb.html` and `showcase.html` show the same status.
**W3** `api-client` tests (URL per `ApiRoutes`, error shape) and inclusion
in `gates/web-smoke.mjs`.
**D1** `DuckDbWorkflowCatalogTests`: every graph in `workflows.json` parses,
validates against the tables registry, and evaluates over `sample.duckdb`
where its source allows (record which do not). **D2** `samples/nrc-analyses`
enumerated by a `[TestCaseSource]` so a new file cannot land untested.
**D3** READMEs for the two sample folders and seven packs, each with the node
table the documented packs use.
**S1** `showcase-analyses`: `csv-to-chart` (tables profile), `bos-to-relations`
(`bos.load` into `rel.fromTable` into `rel.aggregate` into `chart.bar`), and
`ifc-to-verdicts-and-chart` (the DC-W1 chain continued into `chart.bar` and
`sink.report`), each with a test. **S2** `docs/DEMOS.md`: every demo, its
command, port, profile, inputs, what you see, and the test that guards it.

## Gates

Per-track: the test projects each track touches. Wave: the nrc-handoff gate
list plus `TableWorkflows.Tests`, `BimWorkflows.Tests`, `View3dWorkflows.Tests`,
`gates/web-smoke.mjs`, and `gates/host-smoke.mjs`.

## Status (2026-09-18, revision 84ddc8d)

Landed, each as its own commit and green under the affected suites:

| Chunk | Commit | Result |
|---|---|---|
| baseline test fixes | 75d7adc | the two pre-existing failures were stale expectations |
| M1 flow layering rules | ff11e2a | four intra-flow rules enforced; all held |
| M4 rel.* in both profiles | 9a05121 | `HostComposition.Registry(profile, runtime)`; hand-combined sites gone |
| M3 table nodes to TableOps | 067636a, 84ddc8d | Bos holds `bos.load`/`bos.query` only; tables profile is BOS-free; `QueryOver` in the data layer |
| M2 MemoryTable to Support | 1326271 | Compliance, Effects, Geometry reference Support |
| P live registry, "not ready yet" | 5d943c7 | `RootScanRegistry`, `PreparingRegistry` |
| P background sample build | ff9f2aa | cold start 36 s to 0.5 s; sessions re-evaluate when the database lands |
| P lazy NRC fixture, timings | ecc1b63 | CSV-only run 1 s; `perf.md` |
| P lazy model hash | 4ae38b7 | first `/api/models` no longer hashes every model |
| fix IFC degenerate meshes | 53a69d9 | seeded view3d graphs render on Duplex |
| seeding filter, Duplex BOS job | 4b225ef | a profile seeds only graphs it can run and logs the rest |
| S1 showcase graphs, S2 DEMOS.md | 805aa8c | three end-to-end demos with cited numbers |
| W1-W3 host status, api-client tests | 83c5670, 50dad3b, ee9d0fe | banner on every page; reconnect; 17 client tests in the web gate |
| D1-D3 sample tests, READMEs | a718a12, 7c9fe19, 6e93085, 613c919 | nine DuckDB workflows tested; NRC folder enumerated; nine READMEs |
| 3D flows | 58f029e, 151614d, 935cfc1, fd8aaba | 3D pane keyed instances by the wrong id; fixed with tests |

Not done, recorded as extension points:

- **M5 shared test support** (`RepoPaths`, `MiniIfc`): five repo-root helpers
  and six mini-IFC strings remain. Cheap; next.
- **IRelationExecutor seam**: `Nodes.Relations` still references
  `Relations.DuckDb`; the layering rule only forbids `Relations` itself from
  seeing DuckDB.
- **Graph-level Run**: effect nodes stay `EffectPending`; tests run them by
  hand with an `IsRun` context. The report and write-back demos therefore
  show a pending node until the engine grows a Run.
- **BFAST as a graph input**: no `bfast.*` reader; BFAST is only the 3D
  transport.
- **Numeric cast in the expression grammar**: `nrc-dc-w1-verdicts` and the
  showcase graph use a `rel.sql` node for `CAST(Value AS DOUBLE)`.
- **`ModelCatalog.Slug`** yields `.bos` for a non-ASCII file name (track 3D
  finding); fall back to the hash prefix.
- **Host status latency**: an idle host death surfaces in about 20 s through
  the probe; a 10 s connected cadence would halve it.
- **Snowdon folder in the model roots**: seeding adds the whole
  `Documents\BIM Open Schema` folder when the local model exists.

## Follow-through (2026-09-18, revision after the merge to main at ce2b569)

Merged to `main` (fast-forward; the NRC gates were re-run there by the
hand-off session, all green). Then three more tracks on the same branch:

| Track | Commits | Result |
|---|---|---|
| E engine Run, `toNumber` | submodule f123068, e029371 (pushed on `relation-value`); toolkit f2d151f, 643a0f9, 02f0051, a4fc63b | `EvalSession.Run` per spec §6; `POST .../runs` executes effects and records them; `toNumber(Text)` in the grammar and `TRY_CAST` in SQL; both DC-W1 graphs drop `rel.sql` |
| T test support, BFAST | 4c1f04f, f9823c2, f685b06 | `tests/BimOpenToolkit.TestSupport` (`RepoPaths`, `MiniIfc`) replaces eleven copies; `bfast.read` and `bfast.buffer` in the Tables pack with a 448-byte fixture and a showcase graph |
| W2 web polish | f201cfd, 44dbdde, d8b7a62, 18ca19f | selection survives reconnect; 3D legend for instance tables; formatted numbers with exact values on hover; 10 s probe |
| integration | this commit and the two before | publishing theme LF-normalized (CRLF checkout bug), showcase ids and README |

Gates at this revision: every `tests/flow` suite, layering (8), the touched
data suites, `gates/web-smoke.mjs`, and `gates/host-smoke.mjs` all pass.

Still open: `rel.rename` (the plan operator exists; the graphs keep source
column spellings for lack of it); `RunReplay` cannot re-derive effect hashes;
the SDK's stream-based `BFast.Read` mis-seeks absolute ranges (the nodes use
the memory-mapped reader); a `{TABLES}` placeholder for showcase graphs; the
3D legend picks its column by name; the engine's `relation-value` branch
should merge to its own main.
