# Agent in the open graph

Status: building
Request: TKT-26. The studio tells the host which analysis is open, which nodes are selected, and the last evaluation, through a small session record that the editor keeps current. Every bimopenflow MCP tool that takes an analysis id also works without one and uses the open analysis. A new `getSession` tool returns the id, the selection, and the last result. The Ask box sends the open analysis and the selection with every request, so "add a chart to this" needs no id. `scripts/demo-bim-flow-mcp.mjs` gains a case that edits the open graph without naming it, and the edit reaches the open editor without a reload. TKT-17 owns making the edit arrive selected and reviewable. This plan serves workflow 2 and principle 7 of `PROJECT.md`.

Open questions (each has a default the plan builds on; the supervisor took every default on 2026-09-26 and the ticket's fence now lists the chunk table's paths):
1. **The fence is incomplete.** The ticket fence leaves out paths the work cannot avoid: `contracts/contracts.json`, `contracts/generate.mjs` and `contracts/generated/csharp/**` (the contract source and its C# output), `tests/flow/BimOpenFlow.Host.Api.Tests/**`, `tests/mcp/BimOpenMcp.Flow.Tests/**`, `tests/studio/BimOpenFlow.Studio.Tests/**`, `src/studio/BimOpenFlow.Studio/AskEndpoint.cs` (acceptance criterion 3 lives there), and `src/flow/BimOpenFlow.Host.Store/AtomicFile.cs` (one word). Also, the glob `src/**/Host/**` matches no folder, because the host projects are named `BimOpenFlow.Host*`. Default: extend the fence to exactly the paths in the chunk table.
2. **Who makes the editor reload a document another process changed.** The host will push the update, but the editor has no code to act on it. TKT-17's first criterion is exactly this, and TKT-17 fences `state/**`. Default: TKT-17 builds it on the contract this plan adds (see Extension points, item 1). Override: add a chunk here that edits `bimopenflow/web/packages/state/src/sync.ts` and `state/test/sync.test.ts`.
3. **TKT-33 edits the same files.** It changes `contracts/contracts.json`, the generated files, `ApiMapping.cs`, and `EvalEndpoints.cs`. Default: C1 and C3 never run at the same time as TKT-33's contract or stream chunks. Whichever lands second reruns `node contracts/generate.mjs`.

## Brainstorm
skipped

## Acceptance criteria

Workflow 2's Done line and success bullet: "the agent knows the open graph and the selection without being told", and "a follow-up such as 'add a chart to this' edits the open graph without naming it". Its existing Done line must still hold: `scripts/demo-bim-flow-mcp.mjs` exits 0 with 142 rows.

- **Session endpoints.** `PUT /api/session` with `{"analysisId":"agent-door-schedule","selection":["answer"]}` returns 200 and the stored record with `updatedUtc` set. `GET /api/session` returns the same record.
  - The record is one file per store: `.editor-session.json` at the store root. The stdio MCP server, a separate process on the same `--store`, reads the value the host wrote.
  - An analysis id that is not a lowercase slug returns 400. An absent or empty `analysisId` means no analysis is open.
  - Starting the host clears the record.
- **The editor keeps the record current.** Every page built on `createApp` (the DuckDB studio, the 3D page, the showcase) sends `putSession` in three cases: when it opens an analysis, 250 ms after the selection stops changing, and when its tab becomes visible again. It sends only when the record changed, except on the visibility case. The selection holds only ids of nodes in the open document.
- **"Last evaluation" is derived, not sent.** It is the host's own standing evaluation of the open analysis, which is the same `EvalUpdate` the editor already displays, so the editor does not send it back. Every `EvalUpdate` from the state endpoint and the event stream now carries `graphHash`, the hash of the document it evaluated.
- **The id becomes optional.** Every bimopenflow MCP tool that takes `id` (or its alias `analysisId`) also works without it and uses the record's `analysisId`. That covers getAnalysis, saveAnalysis, addNode, connect, setParam, removeNode, editGraph, evaluate, getResult, listRuns, and createRun. An explicit id always wins. With no id and no open analysis, the tool fails with a message that names `getSession` and `listAnalyses`.
- **getSession.** It returns `analysisId`, `selection`, `updatedUtc`, and `evaluation` in the same shape as the `evaluate` tool. With nothing open, it succeeds with `analysisId` null, an empty selection, and a note.
- **The Ask box sends the open graph.** Every request body carries `open: {analysisId, selection}`. With **follow-up** ticked, the request also carries `analysisId` equal to the open analysis, so it edits whatever graph is open, not only the last one Ask built.
  - The per-request prompt names the open graph and the selected nodes, and says that "this" means the selected nodes.
  - The Ask agent is not offered `getSession`, because the prompt already carries the same facts.
  - `scripts/ask-bim-flow.mjs`, which sends `{request}` or `{request, analysisId}`, behaves as before.
- **Edits from other processes reach the stream.** When another process saves an analysis that an editor is streaming, the host's event stream delivers an update with the new `graphHash` and the new node set within 2 s. No page reload or new request is needed.
- **Demo case.** After its door schedule, `scripts/demo-bim-flow-mcp.mjs` does the following:
  - starts the built studio host on the same store;
  - sets the session to `agent-door-schedule` with `answer` selected;
  - opens the event stream;
  - over MCP, calls `getSession`, then `editGraph`, `evaluate`, and `getResult` with no id, adding a doors-per-storey `table.aggregate` and a `chart.bar` fed from the selected node;
  - asserts that the chart's counts sum to 142 on Snowdon;
  - asserts that the stream carried the new `graphHash` with the `chart` node.
- **Excluded:**
  - The editor reloading the changed document, selecting the changed nodes, one-step undo, and the review list: TKT-17 (open question 2).
  - A per-node Evaluating state: TKT-33.
  - Several editors, each with its own session, and authentication (out of scope in `PROJECT.md`).
  - The Ask agent itself falling back to the session: it keeps passing explicit ids, because a person may switch graphs during a request.
  - Clearing the session when a tab closes.

Evidence: the demo prints, and ends with `OK`, lines like these:

```
Agent (no id): what is open?
  → getSession()   agent-door-schedule, selected: answer
  → editGraph(edits=[...])
  → evaluate()     9 nodes Ok
  → getResult(nodeId="chart", port="table")   N storeys, 142 doors
  stream: graphHash <new hash> with node chart arrived 1.1 s after the edit
```

Kill criteria: none for the feature. If the demo shows that the MCP server and the studio routinely run over different store folders, switch the session transport to HTTP (see Considered and rejected, item 1).

## Design

**What exists today.** `bimopenflow-duckdb` in `.mcp.json` is its own stdio process. It builds its own `HostServices` and `AnalysisSessions` over `artifacts/bim-flow-duckdb/store`, the same folder that `duckdb:host` (the studio) is given. The two processes share nothing but that folder.

The host's `AnalysisSessions` reloads a document when the file's stamp (length and write time) changes, but only when something asks: `Snapshot`, `Subscribe`, or `Run`. An editor sitting on the event stream never asks, so a write from MCP stays invisible until a reload. That is the "needs a reload" in workflow 2's Today line. `EvalUpdate` has no document hash either, so even a pushed update could not tell the editor that the document changed.

In the Ask endpoint, `analysisId` continues a graph, but the Ask box sends only the id of the last graph Ask built (`lastAskId` in `duckdbDemo.ts`), never the open one.

**The session record is the contract; the store folder is the rendezvous.** There is one generated type, `EditorSession {analysisId?, selection, updatedUtc?}`, and three clients of it:

1. The app writes it through the generated `putSession`.
2. The host serves and persists it through a new `EditorSessions` class in `BimOpenFlow.Host.Api`, which writes `<store>/.editor-session.json` atomically. `AnalysisStore.List` enumerates only folders, so it ignores the file.
3. The MCP tools read it through the same class over the same store, reached as `s.Host.Editor`. No new configuration is needed: the MCP server already has to share the store for its edits to reach the studio at all.

The Ask endpoint is a fourth client. It reuses `EditorSession` as the `open` field of its request body, scoped to that request.

**Settled defaults for the supervisor's questions:**

- **One record per host store, not keyed by client.** The last editor to report wins, and a tab that becomes visible reports again. Multi-user work is out of scope, and an MCP client has no way to name a browser tab.
- **The MCP server reads a file, not HTTP.** `bimopenflow-duckdb` is started by `.mcp.json` as `dotnet bimopenmcp-flow.dll --profile tables --store artifacts/bim-flow-duckdb/store ...`. It knows no host URL, and the host is often not running.
- **"Last evaluation" is the evaluation summary the event stream already sends,** computed by whoever reads the record from the stored document, not a run id and not a copy the browser pushes. `getSession` embeds `FlowEvalTools.Evaluate(s, id)`. Runs stay with `listRuns`.
- **Selection is debounced:** 250 ms trailing, deduplicated by value, with a forced resend when the tab becomes visible. Opening an analysis goes through the same reporter.
- **Tests need no language model:**
  - C# tests use the real Kestrel test server (`ApiTestServer`) for the endpoints and the event stream. A second `EditorSessions` or `AnalysisStore` on the same folder stands in for the other process.
  - The MCP tests call `tools/call` through `McpServer.HandlePost` with no id, as `EditGraphToolTests` already does.
  - Ask prompts are pure functions, tested in `AskPromptsTests`.
  - Web tests use fake `ApiClient` slices and fake timers.
  - The demo script covers the real three-process path with scripted JSON-RPC.

**How an MCP edit reaches the open editor.**

1. MCP saves to the store.
2. The host's event-stream loop, which already wakes every 15 s for keep-alive, also wakes every second. Each time it calls `sessions.Snapshot(id)`, which costs one file stat when nothing changed. A changed stamp makes `Refresh` call `SetDocument`, which runs one evaluation pass and notifies the observers.
3. The stream writes an `EvalUpdate` that carries the new `graphHash`.
4. Missing piece, for TKT-17: `connectAnalysis` in `state/src/sync.ts` must notice a `graphHash` it did not write and re-read the document. Until it does, the node states update, but the editor shows the old nodes.

A second hazard lives in the same place: a dirty editor's autosave rewrites the whole document and would overwrite the agent's edit (last writer wins).

**Libraries.** No new library. The changed libraries are:
- `BimOpenFlow.Host.Api`: `EditorSessions`, `SessionEndpoints`, the stream poll, and `graphHash`.
- `BimOpenFlow.Host.Store`: `AtomicFile` becomes public, so the session file uses the store's one atomic writer instead of a copy.
- `BimOpenFlow.Host`: `HostServices.Editor`, and clearing the record at start.
- `BimOpenMcp.Flow`: the id fallback and `getSession`.
- The generated `@bimopenflow/contracts` and `@bimopenflow/api-client`.

The app gets two small modules, `editorSession.ts` and `askRequest.ts`, and edits `app.ts`, `selection.ts`, and `duckdbDemo.ts`. None of them is in the set that TKT-10 and the TKT-22 fixer hold: `canvasParts.ts`, `viewModel.ts`, `canvasTheme.ts`, `canvasIntents.ts`, `canvasSlots.ts`, `canvasLongSlot.ts`, `slotRegistry.ts`, `slotShared.ts`, and `longValueEditor.ts`.

Retires:
- `lastAskId` in `duckdbDemo.ts`, and with it the rule that the follow-up box continues only the last graph Ask built. It now continues the open graph.
- `required: true` on the `id` of every analysis-taking tool.
- Nothing else becomes dead.

## Considered and rejected

1. **The MCP server reads the session from the host over HTTP.**
   - Reason: `.mcp.json` would need a host URL, and the ports already disagree (workflow 1's Today line). Every tool would also fail whenever the studio is not running. The store folder is already the one thing both processes must share for edits to show up.
   - Would change if: the MCP server and the host run on different machines, or the demo shows they routinely use different store folders.
2. **Run the MCP server inside the studio host process.** One `AnalysisSessions` would push edits with no polling.
   - Reason: Claude Code launches stdio servers from `.mcp.json` on its own, and Claude Code users often have no studio running. This is a larger change than the ticket.
   - Would change if: the studio becomes the only entry point and Ara3D.MCP can mount its HTTP transport on the host's Kestrel server (Extension points, item 6).
3. **Key the session by a client id.**
   - Reason: `PROJECT.md` puts multi-user work out of scope, and an MCP client cannot tell which browser tab it means. Last writer wins, plus a resend when a tab becomes visible, covers two tabs on one machine.
   - Would change if: two editors open at once becomes a supported workflow.
4. **The browser pushes the last evaluation, either a copy of `EvalUpdate` or a run id.**
   - Reason: the host produced that evaluation from the same stored document, and the MCP process recomputes it deterministically. A browser copy duplicates state and goes stale. A run id names something rare: runs happen only on Run, while the standing evaluation is what the person sees.
   - Would change if: the editor shows results the host cannot recompute, such as client-side filtering in a pane.
5. **Watch the store folder with `FileSystemWatcher` instead of polling in the stream loop.**
   - Reason: the watcher drops events under load and needs its lifetime managed across analyses. A poll costs one stat per open stream per second, and nothing when no stream is open.
   - Would change if: dozens of streams are open at once.
6. **The Ask endpoint reads the host's session record instead of request fields.**
   - Reason: a person can switch graphs while a request runs, so the request must carry what was open when it was sent. Scripts can also send it explicitly.
   - Would change if: Ask gains a mode with no page behind it.
7. **Make `EvalUpdate.graphHash` required.**
   - Reason: `state/test/reducer.test.ts` builds `EvalUpdate` literals, and that file belongs to tickets holding `state/**`. Optional costs nothing, because the host always sends it.
   - Would change if: TKT-17 or TKT-33 touches those tests anyway (Extension points, item 7).

## Signatures and contracts

Not compiled: the planner has no write access. C1's generator run and C2's build are the first compile, and a mismatch there goes back to the supervisor.

`contracts/contracts.json` (additions; C1 owns them):

```json
"EditorSession": { "analysisId": "string?", "selection": "string[]", "updatedUtc": "string?" },
"EvalUpdate":    { "analysisId": "string", "nodes": "NodeState[]", "graphHash": "string?" },

{ "name": "getSession", "method": "GET", "path": "/api/session", "response": "EditorSession" },
{ "name": "putSession", "method": "PUT", "path": "/api/session", "body": "EditorSession", "response": "EditorSession" }
```

`contracts/generate.mjs`: a `body` other than `"text"` names a contract type. The TypeScript argument becomes `body: <Type>`, sent as `JSON.stringify(body)` with `content-type: application/json`.

Generated output:

```csharp
public sealed record EditorSession(string? AnalysisId, IReadOnlyList<string> Selection, string? UpdatedUtc);
public sealed record EvalUpdate(string AnalysisId, IReadOnlyList<NodeState> Nodes, string? GraphHash);
// ApiRoutes.GetSession = "/api/session"; ApiRoutes.PutSession = "/api/session";
```

```ts
export interface EditorSession { analysisId?: string | undefined; selection: string[]; updatedUtc?: string | undefined; }
// ApiClient
async getSession(): Promise<EditorSession>;
async putSession(body: EditorSession): Promise<EditorSession>;
```

`src/flow/BimOpenFlow.Host.Api/ApiMapping.cs` (C1):

```csharp
public static EvalUpdate ToEvalUpdate(this EvalSnapshot snapshot, string analysisId)
    => new(analysisId, /* nodes as today */, snapshot.Document.ComputeGraphHash());
```

`src/flow/BimOpenFlow.Host.Api/EditorSessions.cs` (C2):

```csharp
/// <summary>The editor session record: which analysis the editor shows and which nodes are
/// selected. One per store, kept as a JSON file at the store root, so another process on the
/// same store (the stdio MCP server) reads what the host wrote.</summary>
public sealed class EditorSessions(AnalysisStore store)
{
    public const string FileName = ".editor-session.json";
    public static readonly EditorSession None = new(null, [], null);
    public string FilePath => throw new NotImplementedException();
    /// <summary>The stored record; None when the file is missing or unreadable. Never throws for I/O.</summary>
    public EditorSession Read() => throw new NotImplementedException();
    /// <summary>Validates the id (AnalysisId.IsValid; empty means none), drops duplicate and empty
    /// selection ids, stamps UpdatedUtc, writes atomically, and returns what was stored.</summary>
    public EditorSession Write(EditorSession session, DateTimeOffset now) => throw new NotImplementedException();
    public void Clear() => throw new NotImplementedException();
}
```

Example: `Write(new("agent-door-schedule", ["answer", "answer"], null), 2026-09-26T10:00Z)` writes `{"analysisId":"agent-door-schedule","selection":["answer"],"updatedUtc":"2026-09-26T10:00:00.000Z"}`, and a second `EditorSessions` over a new `AnalysisStore` on the same folder reads it back. `Write(new("Bad Id", [], null), now)` throws `ArgumentException`, which the endpoint turns into a 400.

`src/flow/BimOpenFlow.Host.Api/SessionEndpoints.cs` (C2):

```csharp
internal static class SessionEndpoints
{
    /// <summary>GET and PUT ApiRoutes.GetSession/PutSession; the PUT body is parsed with ApiJson.Options, and malformed JSON or a bad id returns a 400 ApiError.</summary>
    public static void MapSessionEndpoints(this IEndpointRouteBuilder app, EditorSessions editor) => throw new NotImplementedException();
}
```

Changed signatures (C2):

```csharp
// ApiServer
public static WebApplication Create(ModelCatalog catalog, AnalysisStore store, INodeRegistry registry,
    FileTableProbe? fileTables = null, string[]? args = null, IRelationResults? relations = null,
    AnalysisSessions? sessions = null, EditorSessions? editor = null);
public static IEndpointRouteBuilder MapBimOpenFlowApi(this IEndpointRouteBuilder app, ModelCatalog catalog,
    AnalysisStore store, INodeRegistry registry, FileTableProbe? fileTables = null,
    IRelationResults? relations = null, AnalysisSessions? sessions = null, EditorSessions? editor = null);
// HostComposition.cs
public sealed record HostServices(ModelCatalog Catalog, AnalysisStore Store, NodeRegistry Registry,
    RelationRuntime Relations, AnalysisSessions Sessions, EditorSessions Editor);
// HostRunner.RunAsync: host.Services.Editor.Clear() before StartAsync.
// BimOpenFlow.Host.Store/AtomicFile.cs: internal -> public.
```

`EvalEndpoints.cs` (C3):

```csharp
/// <summary>How often an open event stream checks the store for a document another process wrote.</summary>
public static readonly TimeSpan ExternalWritePoll = TimeSpan.FromSeconds(1);
```

In `StreamEvents`, the wait becomes `WhenAny(pending, Delay(ExternalWritePoll))`. On timeout it calls `sessions.Snapshot(id)`, which reloads and notifies when the stamp changed. A keep-alive comment still goes out once 15 s have passed since the last write. A `FileNotFoundException`, meaning the analysis was deleted, ends the stream.

Example: open `/api/analyses/sse-ext/events`, then save a document with one more node through `new AnalysisStore(root).Save("sse-ext", doc)`. The next `data:` line arrives within 2 s, with `graphHash == doc.ComputeGraphHash()` and one more entry in `nodes`.

`src/mcp/BimOpenMcp.Flow/FlowToolArgs.cs` (C4):

```csharp
/// <summary>Schema fragment: 'id' is optional; omitted means the analysis open in the studio.</summary>
public static McpSchemaBuilder Analysis() => throw new NotImplementedException();
/// <summary>'id', else the alias 'analysisId', else the editor session's analysis; throws
/// ArgumentException naming getSession and listAnalyses when none of them is set.</summary>
public static string AnalysisId(this McpToolArgs args, FlowServices s) => throw new NotImplementedException();
```

Examples:
- Arguments `{}` with the session on `agent-door-schedule` give `"agent-door-schedule"`.
- Arguments `{"id":"x"}` give `"x"`.
- Arguments `{}` with no session throw "No 'id' was given and the studio has no analysis open. Pass 'id' (listAnalyses names them), or call getSession."

`src/mcp/BimOpenMcp.Flow/FlowSessionTools.cs` (C4):

```csharp
/// <summary>What the person is looking at: the editor session plus the standing evaluation of its analysis.</summary>
public static class FlowSessionTools
{
    public static McpServer RegisterSessionTools(this McpServer mcp, FlowServices s) => throw new NotImplementedException();
    public static object GetSession(FlowServices s) => throw new NotImplementedException();
}
```

Example: `GetSession` returns `{ analysisId: "agent-door-schedule", selection: ["answer"], updatedUtc: "...", evaluation: <FlowEvalTools.Evaluate(s, id)> }`. With nothing open, it returns `{ analysisId: null, selection: [], note: "No analysis is open in the studio." }`. It registers with next-tool hints `["getResult", "editGraph"]`, and `FlowMcpServer.RegisterTools` adds `.RegisterSessionTools(services)`.

`src/studio/BimOpenFlow.Studio/AskEndpoint.cs` (C5):

```csharp
public sealed record AskRequest(string Request, string? AnalysisId = null, EditorSession? Open = null);
// AskEndpoint.HiddenTools gains "getSession".
public static class AskPrompts
{
    /// <summary>One line naming the open graph and its selected nodes, or "" when nothing is open.</summary>
    public static string OpenContext(EditorSession? open) => throw new NotImplementedException();
    public static string User(string request, string analysisId, EditorSession? open = null) => throw new NotImplementedException();
    public static string FollowUp(string request, string analysisId, bool resumed, EditorSession? open = null) => throw new NotImplementedException();
}
```

Example: `OpenContext(new("agent-door-schedule", ["answer"], null))` gives "Open in the studio: agent-door-schedule, with answer selected. 'This' in the request means the selected nodes." `OpenContext(null)` gives "".

`bimopenflow/web/packages/app/src/editorSession.ts` (C6):

```ts
import type { EditorSession } from "@bimopenflow/contracts";
export interface SessionApi { putSession(body: EditorSession): Promise<unknown>; }
export const SESSION_DEBOUNCE_MS = 250;
export interface SessionReporter {
  /** Queues the session; sends it once reports have been quiet for the debounce, and only if it differs from the last one sent. */
  report(session: EditorSession): void;
  /** Sends the latest session now, even if unchanged (the tab became visible). */
  flush(): void;
  dispose(): void;
}
export function createSessionReporter(api: SessionApi, options?: { debounceMs?: number; onError?: (e: unknown) => void }): SessionReporter {
  throw new Error("not implemented");
}
```

Example: `report({analysisId:"a", selection:["x"]})` followed within 250 ms by `report({analysisId:"a", selection:["x","y"]})` produces one `putSession({analysisId:"a", selection:["x","y"]})`. The same report again produces nothing, and `flush()` sends it again. A failed PUT (an old host answers 404) goes to `onError` and is retried at the next change.

`app/src/selection.ts` (C6):

```ts
/** The selected ids that are nodes of the open document, in selection order. */
export function selectedNodeIds(state: State): string[] { throw new Error("not implemented"); }
```

Example: selection `["n1","ghost"]` over nodes `[n1]` gives `["n1"]`.

`app/src/app.ts` (C6): `App` gains `session(): EditorSession`. `createApp` creates one reporter over `api`. It reports on `openAnalysis`, on store changes where `selectedNodeIds` or `currentId` changed, and calls `flush()` on `visibilitychange` to visible. `dispose()` disposes the reporter.

`bimopenflow/web/packages/app/src/askRequest.ts` (C7):

```ts
import type { EditorSession } from "@bimopenflow/contracts";
export interface AskBody { request: string; analysisId?: string; open?: EditorSession; }
/** The POST /api/ask body: always the open graph as context; with followUp, also the graph to continue. */
export function askBody(request: string, followUp: boolean, open: EditorSession | null): AskBody { throw new Error("not implemented"); }
```

Examples:
- `askBody("add a chart to this", true, {analysisId:"agent-door-schedule", selection:["answer"]})` gives `{request, analysisId:"agent-door-schedule", open:{...}}`.
- With `followUp` false, it gives `{request, open:{...}}`.
- With `open` null, it gives `{request}`.

## Extension points

1. **Editor reloads a document it did not write (TKT-17, open question 2).** `connectAnalysis` keeps `serverHash`, taken from `getAnalysisState().graphHash` on connect and from each `putAnalysis` response's `AnalysisSummary.graphHash`. When an `EvalUpdate.graphHash` differs from it, while the document is not dirty and no PUT is in flight, it calls `getAnalysis` and dispatches `setDocument`. TKT-17 then adds selecting the changed nodes, one undo step, and the review list. The dirty-autosave overwrite hazard belongs to the same place.
2. **One session per client**, keyed by a tab id, if two live editors become a workflow.
3. **Clear the session when the tab closes**, with `navigator.sendBeacon` to a POST clear route, since `sendBeacon` cannot PUT.
4. **`getSession` previews the selected node's output**: its column names and first rows, so "what am I looking at" needs no `getResult`.
5. **Remove the second `AnalysisSessions` from `FlowServices`.** `FlowServices(Host, Sessions)` carries a second cache beside `HostServices.Sessions`. In the studio this means Ask edits reach the editor only through the 1 s store poll. Pay it off by building `FlowServices` from `Host` alone and using `s.Host.Sessions`.
6. **The studio host serves MCP over HTTP** in process, so one session cache serves the editor, Ask, and Claude Code.
7. **Make `EvalUpdate.graphHash` required** once `state/test/reducer.test.ts` builds it.
8. **Mention `getSession` in the Claude Code skill.** `.claude/skills/bim-flow/SKILL.md` could tell the agent to call it when the person says "this". Not `working-rules.md`, which is embedded in the Ask prompt, where `getSession` is hidden.

## Chunks

All paths are relative to `C:\Users\cdigg\git\bim-open-toolkit`.

| Id | One-sentence commit | Fence (writes only) | Depends on | Test command | Resources |
|---|---|---|---|---|---|
| C1 | Add the EditorSession contract, the session endpoints to the generated client, and the graph hash on every evaluation update | `contracts/contracts.json`, `contracts/generate.mjs`, `contracts/generated/csharp/BimOpenFlow.Contracts.g.cs`, `bimopenflow/web/packages/contracts/src/index.ts`, `bimopenflow/web/packages/api-client/src/index.ts`, `bimopenflow/web/packages/api-client/test/apiClient.test.ts`, `src/flow/BimOpenFlow.Host.Api/ApiMapping.cs`, `tests/flow/BimOpenFlow.Host.Api.Tests/EvalAndResultTests.cs` | - | `node contracts/generate.mjs && dotnet test tests/flow/BimOpenFlow.Host.Api.Tests && dotnet build src/studio/BimOpenFlow.Studio && cd bimopenflow/web && npx vitest run --root packages/api-client && npx vitest run --root packages/state && npm run typecheck -w @bimopenflow/app` | dotnet build lock (one C# chunk at a time); not concurrent with TKT-33's contract chunk |
| C2 | The host stores the editor session at the store root and serves it at /api/session, cleared on start | `src/flow/BimOpenFlow.Host.Api/EditorSessions.cs` (new), `src/flow/BimOpenFlow.Host.Api/SessionEndpoints.cs` (new), `src/flow/BimOpenFlow.Host.Api/ApiServer.cs`, `src/flow/BimOpenFlow.Host.Api/README.md`, `src/flow/BimOpenFlow.Host.Store/AtomicFile.cs`, `src/flow/BimOpenFlow.Host/HostComposition.cs`, `src/flow/BimOpenFlow.Host/HostRunner.cs`, `tests/flow/BimOpenFlow.Host.Api.Tests/EditorSessionTests.cs` (new), `tests/flow/BimOpenFlow.Host.Tests/CompositionTests.cs` | C1 | `dotnet test tests/flow/BimOpenFlow.Host.Api.Tests && dotnet test tests/flow/BimOpenFlow.Host.Tests && dotnet build src/studio/BimOpenFlow.Studio` | dotnet build lock |
| C3 | The evaluation stream picks up a document another process saved and pushes it within a second | `src/flow/BimOpenFlow.Host.Api/EvalEndpoints.cs`, `src/flow/BimOpenFlow.Host.Api/README.md`, `tests/flow/BimOpenFlow.Host.Api.Tests/ExternalWriteStreamTests.cs` (new) | C1, C2 | `dotnet test tests/flow/BimOpenFlow.Host.Api.Tests` | dotnet build lock; not concurrent with TKT-33's stream chunk |
| C4 | MCP tools default to the analysis open in the studio, and getSession says what is open | `src/mcp/BimOpenMcp.Flow/FlowToolArgs.cs`, `src/mcp/BimOpenMcp.Flow/FlowSessionTools.cs` (new), `src/mcp/BimOpenMcp.Flow/FlowMcpServer.cs`, `src/mcp/BimOpenMcp.Flow/FlowDocumentTools.cs`, `src/mcp/BimOpenMcp.Flow/FlowEditTools.cs`, `src/mcp/BimOpenMcp.Flow/FlowEvalTools.cs`, `tests/mcp/BimOpenMcp.Flow.Tests/**` | C2 | `dotnet test tests/mcp/BimOpenMcp.Flow.Tests && dotnet test tests/studio/BimOpenFlow.Studio.Tests` | dotnet build lock |
| C5 | The Ask endpoint takes the open graph and selection with each request and names them in the prompt | `src/studio/BimOpenFlow.Studio/AskEndpoint.cs`, `tests/studio/BimOpenFlow.Studio.Tests/AskPromptsTests.cs` | C1 | `dotnet test tests/studio/BimOpenFlow.Studio.Tests` | dotnet build lock |
| C6 | The editor reports its open analysis and selected nodes to the host, debounced | `bimopenflow/web/packages/app/src/editorSession.ts` (new), `bimopenflow/web/packages/app/src/selection.ts`, `bimopenflow/web/packages/app/src/app.ts`, `bimopenflow/web/packages/app/test/editorSession.test.ts` (new), `bimopenflow/web/packages/app/test/selection.test.ts` | C1 | `cd bimopenflow/web && npx vitest run --root packages/app && npm run typecheck -w @bimopenflow/app` | app test suite shares the tree with TKT-10 and the TKT-22 fixer; a failure in their files is not this chunk's |
| C7 | The Ask box sends the open graph and selection, and follow-up edits the open graph | `bimopenflow/web/packages/app/src/askRequest.ts` (new), `bimopenflow/web/packages/app/src/duckdbDemo.ts`, `bimopenflow/web/packages/app/test/askRequest.test.ts` (new) | C6, C5 | `cd bimopenflow/web && npx vitest run --root packages/app && npm run typecheck -w @bimopenflow/app` | as C6 |
| C8 | The MCP demo edits the open graph without naming it and sees the edit on the host's stream; the doc describes the session | `scripts/demo-bim-flow-mcp.mjs`, `docs/bim-flow-mcp-demo.md` | C3, C4, C5, C7 | `npm run duckdb:build --prefix bimopenflow/web && npm run duckdb:mcp-build --prefix bimopenflow/web && npm run duckdb:mcp-demo --prefix bimopenflow/web` | port 5297 (`BOF_STUDIO_PORT`); demo store `artifacts/bim-flow-duckdb/store`; private Snowdon export prepared by `duckdb:prepare` |

**What each chunk must test:**

- **C1:**
  - `GET /api/analyses/{id}/state` returns `graphHash` equal to the PUT's `AnalysisSummary.graphHash`.
  - The api-client test's `calls` table gains `getSession` and `putSession`.
  - The "body as JSON" test sends `putSession({analysisId:"a", selection:[]})` as JSON text.
- **C2:**
  - GET before any PUT returns `{"selection":[]}`.
  - PUT then GET round-trips, with `updatedUtc` set.
  - A bad id returns 400.
  - A second `EditorSessions` on the same store folder reads the host's write.
  - `AnalysisStore.List` still ignores the file.
  - `HostComposition.BuildServices(config).Editor` points at `<store>/.editor-session.json`.
- **C3:** the example under Signatures, with a 5 s timeout.
- **C4, through `HandlePost` `tools/call`:**
  - With no session, `evaluate` without an id fails, and the message names `getSession`.
  - After `Services.Host.Editor.Write(...)`, `editGraph` without an id edits that analysis.
  - An explicit id wins.
  - `getSession` returns the id, the selection, and node states.
  - The `id` in the `tools/list` schema is no longer required.
- **C5:**
  - `OpenContext` and `User`/`FollowUp` contain the open id and the selected ids.
  - `HiddenTools` contains `getSession`.
- **C6:**
  - Fake timers: three quick reports produce one PUT; an unchanged report produces none; `flush` resends.
  - `selectedNodeIds` drops ids that are not nodes of the document.
- **C7:** `askBody` for the three examples.
- **C8:**
  - The script fails with the build command if `artifacts/bim-flow-duckdb/studio/bimopenflow-studio.dll` is missing.
  - It spawns the studio with `--profile tables --port 5297` and the demo's store, cache, and models, then waits up to 30 s for `/api/models`.
  - It then runs the demo case in Acceptance criteria, including `getSession` before and after the PUT, and stops the host in `finally`.
  - The doc gains a section on the open graph, a `getSession` row in the tool table, "id optional" in the text, the follow-up semantics, the two-hosts-on-one-store caveat, and the named gap handed to TKT-17.

**Parallel plan.** C1 goes first. The C# chunks C2, C3, C4, and C5 run one at a time, because they rebuild the same `Host.Api` and `obj` folders. The web chunks C6 and C7 run beside them; their fences do not overlap any C# chunk. C8 runs last.

Baseline gates (2026-09-26, before any change):
- `dotnet test tests/flow/BimOpenFlow.Host.Api.Tests`: 34 passed.
- `dotnet test tests/mcp/BimOpenMcp.Flow.Tests`: 25 passed. The first attempt failed to compile with CS2001 on `ColorMaps.cs`, because the TKT-16 C1 commit moved that file mid-build; a rerun passed.
- `dotnet test tests/studio/BimOpenFlow.Studio.Tests`: 38 passed.
- `dotnet test tests/flow/BimOpenFlow.Host.Tests`: 25 passed.
- `npx vitest run` for api-client (18 passed), state (51 passed), and app (38 files, 260 passed).
- The working tree holds other agents' uncommitted edits: `app/src/canvasLongSlot.ts` and its test, `viz/packages/formats/**`, `viz/packages/loaders/src/index.ts`, `tickets/TKT-16.md`, and `.claude/launch.json`.
- The C8 demo was not run as a baseline; it needs the private Snowdon export.

## Build log
| Id | Commit | Result |
|---|---|---|
| C1 | 7fd584c | Host.Api 35, api-client 21, state 51 pass; app typecheck clean; fence respected (8 files). |
| C2 | d1d474a | Host.Api.Tests 42 pass, Host.Tests 30 pass, Studio builds; fence respected (9 files). UpdatedUtc reuses RunTimestamp.Format; ApiServer defaults a null editor store. |
| C6 | 7616295 | editorSession and selection tests pass; app typecheck clean outside TKT-11's in-progress portHover.ts; fence respected (5 files). |

## Review findings

## Debt and extension points

## Report
