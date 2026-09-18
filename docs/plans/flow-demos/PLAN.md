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
