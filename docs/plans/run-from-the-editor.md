# Run from the editor

Status: building
Request: TKT-12. The editor's Run button calls `POST /api/analyses/{id}/runs`, and every sink executes once. The run record lists the graph hash and every input by content hash. After a Run over the Duplex verdict graph, a report file and an evidence package exist on disk; the package is a zip whose `manifest.json` lists a SHA-256 per member and is built with `BimOpenFlow.Evidence`. After a Run over a Snowdon table graph with `sink.exportXlsx`, the `.xlsx` exists and the run record names it. Sinks on the canvas say "will write on Run" before a Run and show what they wrote after it. Serves workflows 3 and 5 of `PROJECT.md`, and the write-back step of workflow 6, which uses the same mechanism. It also serves Success line 4 and principles 2 and 4.

Open questions (each has a default the plan builds on; the supervisor took every default on 2026-09-26 and the ticket's fence now lists the chunk table's paths):

1. **Part of the ticket's premise is out of date.** The engine got a graph-level Run in `f123068` (`EvalSession.Run`), and since `f2d151f` (2026-09-18) the HTTP `POST .../runs` calls it through `AnalysisSessions.Run`. So effects already execute over HTTP, and `RunAndSseTests.CreateRun_ExecutesEffects_AndRecordsThem` covers it. The editor already has a Run button (`app.ts` `run()`). What is still missing:
   - The `createRun` MCP tool (`FlowEvalTools.CreateRun`) freezes `Snapshot` instead of calling `Run`, so it never executes effects.
   - The button does not save pending edits first, so within the 400 ms autosave window it runs the previous document. It also shows only the record's file name.
   - `RunInputs.Derive` skips relation sources. The Duplex graph's two `rel.table` reads of `duplex-enriched` go unpinned.
   - Nothing builds an evidence package.
   - The badge cannot say what was written.

   **Default:** the plan fixes those five and keeps effect execution where it already is.
2. **Fence additions.** The ticket fence leaves out paths the work cannot avoid:
   - `contracts/contracts.json`, `contracts/generated/csharp/BimOpenFlow.Contracts.g.cs`, and `bimopenflow/web/packages/contracts/src/index.ts`, for the run summary's shape.
   - `src/flow/BimOpenFlow.Host.Store/AnalysisStoreRuns.cs`, where the package path sits beside the record; `RunsDir` is internal.
   - `src/flow/BimOpenFlow.Host/RelationHostResults.cs`, which resolves relation sources to files.
   - `src/flow/BimOpenFlow.Reports/ReportGenerator.cs`, because it throws on a terminal relation output.
   - `src/mcp/BimOpenMcp.Flow/FlowEvalTools.cs`, for createRun.
   - New test files in `tests/flow/BimOpenFlow.Host.Api.Tests`, `tests/flow/BimOpenFlow.Host.Tests`, `tests/flow/BimOpenFlow.NrcWorkflows.Tests`, and `tests/mcp/BimOpenMcp.Flow.Tests`, plus two existing files in `tests/flow/BimOpenFlow.Reports.Tests`.

   No evidence sink node is proposed, so no new test project is needed (question 4). **Default:** extend the fence to exactly the chunk table's paths.
3. **Where effect execution lives.** **Default:** in the engine's `EvalSession.Run`, reached through `AnalysisSessions.Run`. Every ready effect node executes once, in topological order with ties broken by node id, and is never memoized. A new host class, `AnalysisRuns`, becomes the one path from "Run" to an archived record. The HTTP endpoint and the MCP tool both call it (C3, C7). There is no separate runner.
4. **An evidence node or a Run step.** **Default:** a step every Run performs after it archives the record. A node cannot build the package:
   - Its `Eval` sees only inputs, parameters, and `IEvalContext` (`IsRun`, cancellation, warn). It sees neither the `GraphDocument` nor the `RunRecord`.
   - The record is frozen after every node has executed and contains the node's own output hash, so a node cannot hash the run it belongs to.
   - `FlowLayering.ForbiddenForPacks` forbids any pack from referencing `BimOpenFlow.Evidence`.
5. **Which file "report.html on disk" means.** **Default:** the file `sink.report` writes (`artifacts/showcase/dc-w1-verdicts.html` for the showcase graph). The package's `report.html` member is the run report, `ReportGenerator.FromRun`, which states the graph hash and every input hash. The sink's page states neither. Override: copy the sink's bytes into the package instead (see Considered and rejected, item 5).
6. **How the run reaches the canvas.** **Default:** the POST is synchronous. Its response, the `RunSummary`, now lists each executed effect and the file it wrote. Node statuses already arrive on the existing event stream, because `Run` commits its snapshot and notifies subscribers. No poll and no new event.
7. **What a sink shows.** **Default:** `nodeBadge` shows "Will write on Run" for `EffectPending`, replacing "Run to see results"; the engine gives that status only to effect nodes. After a Run, an effect node that is Ok and appears in the last run's effects shows "Wrote <file name>". The full path appears in the toast and in the sink's result table (its `path` cell). `canvasParts.ts` cuts badge text to the node width, so a full path would lose the file name. The next edit returns the sink to "Will write on Run".
8. **Headless acceptance tests.**
   - **Duplex:** `NrcWorkflows.Tests`, which CI runs in its own step without `continue-on-error` (`.github/workflows/build.yml` line 46).
   - **Snowdon:** `Host.Tests`. It reads `BOF_DUCKDB`, the variable `check-bim-flow-duckdb.mjs` already uses, or `artifacts/building-model-workflows/snowdon-cli.duckdb` (76 MB, present on the owner's machine). Without the file it calls `Assert.Ignore` with that path and `npm run duckdb:prepare --prefix bimopenflow/web`.
   - The Snowdon graph is built inside the test from `duckdb-door-schedule` plus one `sink.exportXlsx`. It is not a committed sample, because TKT-30, TKT-8, TKT-13, and TKT-20 all fence `samples/duckdb-analyses/**`.
9. **Idempotence.** **Default:** a second Run over an unchanged graph:
   - writes a new record file, because the name carries the millisecond timestamp;
   - records the same `graphHash` and the same input hashes;
   - lets sinks overwrite their files in place, through the existing atomic `Sinks.ReplaceVia`;
   - writes a second evidence package beside the second record and leaves the first untouched. Packages are versioned by record, like the records themselves.
10. **The "open analysis" concept (TKT-26).** **Default:** the editor passes its explicit `currentId`. `AnalysisRuns.Create` takes an explicit id. The MCP tool gets TKT-26 C4's id fallback for free, because C7 runs after it.
11. **Collisions with in-flight work.**
   - **Contracts:** TKT-26 C1 is committed (7fd584c). C3 never runs alongside TKT-33's contract chunk.
   - **`EvalEndpoints.cs`:** C3 changes it, and so does TKT-26 C3 (`StreamEvents`). They run one after the other.
   - **`FlowEvalTools.cs`:** C7 runs after TKT-26 C4.
   - **`app.ts`:** C10 runs after TKT-26 C6 and TKT-11 C8.
   - **TKT-11:** fences named app files; the supervisor sequences its C8 against C10.
   - **TKT-30's script:** it POSTs to the same endpoint and reads `fileName`. The new summary fields are additive, and each of its runs will also produce a package beside its record.

## Brainstorm
skipped

## Acceptance criteria

These come from workflow 3's Done line ("after Run an `.xlsx` exists on disk and is named in the run record"), workflow 5's ("after Run from the editor, `report.html` and an evidence package ... exist on disk"), and Success line 4 ("with no script or HTTP call").

- **The Run button.** On any page built on `createApp` (`/`, `/duckdb.html`, `/3d.html`), pressing Run:
  - saves pending edits through the connection's save queue, then sends exactly one `POST /api/analyses/{id}/runs`;
  - is disabled and reads "Running…" until the response arrives;
  - ends in a toast naming the record file, the full path of every file a sink wrote, each failed sink with its error, and the evidence package path, or why there is none.
- **One engine Run.** The POST executes every ready effect node once, in topological order.
  - The archived record (`GET .../runs/{fileName}`) has a `graphHash` equal to `ComputeGraphHash()` of the saved document.
  - Its `inputs` list, with a SHA-256 each, every ModelRef parameter, every FilePath parameter that names an existing file, and every file behind a relation source node.
  - For `ifc-to-verdicts-and-chart` that means `model.path` (the IFC), `entities.source`, and `parameters.source` (both the Duplex DuckDB).
- **The summary.** The POST response lists every executed effect: `{nodeId, status, path?, error?}`.
  - `path` comes from the effect's recorded one-row summary table: `path`, or `targetPath` for `sink.writePsets`.
  - `listRuns` returns the same list for archived runs, rebuilt from their records.
- **Duplex.** After one Run of `samples/showcase-analyses/ifc-to-verdicts-and-chart.json`:
  - the `report` sink's file exists with 14 door rows;
  - `<store>/<id>/runs/<record stem>.evidence.zip` exists;
  - `EvidencePackage.Verify` returns Ok;
  - `manifest.json` lists `graph.dfg.json`, `run.run.json`, and `report.html`, each with a 64-character lowercase hex SHA-256, and the record's graph hash;
  - the `report.html` member contains the graph hash and each input's content hash.
- **Snowdon.** After one Run of `duckdb-door-schedule` with a `sink.exportXlsx` fed from `answer`:
  - the `.xlsx` exists with 142 data rows;
  - its path appears in the summary's effects and in the archived record's `recordedOutputs["xlsx.out"]`;
  - the record pins `database.path` by hash.
- **Canvas.** Before a Run, every `EffectPending` node reads "Will write on Run". After the Run, the sink reads "Wrote dc-w1-verdicts.html" (or "Wrote doors.xlsx"). After the next edit it reads "Will write on Run" again. A sink that failed shows its error through the existing Error badge.
- **MCP.** The `createRun` MCP tool performs the same Run and returns the same summary shape.
- **Idempotence.** A second Run over an unchanged graph behaves as in open question 9.
- **A failed package does not fail the Run.** If building the package fails, the Run still returns 200 with the record archived, `evidencePath` absent, and `evidenceError` set.
- **Excluded:**
  - signing the manifest;
  - input snapshots and written files inside the package;
  - a runs history panel;
  - downloading the package from the browser;
  - cancelling a Run;
  - progress events during a Run (TKT-33's area);
  - the MCP id fallback (TKT-26);
  - a committed Snowdon export sample;
  - chart image export.

Evidence:
- `dotnet test tests/flow/BimOpenFlow.NrcWorkflows.Tests --filter FullyQualifiedName~RunFromHost` passes in CI.
- On the owner's machine, `dotnet test tests/flow/BimOpenFlow.Host.Tests --filter FullyQualifiedName~SnowdonExportRun` reports Passed, not Skipped.
- A manual session recorded in `docs/DEMOS.md`: open `ifc-to-verdicts-and-chart` in the bim editor and press Run. The report node's badge changes from "Will write on Run" to "Wrote dc-w1-verdicts.html". The toast names `...\runs\<stem>.evidence.zip`, and that file opens as a zip with `manifest.json` at its root.

Kill criteria: none. The engine Run and the Evidence library both exist and are tested; this work connects them.

## Design

**What exists.**
- `EvalSession.Run` executes effects per spec semantics §6, and `AnalysisSessions.Run` wraps it under the session lock.
- `EvalEndpoints.CreateRun` then calls `RunInputs.Derive(doc, registry, catalog)`, `RunRecorder.Freeze`, and `store.SaveRun`.
- `RunRecorder.Freeze` records the executed effects (`EffectRecord(node, status, error)`) and every output that feeds no edge (`recordedOutputs`). A sink's one-row summary is normally such an output, so the record already holds the path it wrote. Both acceptance graphs have sinks with unconnected outputs.
- `EvidencePackage.Build(graph, run, reportHtml, inputs, createdUtc, outPath)` and `ReportGenerator.FromRun(run, options)` exist and are tested, but nothing calls them outside their tests.

**New and changed pieces:**

1. **`AnalysisRuns`** (Host.Api, new) is the one run path. It:
   - runs the engine;
   - derives inputs, now including relation sources;
   - freezes the record and saves it;
   - builds the evidence package beside the record (C4);
   - returns a `RunSummary` built from the record.

   `EvalEndpoints` delegates both `createRun` and `listRuns` to it. The MCP tool calls it too (C7), which removes the second, effect-less copy of CreateRun.
2. **`RunEffects.Of(record)`** (Host.Api, new) turns `record.Effects` plus `record.RecordedOutputs["<node>.<port>"]` into `RunEffect` entries. The knowledge of which summary column names the written file lives in exactly one place: `RunEffects.PathColumns = ["path", "targetPath"]`. The Effects README documents the convention.
3. **Relation sources pinned.**
   - `IRelationResults` gains `SourceFiles(RelationValue)`, with a default of none.
   - `RelationHostResults` resolves a `ReadTable` or `ReadCsv` leaf through `RelationRuntime.Registry`.
   - The new `RunInputs.Derive(snapshot, ...)` pins each file once, at the node whose relation is that leaf, under the parameter name `source`.
   - Host.Api still references no node pack.
4. **Evidence package.**
   - Path: `<store>/<id>/runs/<record stem>.evidence.zip`, from `AnalysisStoreRuns.EvidencePath`.
   - Members: the run's own snapshot document, the saved record, and `ReportGenerator.FromRun(record, new ReportOptions(id))`. No inputs. `createdUtc` is the record's timestamp, so building is deterministic.
   - Host.Api gains project references to `BimOpenFlow.Evidence` and `BimOpenFlow.Reports`. The layering tests forbid those references only for packs.
5. **`ReportGenerator`** renders a terminal relation output as its plan text instead of throwing. Without this, a graph that ends in a `rel.*` node would lose its package.
6. **Web.**
   - The state package gets `State.lastRun`, an `applyRun` action, and a `runAnalysis` function (save, then POST, then dispatch). It lives in a new `run.ts`, so `sync.ts` and its `AnalysisApi` stay unchanged.
   - `nodeBadge` takes the last run's effects.
   - `viewModel` passes them.
   - `app.ts` calls `runAnalysis`, and the topbar disables Run while it is pending.
   - A pure `runMessage` builds the toast.

**Libraries.** No new library. Changed:
- `BimOpenFlow.Host.Api`: `AnalysisRuns`, `RunEffects`, `RunInputs`, and `IRelationResults`.
- `BimOpenFlow.Host.Store`: `EvidencePath`.
- `BimOpenFlow.Reports`: relation outputs.
- `BimOpenFlow.Host`: `RelationHostResults.SourceFiles`.
- The generated contracts and api-client.
- `@bimopenflow/state` and `@bimopenflow/app`.

`BimOpenFlow.Evidence` and `BimOpenFlow.Nodes.Effects` are used as they are; only the Effects and Evidence READMEs change.

Retires:
- `EvalEndpoints.CreateRun` and `EvalEndpoints.ToSummary` (C3).
- `FlowEvalTools.CreateRun`'s effect-less freeze and its run `ToSummary` (C7).
- The `RunInputs.Derive(GraphDocument, ...)` overload (C7, its last caller gone).
- `app.ts` `run()` calling `api.createRun` directly, with its toast "Run recorded: <file>" (C10).
- The badge text "Run to see results" (C9).

## Considered and rejected

1. **A `sink.evidence` node.**
   - Reason: a node sees neither the graph nor the frozen record, and the record contains the node's own output hash. `FlowLayering.ForbiddenForPacks` bars packs from `BimOpenFlow.Evidence`.
   - Would change if: the engine gains a post-Run hook that hands effects the frozen record.
2. **A host-side effect runner that calls EffectPending nodes by hand,** the way `ModelGraphTests` did before `f123068`.
   - Reason: `EvalSession.Run` already implements semantics §6: each effect runs once, never memoized, in topological order, and its downstream evaluates over its outputs. A second runner would duplicate the spec.
   - Would change if: a Run must execute a chosen subset of sinks.
3. **The browser reads each sink's path with `getResult` after the Run.**
   - Reason: one request per sink, plus the summary column names copied into TypeScript. The POST already holds the record.
   - Would change if: a sink writes several files and the list needs paging.
4. **A run event on the SSE stream, or a poll after the POST.**
   - Reason: the POST returns when the sinks have finished, and the stream already carries the statuses because Run commits its snapshot.
   - Would change if: Runs take minutes and need progress, which should coordinate with TKT-33's Evaluating state.
5. **The package's `report.html` is the bytes `sink.report` wrote.**
   - Reason: the host would have to know one pack's node kind, runs without that sink would get no package, and the sink's page carries no hashes.
   - Would change if: reviewers want the author's page inside the package. Then add an `outputs/` folder (Extension points, item 1).
6. **Write the package next to the report file and overwrite it each Run.**
   - Reason: records are immutable, one per Run. Overwriting the evidence breaks principle 4.
   - Would change if: people want the package beside their exports. Then add a copy step.
7. **Put pinned input files under `inputs/`.**
   - Reason: Snowdon's DuckDB is 76 MB and the federation IFC files total 215 MB, while the record already pins them by hash.
   - Would change if: a reviewer must replay without access to the inputs. Then add size-capped snapshots.
8. **Rename `sink.writePsets`'s `targetPath` column to `path`.**
   - Reason: it changes a node output, the generated `docs/nodes.md`, and `NodeNotes.cs`, all in TKT-16's fence.
   - Would change if: TKT-16 releases those files. Then `PathColumns` shrinks to `["path"]`.

## Signatures and contracts

Not compiled: the planner has no write access. C2's and C3's builds are the first compile. A mismatch there goes back to the supervisor.

`contracts/contracts.json` (C3):

```json
"enums":  { "RunEffectStatus": ["Ok", "Failed"] },
"RunEffect":  { "nodeId": "string", "status": "RunEffectStatus", "path": "string?", "error": "string?" },
"RunSummary": { "fileName": "string", "timestampUtc": "string", "graphHash": "string",
                "effects": "RunEffect[]", "evidencePath": "string?", "evidenceError": "string?" }
```

The enum is not named `EffectStatus`, because that name collides with `Ara3D.DataFlowEngine.Runs.EffectStatus` in files that import both namespaces.

Generated output:

```csharp
public enum RunEffectStatus { Ok, Failed }
public sealed record RunEffect(string NodeId, RunEffectStatus Status, string? Path, string? Error);
public sealed record RunSummary(string FileName, string TimestampUtc, string GraphHash,
    IReadOnlyList<RunEffect> Effects, string? EvidencePath, string? EvidenceError);
```
```ts
export type RunEffectStatus = "Ok" | "Failed";
export interface RunEffect { nodeId: string; status: RunEffectStatus; path?: string | undefined; error?: string | undefined; }
export interface RunSummary { fileName: string; timestampUtc: string; graphHash: string; effects: RunEffect[];
  evidencePath?: string | undefined; evidenceError?: string | undefined; }
```

Example POST response for the Duplex showcase:
```json
{"fileName":"20260926T230102345Z-1a2b3c4d.run.json","timestampUtc":"2026-09-26T23:01:02.345Z","graphHash":"1a2b3c4d…",
 "effects":[{"nodeId":"report","status":"Ok","path":"C:/…/artifacts/showcase/dc-w1-verdicts.html"}],
 "evidencePath":"C:\\…\\analyses\\ifc-to-verdicts-and-chart\\runs\\20260926T230102345Z-1a2b3c4d.evidence.zip"}
```

`src/flow/BimOpenFlow.Host.Api/RelationResults.cs` (C2):
```csharp
/// <summary>The files a relation reads when it is itself a source read (a table of a DuckDB
/// source, or a CSV under a source folder), resolved through the host's source registry. Empty
/// for a relation built from other relations and for a source that does not resolve. A run pins
/// these by content hash.</summary>
IReadOnlyList<string> SourceFiles(RelationValue relation) => [];
```

`src/flow/BimOpenFlow.Host/RelationHostResults.cs` (C2): implements `SourceFiles`.
- A `ReadTable` plan whose source resolves to `SourceType.DuckDbFile` gives `[location.Path]`.
- A `ReadCsv` plan whose source resolves to `FileRoot` gives `[Path.Combine(location.Path, csv.Path)]` when that file exists.
- Anything else gives `[]`: a non-`Plan` payload, a composite plan, or a `SourcePreparingException`.

Example: with `ConnectionRegistry.Of(("db", SourceType.DuckDbFile, tmp))`, `SourceFiles(runtime.Relation(new ReadTable("db", "t"), "rel.table"))` gives `[Path.GetFullPath(tmp)]`. A filter over that plan gives `[]`.

`src/flow/BimOpenFlow.Host.Api/RunInputs.cs` (C2):
```csharp
/// <summary>As the document overload, plus: for every Ok node with a RelationValue output,
/// each file relations.SourceFiles returns, recorded as RunInput(node, "source", sha256, path).</summary>
public static IReadOnlyList<RunInput> Derive(EvalSnapshot snapshot, INodeRegistry registry,
    ModelCatalog catalog, IRelationResults? relations)
    => throw new NotImplementedException();
// Derive(GraphDocument, INodeRegistry, ModelCatalog) stays until C7 removes it.
```

`src/flow/BimOpenFlow.Host.Api/RunEffects.cs` (C3):
```csharp
/// <summary>What a run's effects wrote, read from its frozen record.</summary>
public static class RunEffects
{
    /// <summary>Summary columns that name a sink's written file, in order: every table sink
    /// and sink.report use "path"; sink.writePsets uses "targetPath".</summary>
    public static readonly IReadOnlyList<string> PathColumns = ["path", "targetPath"];

    /// <summary>One entry per record.Effects item, in order. Path is the first PathColumns cell
    /// of a one-row TableValue recorded under "<node>.<port>"; absent when the effect's output
    /// feeds another node (not recorded) or names no file.</summary>
    public static IReadOnlyList<RunEffect> Of(RunRecord record) => throw new NotImplementedException();
}
```

Examples:
- `Effects [("xlsx", Ok)]` with `RecordedOutputs {"xlsx.out": {path:"C:/out/doors.xlsx", rowCount:142, sheet:"Sheet1"}}` gives `[RunEffect("xlsx", Ok, "C:/out/doors.xlsx", null)]`.
- `Effects [("report", Failed, "IOException: denied")]` gives `[RunEffect("report", Failed, null, "IOException: denied")]`.
- A `{targetPath:"C:/o.ifc", ...}` summary gives path `"C:/o.ifc"`.

`src/flow/BimOpenFlow.Host.Api/AnalysisRuns.cs` (C3; C4 adds the package):
```csharp
using RunSummary = BimOpenFlow.Contracts.RunSummary;

/// <summary>The one path from "Run" to an archived record: the engine Run through the analysis's
/// session (every ready effect node executes once, in topological order), the pinned inputs, the
/// frozen record, and the evidence package beside it. The HTTP endpoint and the MCP createRun tool
/// both call it.</summary>
public sealed class AnalysisRuns(ModelCatalog catalog, AnalysisStore store, INodeRegistry registry,
    AnalysisSessions sessions, IRelationResults? relations = null)
{
    /// <summary>Runs, freezes, archives, packages, and summarizes. Throws FileNotFoundException for
    /// an unknown id and IOException when a record of the same name exists (the endpoint maps them
    /// to 404 and 409). A failure while packaging is caught and reported in EvidenceError; the
    /// record stays archived.</summary>
    public RunSummary Create(string id, DateTimeOffset now, CancellationToken ct = default)
        => throw new NotImplementedException();

    /// <summary>An archived run's summary, rebuilt from its record; EvidencePath when the package
    /// file exists beside it.</summary>
    public RunSummary Summarize(string id, string fileName) => throw new NotImplementedException();
}
```

`src/flow/BimOpenFlow.Host.Store/AnalysisStoreRuns.cs` (C4):
```csharp
public const string EvidenceExtension = ".evidence.zip";
/// <summary>"20260926T230102345Z-1a2b3c4d.run.json" gives "<store>/<id>/runs/20260926T230102345Z-1a2b3c4d.evidence.zip".</summary>
public static string EvidencePath(this AnalysisStore store, string id, string runFileName)
    => throw new NotImplementedException();
```

C4 package contents: `EvidencePackage.Build(snapshot.Document, record, ReportGenerator.FromRun(record, new ReportOptions(id)), [], record.TimestampUtc, store.EvidencePath(id, fileName))`.

`src/flow/BimOpenFlow.Reports/ReportGenerator.cs` (C1): `ScalarText` gains `RelationValue r => r.Text`, and `EvidenceHtml` labels the entry `Relation`. Example: a record with `recordedOutputs {"q.relation": RelationValue("scan db.t", <hash>)}` renders `<p>Relation: <code>scan db.t</code></p>` and does not throw.

`bimopenflow/web/packages/state` (C8):
```ts
// actions.ts
| { type: "applyRun"; run: RunSummary }
// reducer.ts: State gains `readonly lastRun: RunSummary | null` (initialState: null; setDocument resets it via initialState)
// run.ts (new)
export interface RunApi { createRun(id: string): Promise<RunSummary>; }
/** Saves pending edits through the connection, then asks the host for one Run of the saved
 *  document and records the summary in the store. One POST per call; a failed save sends none. */
export async function runAnalysis(store: Store, api: RunApi,
  connection: Pick<AnalysisConnection, "save">, analysisId: string): Promise<RunSummary> {
  throw new Error("not implemented");
}
```

Example: with a fake that logs calls, `runAnalysis(store, api, conn, "a")` logs `["save", "createRun:a"]` and leaves `store.getState().lastRun` equal to the summary. When `save` rejects, the log is `["save"]` and the promise rejects.

`bimopenflow/web/packages/app/src/nodeBadge.ts` (C9):
```ts
export interface BadgeGraph {
  readonly edges: readonly { readonly from: string; readonly to: string }[];
  readonly evalState: Readonly<Record<string, NodeState>>;
  /** The last Run's effects (State.lastRun?.effects), for the written-file text. */
  readonly effects?: readonly RunEffect[];
}
// EffectPending gives { status, text: "Will write on Run" }
// Ok with an effects entry that has a path gives { status: "Ok", text: `Wrote ${fileName}` } (last segment, '/' or '\')
```

Example: `report` is Ok with effects `[{nodeId:"report", status:"Ok", path:"C:\\a\\showcase\\dc-w1-verdicts.html"}]`, which gives `{status:"Ok", text:"Wrote dc-w1-verdicts.html"}`. `viewModel.buildCanvasModel` passes `effects: state.lastRun?.effects`.

`bimopenflow/web/packages/app/src/runMessage.ts` (C10):
```ts
/** The toast after a Run: record file, each written path, each failed sink with its error,
 *  and the evidence package or why it is missing; "error" when any sink failed. */
export function runMessage(summary: RunSummary): { text: string; kind: "info" | "error" } {
  throw new Error("not implemented");
}
```

Example: the Duplex summary above gives `{kind:"info", text:"Run 20260926T230102345Z-1a2b3c4d.run.json: wrote C:/…/dc-w1-verdicts.html. Evidence: C:\\…\\….evidence.zip"}`.

`topbar.ts` (C10): `Topbar` gains `setRunning(running: boolean): void`, which disables the Run button and shows "Running…" while it is pending.

## Extension points

1. An `outputs/` folder in the evidence package holding every file the sinks wrote, hashed in the manifest, with a size cap.
2. A `writes` member on `runs.md`'s effect entries (submodule spec), so a sink whose summary feeds another node is still named in the record.
3. Signing the canonical manifest bytes (the existing TODO in `EvidenceManifest`).
4. Size-capped input snapshots under `inputs/`.
5. A runs panel in the editor over `listRuns`, and a GET route that serves a package or report for download.
6. A stamp-keyed hash cache for FilePath and relation-source inputs. `ModelCatalog.ContentHash` has one but it is private; see the existing TODO in `RunInputs`. Glob FilePath inputs are still skipped (existing TODO).
7. A committed Snowdon export graph in `samples/duckdb-analyses` once TKT-30 releases the folder.
8. Run progress on the event stream, together with TKT-33.
9. Hover text with the full written path, once the canvas gains a tooltip.
10. One summary path column across all sinks (Considered and rejected, item 8).

## Chunks

All paths are relative to `C:\Users\cdigg\git\bim-open-toolkit`. The web commands run from `bimopenflow/web`.

| Id | One-sentence commit | Fence (writes only) | Depends on | Test command | Resources |
|---|---|---|---|---|---|
| C1 | The run report shows a terminal relation output as its plan text instead of throwing | `src/flow/BimOpenFlow.Reports/ReportGenerator.cs`, `tests/flow/BimOpenFlow.Reports.Tests/ReportGeneratorTests.cs`, `tests/flow/BimOpenFlow.Reports.Tests/TestRuns.cs` | - | `dotnet test tests/flow/BimOpenFlow.Reports.Tests` | dotnet build lock |
| C2 | A run pins the file behind every relation source by content hash | `src/flow/BimOpenFlow.Host.Api/RelationResults.cs`, `src/flow/BimOpenFlow.Host.Api/RunInputs.cs`, `src/flow/BimOpenFlow.Host/RelationHostResults.cs`, `tests/flow/BimOpenFlow.Host.Api.Tests/RunInputsTests.cs` (new), `tests/flow/BimOpenFlow.Host.Tests/RelationHostResultsTests.cs` (new) | - | `dotnet test tests/flow/BimOpenFlow.Host.Api.Tests && dotnet test tests/flow/BimOpenFlow.Host.Tests` | dotnet build lock |
| C3 | The run summary lists every executed sink with the file it wrote, from one run path the endpoint shares | `contracts/contracts.json`, `contracts/generated/csharp/BimOpenFlow.Contracts.g.cs`, `bimopenflow/web/packages/contracts/src/index.ts`, `bimopenflow/web/packages/api-client/src/index.ts`, `src/flow/BimOpenFlow.Host.Api/AnalysisRuns.cs` (new), `src/flow/BimOpenFlow.Host.Api/RunEffects.cs` (new), `src/flow/BimOpenFlow.Host.Api/EvalEndpoints.cs`, `tests/flow/BimOpenFlow.Host.Api.Tests/RunEffectsTests.cs` (new), `tests/flow/BimOpenFlow.Host.Api.Tests/RunSummaryEndpointTests.cs` (new) | C2; TKT-26 C1 committed | `node contracts/generate.mjs && dotnet test tests/flow/BimOpenFlow.Host.Api.Tests && dotnet build src/mcp/BimOpenMcp.Flow && dotnet build src/studio/BimOpenFlow.Studio && cd bimopenflow/web && npm test -w @bimopenflow/api-client && npm run typecheck -w @bimopenflow/app` | dotnet build lock; not concurrent with TKT-26 C3 (`EvalEndpoints.cs`) or TKT-33's contract chunk; whichever lands second reruns the generator |
| C4 | Every Run builds an evidence package beside its record | `src/flow/BimOpenFlow.Host.Api/AnalysisRuns.cs`, `src/flow/BimOpenFlow.Host.Api/BimOpenFlow.Host.Api.csproj`, `src/flow/BimOpenFlow.Host.Store/AnalysisStoreRuns.cs`, `tests/flow/BimOpenFlow.Host.Api.Tests/RunEvidenceTests.cs` (new) | C1, C3 | `dotnet test tests/flow/BimOpenFlow.Host.Api.Tests && dotnet test tests/flow/BimOpenFlow.Host.Store.Tests && dotnet test tests/BimOpenToolkit.Layering.Tests` | dotnet build lock |
| C5 | A host Run over the Duplex verdict graph writes its report and a verifiable evidence package, and pins the IFC and the DuckDB | `tests/flow/BimOpenFlow.NrcWorkflows.Tests/RunFromHostTests.cs` (new) | C2, C4 | `dotnet test tests/flow/BimOpenFlow.NrcWorkflows.Tests --filter FullyQualifiedName~RunFromHost` | dotnet build lock; NRC fixture database; temp folders only |
| C6 | A host Run over the Snowdon door schedule with an xlsx sink writes the workbook and names it in the record | `tests/flow/BimOpenFlow.Host.Tests/SnowdonExportRunTests.cs` (new) | C2, C3 | `dotnet test tests/flow/BimOpenFlow.Host.Tests --filter FullyQualifiedName~SnowdonExportRun` (Passed on the owner's machine, Skipped with the reason elsewhere) | dotnet build lock; private `snowdon-cli.duckdb` (read only) |
| C7 | The createRun MCP tool performs the engine Run through the same run path | `src/mcp/BimOpenMcp.Flow/FlowEvalTools.cs`, `src/flow/BimOpenFlow.Host.Api/RunInputs.cs`, `tests/mcp/BimOpenMcp.Flow.Tests/CreateRunToolTests.cs` (new) | C4; TKT-26 C4 committed | `dotnet test tests/mcp/BimOpenMcp.Flow.Tests && dotnet test tests/flow/BimOpenFlow.Host.Api.Tests` | dotnet build lock |
| C8 | The state package runs an analysis after saving it and keeps the last run's summary | `bimopenflow/web/packages/state/src/actions.ts`, `bimopenflow/web/packages/state/src/reducer.ts`, `bimopenflow/web/packages/state/src/run.ts` (new), `bimopenflow/web/packages/state/src/index.ts`, `bimopenflow/web/packages/state/test/run.test.ts` (new) | C3 | `npm test -w @bimopenflow/state && npm run typecheck -w @bimopenflow/app` | none |
| C9 | Sinks read "Will write on Run" before a Run and name the file they wrote after it | `bimopenflow/web/packages/app/src/nodeBadge.ts`, `bimopenflow/web/packages/app/src/viewModel.ts`, `bimopenflow/web/packages/app/test/nodeBadge.test.ts`, `bimopenflow/web/packages/app/test/viewModelRun.test.ts` (new) | C8; TKT-11 C5 committed (same viewModel.ts) | `npm test -w @bimopenflow/app && npm run typecheck -w @bimopenflow/app` | app tests share the tree with TKT-11, TKT-22, and TKT-26; a failure in their files is not this chunk's |
| C10 | The Run button saves first, disables itself while running, and reports the written files and the evidence package | `bimopenflow/web/packages/app/src/app.ts`, `bimopenflow/web/packages/app/src/topbar.ts`, `bimopenflow/web/packages/app/src/runMessage.ts` (new), `bimopenflow/web/packages/app/test/runMessage.test.ts` (new), `bimopenflow/web/packages/app/test/topbar.test.ts` (new) | C8; TKT-26 C6 and TKT-11 C8 committed | `npm test -w @bimopenflow/app && npm run typecheck -w @bimopenflow/app` | as C9; not concurrent with any chunk that edits `app.ts` |
| C11 | Document Run from the editor, the run summary, and the evidence package | `docs/DEMOS.md`, `src/flow/BimOpenFlow.Host.Api/README.md`, `src/flow/BimOpenFlow.Evidence/README.md`, `src/flow/BimOpenFlow.Nodes.Effects/README.md` | C5, C6, C7, C9, C10; TKT-26 C3 committed (same README) | `node gates/web-smoke.mjs`, plus the manual session under Evidence | host on its default port for the manual check |

**What each chunk must test:**

- **C1:** a record whose `recordedOutputs` holds a `RelationValue` renders without throwing and shows its text. The existing verdict tests still pass.
- **C2:**
  - Host.Tests: the `SourceFiles` example under Signatures, for `ReadTable`, `ReadCsv` (existing file), a filter plan (`[]`), and an unknown source (`[]`).
  - Host.Api.Tests: a hand-built `EvalSnapshot`, where `src` is Ok with a `RelationValue`, together with a fake `IRelationResults` that returns a temp file, gives `RunInput("src", "source", sha256(file), file)`. With `relations` null, the result equals the document overload's.
- **C3:**
  - The `RunEffects.Of` examples: path, targetPath, failed, and not recorded.
  - A POST over `TestGraphs.ConstEffect()` returns `effects == [{nodeId:"e", status:"Ok"}]` with no path. `listRuns` returns the same effects for that file.
  - The existing `RunAndSseTests` pass unchanged.
- **C4:**
  - A POST over `ConstEffect` returns an `evidencePath` that exists and ends `.evidence.zip`. The name stem equals the record's stem.
  - `EvidencePackage.Verify` is Ok. The manifest's `files` keys are exactly `graph.dfg.json`, `run.run.json`, and `report.html`, and `graphHash` equals the summary's.
  - A second POST gives a new `fileName`, the same `graphHash`, a second package, and leaves the first package's bytes unchanged.
  - A store whose runs folder already holds a directory at the package path gives 200 with `evidenceError` set and the record archived.
- **C5:** build an `AnalysisStore` in a temp folder and save the showcase document into it. Point `report.path` into the temp folder; `Document(...)` rewrites the other paths the same way `ShowcaseGraphTests` does. Then call `new AnalysisRuns(catalog, store, Fixture.Registry(Fixture.Runtime), sessions, new RelationHostResults(Fixture.Runtime)).Create(...)`. Assert:
  - the report file exists and contains 14 rows;
  - the summary's `report` effect path equals it;
  - the record's inputs include `model/path`, `entities/source`, and `parameters/source`, with the SHA-256 of the IFC and of the Duplex DuckDB;
  - `Verify` passes, and the `report.html` member contains the graph hash;
  - `nrc-enrich-run` through the same path writes `targetPath` in the temp folder, and its effect path is that file.
- **C6:** as specified in Acceptance criteria. Compose the graph by loading the `duckdb-door-schedule` entry from `samples/duckdb-analyses/workflows.json`, replacing `{DUCKDB}`, and adding `xlsx` (`sink.exportXlsx`, `path` in a temp folder) connected `answer.table` to `xlsx.in`. Use `HostComposition.TablePacks()`. Assert 142 data rows with ClosedXML or by reading the summary's `rowCount`. Skip with `Assert.Ignore("Snowdon export not found at <path>; set BOF_DUCKDB or run npm run duckdb:prepare --prefix bimopenflow/web")`.
- **C7:** through `McpServer.HandlePost` `tools/call`, `createRun` on a graph with a `sink.exportCsv` writes the CSV and returns `effects[0].path` and an `evidencePath`. The tool description says it performs a Run. The document overload of `RunInputs.Derive` is gone and the solution builds.
- **C8:** the two `runAnalysis` examples. `applyRun` sets `lastRun`. `setDocument` clears it.
- **C9:**
  - `nodeBadge.test.ts`: the `EffectPending` case now expects "Will write on Run". New cases: Ok with an effects entry expects "Wrote <file>" for both separators; Ok without an entry expects "Ok".
  - `viewModelRun.test.ts`: a store with a report node Ok and a `lastRun` gives a `CanvasNode.badge.text` of "Wrote dc-w1-verdicts.html".
- **C10:**
  - `runMessage`: the Duplex example, a failed sink (kind "error"), and a missing package with `evidenceError`.
  - `topbar`, under jsdom: `setRunning(true)` disables Run and shows "Running…", and `setRunning(false)` restores it.
- **C11:**
  - `DEMOS.md` gains a "Run from the editor" row: which page, which graph, what appears where.
  - The Host.Api README describes the summary and the package location.
  - The Evidence README says the host builds a package on every Run.
  - The Effects README states the summary path convention and `RunEffects.PathColumns`.
  - The web smoke gate passes.

**Parallel plan:**
- **Wave 1:** C1 and C2. Their fences are disjoint, but both are C# builds, so the supervisor may run them one after the other.
- **Wave 2:** C3, once TKT-26 C1 and C3 are committed.
- **Wave 3:** C4 (C#) beside C8 (web).
- **Wave 4:** C5 and C6 in turn (C# build lock), beside C9 and C10 (web, disjoint fences). C10 waits for TKT-26 C6 and TKT-11 C8.
- **Wave 5:** C7, after TKT-26 C4.
- **Wave 6:** C11.

Baseline gates (2026-09-26, before any change):
- Web, run through vitest:
  - `npx vitest run --root packages/state`: 5 files, 51 passed.
  - `npx vitest run --root packages/api-client`: 1 file, 21 passed.
  - `npx vitest run --root packages/app`: 38 files, 261 passed.
- C# tests were not run by the planner, because TKT-26's builder was compiling `Host.Api` at the time. TKT-26's plan records earlier the same day: `Host.Api.Tests` 34 passed (35 after TKT-26 C1), `Host.Tests` 25 passed, `BimOpenMcp.Flow.Tests` 25 passed. `NrcWorkflows.Tests` (55 after TKT-32), `Reports.Tests`, `Host.Store.Tests`, and `Layering.Tests` (8) have no recorded baseline here; the first builder should run them before changing anything.

## Build log
| Id | Commit | Result |
|---|---|---|
| C2 | 70d4faf | Host.Api.Tests 42 pass, Host.Tests 30 pass (counts include other builders' new tests); fence respected (5 files). Document overload of RunInputs.Derive stays until C7. |
| C1 | 2a0348d | Reports tests 12 pass (11 before); fence respected (3 files). EvidenceHtml already labelled by ValueKind, so only ScalarText changed. |

## Review findings

## Debt and extension points

## Report
