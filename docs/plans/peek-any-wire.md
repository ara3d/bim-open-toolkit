# Peek at any wire

Status: building
Request: TKT-11. Hovering or clicking any output port shows the column names and first rows of the table on it, paged from the host. Every table-carrying wire shows its row count, computed as a count aggregate over the upstream plan instead of by materialising the table. The peek never triggers an effect node (PROJECT.md principle 2). Serves W2, whose Done line includes "hovering a wire of the built graph shows its row count", W3, and principle 5 ("every wire can be peeked at"). `docs/proposals/bimopenflow-ux-proposal.md` section 4 item 2 calls this the highest-leverage canvas feature.
Open questions (each has a default that the plan below is built on; the supervisor took every default on 2026-09-26):
1. **Do row counts come with the evaluation update or on demand per wire?** Default: on demand. The client calls `getResult(id, nodeId, port, skip 0, take 0)` once per table-carrying source port after each evaluation update. No contract, host, or api-client change is needed. Override if agents need counts in `getAnalysisState`, or if the per-pass request count becomes a measured problem. The override would add `rowCounts` to `NodeState` (see Considered and rejected).
2. **How does a plan-backed count avoid materialising, and how is a materialised table's count free?** Default: no new code is needed. `EvalEndpoints.GetResult` already branches:
   - A `TableValue` answers `totalRows` from `table.Rows.Count`, so the count is free.
   - A `RelationValue` goes through `RelationHostResults.Slice`, which calls `RelationRuntime.Count` and runs `CompiledQuery.CountSql`, i.e. `SELECT count(*) FROM (<compiled plan>)`. That is `execute(compile(Aggregate(plan, count)))` in SQL form.

   With `take=0` no rows cross the wire. The one extra cost is a cached `LIMIT 0` query in `RelationHostResults.Slice`, recorded as an extension point.
3. **How is the peek shown?** Default: a card drawn on the canvas as a gratify adornment (`addAdorn`) on the node, anchored at the socket. It shows the endpoint, the row and column counts, up to 6 column names, and the first 5 rows. Hover shows it; a click pins it. The inspector and table panes are untouched.
4. **How is hover debounced?** Default: the pointer must rest on one target for 300 ms. Moving to another target restarts the timer, and moving off cancels it. Nothing fires while any pointer button is held (pan, node drag, wire drag). Results are cached per endpoint per evaluation, so hovering the same port again sends no request.
5. **How do the tests prove the peek never runs an effect?** Default: a host test over the real composition. The graph is `rel.csv → rel.filter → rel.materialize → sink.exportCsv`. The test peeks upstream with `take=0` and `take=5`, asks for the sink's own port, then asserts:
   - the sink stays `EffectPending`
   - the CSV file does not exist
   - `GET .../runs` is empty

   A web test asserts that the controller only ever calls `getResult`, and never calls it for a node that is not `Ok`.
6. **Fence extension.** The ticket's fence has no test path. C4 needs one new file, `tests/flow/BimOpenFlow.Host.Tests/PeekHostTests.cs`. Decision: granted. The plan narrows the rest of the ticket's fence: `packages/panes`, `packages/api-client`, `contracts/`, and `src/flow/BimOpenFlow.Host.Api` are not changed.
7. **Shared files.** C8 adds one argument to the `createCanvasEditor` call in `bimopenflow/web/packages/app/src/app.ts`. TKT-12 (Run button) and TKT-26 C6 may also edit `app.ts`, so the supervisor serializes them. C7 is the only chunk that touches `canvasParts.ts`. It makes three edits:
   - it imports `portY`, `SOCKET_GRAB_RADIUS`, and `WIRE_HIT_DISTANCE` from `portGeometry.ts` instead of defining them locally
   - it adds a `rows` prop to the wire, drawn as a label
   - it adds `peekAdorn(model.peek)` to the node's `withExt` list, which is the port hover slot

   No chunk touches `canvasControls.ts`, `canvasSlots.ts`, `slotShared.ts`, the long-editor files, `duckdbDemo.ts`, `sidebar.ts`, `nodeParams.test.ts`, `topbar.ts`, or `hostStatus.ts`.

## Brainstorm
skipped

## Acceptance criteria
Derived from W2's Done line ("hovering a wire of the built graph shows its row count") and principles 2, 3, and 5.

- **Hover a socket.** Resting the pointer for 300 ms on an output socket shows a card anchored beside it. The card has a title (`<nodeId>.<port> · <n> rows · <m> columns`), up to 6 column names plus "+k more columns", and up to 5 rows with cells as text and null shown as `null`. It comes from one request, `getResult(analysisId, nodeId, port, 0, 5)`. Sweeping the pointer across sockets faster than 300 ms sends no request.
- **Hover a wire.** Resting on a wire does the same for the wire's source port.
- **Click to pin.** Clicking an output socket (press and release within 4 px) pins the card. It stays through pan, zoom, and evaluation updates, and is refetched after each update. Pressing anywhere else or pressing Escape closes it.
- **Row count on every table wire.** A wire shows its count as a label at its midpoint (`142 rows`, `1 row`, `456,598 rows`) when its source port is `Table` or `Relation` and its source node's status is `Ok`. Each distinct source port costs one `getResult(..., 0, 0)` request per evaluation update, and no rows are transferred. At most 2 count requests are in flight at once, and a peek request never waits behind them.
- **Stale counts are marked.** After an evaluation update, a wire keeps its previous count, drawn dimmed, until the new count arrives. It is also dimmed while the document has unsaved edits (`state.dirty`).
- **No count without a result.** A wire whose source node is not `Ok` shows no count (principle 3: no stale or invented number).
- **Nodes that are not Ok explain themselves.** Peeking a port on a node whose status is not `Ok` sends no request. The card states the reason:
  - `EffectPending`: "Writes on Run; no rows until the graph runs"
  - otherwise the node's `error`, or its status name
  - no state yet: "Not evaluated yet"
- **Peeking never runs an effect.** After peeking upstream of a sink, the sink stays `EffectPending`, it writes no file, and no run is recorded (C4).
- **Out of scope:** paging inside the card; opening the table pane on a specific port; counts inside `NodeState` or any contract change; a per-graph switch for counts; counts on scalar or `Any` wires (a scalar port's peek shows its one value, because the host already returns scalars as a one-cell slice); peeking from input sockets.

Evidence: In the studio (`/duckdb.html`, tables profile), the door-schedule graph shows `142 rows` on the wire leaving its door table. Hovering that wire's source socket shows a card with the door columns and five doors. The screenshot goes in C8's report. `dotnet test tests/flow/BimOpenFlow.Host.Tests --filter FullyQualifiedName~PeekHostTests` passes, which shows the sink stayed `EffectPending` and wrote no file.
Kill criteria: none for the feature. If counting the relation wires of the Snowdon tables-profile sample graphs takes more than 2 s per evaluation pass on the owner's machine (browser network panel, sum of the take-0 requests), always-on counts for relation wires should be dropped: count those wires on hover instead, and re-plan C1. The peek itself stays.

## Design

**What the host already provides.** The host side of this feature exists. `GET /api/analyses/{id}/results/{nodeId}/{port}?skip&take` (`src/flow/BimOpenFlow.Host.Api/EvalEndpoints.cs`) reads the standing session's snapshot:
- A materialised table's count is `Rows.Count`.
- A relation's count is `RelationRuntime.Count(plan)`, which compiles the plan once and runs `SELECT count(*) FROM (<sql>)` (`src/flow/BimOpenFlow.Relations/Compile/CompiledQuery.cs`, `CountSql`).
- Reading a result can re-evaluate a document that changed on disk (`AnalysisSessions.Refresh`), but that evaluation is pure. Effect nodes run only inside `AnalysisSessions.Run`, which only `POST .../runs` calls.

So a `take=0` page is a count with no rows, a `take=5` page is the peek, and neither can reach an effect. The feature is therefore mostly a client feature. The host work is a test that pins the guarantee (C4).

The client needs four pieces and one extension to the view model. All are new modules in `bimopenflow/web/packages/app/src/`, which keeps the shared canvas files to small, named edits.

- **`portResults.ts`: the controller.** Gratify-free and DOM-free. It holds:
  - a per-evaluation generation counter
  - the row count per source endpoint (`"nodeId.port"`)
  - the one open peek, with its pinned flag

  It asks the host through a `ReadPort` function, the same shape as `PaneContext.requestTable`. It decides from the store's `evalState` whether a port has anything to read (`absentReason`). This is how it avoids 404s and explains nodes that are not `Ok`. It drops a response whose generation is older than the current one. It exposes an immutable `PortResultsView` snapshot for the view model. `watchEvaluations` subscribes to the store and calls `evaluated` whenever `evalState` changes identity.
- **`portGeometry.ts`: socket geometry.** Holds socket positions (`portY`, moved here from `canvasParts.ts` so drawing and hit-testing share one definition) and `peekTargetAt`, which maps a world point to an output socket, else to the source port of a wire. It uses gratify's pure `wireDist`.
- **`portHover.ts`: the DOM listener.** Built on the same pattern as `nodeContextMenu.ts`. It converts canvas pixels to targets through a callback and owns the 300 ms timer, click-to-pin, Escape, and cancellation. It dispatches nothing to the store.
- **`peekCard.ts`: the drawing.** Contains the `PeekCard` gratify part (`hit: () => false`, so panning over it still works), `peekAdorn(view)` (the `addAdorn` extension that places the card beside the peeked socket in the overlay pass), and two pure functions:
  - `peekGrid(view)`: the text the card shows
  - `rowCountText(n)`: the wire label
- **View model extension (`viewModel.ts`).** `buildCanvasModel` gains a fourth optional parameter `results: PortResultsView`. Each `CanvasEdge` gets `rows?: WireRows` looked up by its `from` endpoint, with `current` forced to false while `state.dirty`, and `CanvasModel` gets `peek?: PortPeekView`. Both fields are optional, so the existing test literals and the calls in `app.ts` stay valid. The `sync` intent already replaces the canvas doc with the rebuilt model, so `canvasIntents.ts` does not change.

**Wiring.** `canvasEditor.ts` gains an optional `readPort` argument. When it is given, the editor:
- creates the controller
- calls `watchEvaluations`
- installs `portHover`, with `targetAt` computed from `runtime.viewport` and `runtime.doc` (as the context menu already does)
- passes `results.view()` into `buildCanvasModel`
- calls `sync` from the controller's `onChange`

`app.ts` passes `boundCtx.requestTable`, which already late-binds the open analysis id.

**Where the code lives.** Everything stays in `@bimopenflow/app`. No library is added or changed. `PortResults` could move to `@bimopenflow/state` if a second surface ever needs counts (extension point).

**Worked examples:**
- **`countTargets`.** The graph has `src` (`rel.csv`, Ok, output `relation`), `tall` (`rel.filter`, Ok), `mat` (`rel.materialize`, Ok, output `table`), `out` (`sink.exportCsv`, EffectPending), and an Integer wire `k.out → n.in`. The edges are `src.relation→tall.input`, `tall.relation→mat.input`, `mat.table→out.in`, and `k.out→n.in`. The result is `["src.relation", "tall.relation", "mat.table"]`, in edge order. `k.out` is left out because it is not Table or Relation.
- **Count.** `read("tall", "relation", 0, 0)` resolves `{columns:[id Integer, height Number], rows:[], totalRows:2, skip:0}`. Then `view().counts.get("tall.relation")` is `{rows: 2, current: true}`, and the wire is labelled `2 rows`.
- **Absent.** `hover("out.out", state)` with `out` EffectPending sends no read. The peek is `{kind:"absent", reason:"Writes on Run; no rows until the graph runs"}`.
- **`peekGrid`.** For `{endpoint:"tall.relation", pinned:false, peek:{kind:"ready", slice:{columns:[id, height], rows:[[2,3.0],[3,4.5]], totalRows:2, skip:0}}}` the result is `{title:"tall.relation · 2 rows · 2 columns", columns:["id","height"], rows:[["2","3"],["3","4.5"]], note:null}`.
- **`rowCountText`.** `0 → "0 rows"`, `1 → "1 row"`, `456598 → "456,598 rows"`.
- **`peekTargetAt`.** Node `a` at (80, 80), w 184, one output `out`, no inputs. Its socket is at (264, 80 + 46 + 0.5·24 = 138). `(266, 139)` gives `"a.out"`. `(150, 139)` gives `null` when no wire passes within 8 px.
- **`portHover`.** A pointermove onto `a.out` at t=0, off at t=200 ms, and back at t=250 ms, then resting until t=550 ms, gives exactly one `hover("a.out")`, at 550 ms. `pointerleave` then gives `hover(null)`. The same rest with `buttons=1` gives no call.

Retires: nothing. `portY` and the socket and wire hit distances move from `canvasParts.ts` to `portGeometry.ts` rather than being copied.

## Considered and rejected
- **Option:** The host computes a count for every table output during evaluation and sends it in `NodeState` (a `rowCounts` field in `contracts/contracts.json`).
  **Reason:** `EvalSession` calls its observers from inside the pass, and `AnalysisSessions` holds the session lock during the pass (`SetDocument` under `entry.Lock`; `EvalSession.cs` line 96 loops over the observers). DuckDB counts there would slow every pass, including MCP-only sessions that nobody draws. It would also need changes to contracts, regenerated C# and TypeScript, Host.Api, and `RelationHostResults` in `BimOpenFlow.Host`, which is outside the fence.
  **Would change if:** agents need counts in `getAnalysisState`, or measured client requests per pass become a cost (for example, more than 30 table wires in a real graph).
- **Option:** A dedicated count endpoint (`GET .../results/{nodeId}/{port}/count`) and `IRelationResults.Count`.
  **Reason:** `getResult` with `take=0` already returns `totalRows` from the same count query and no rows. A second endpoint repeats it (principle 4) and costs a contracts regen plus a Host change.
  **Would change if:** a profile shows the cached `LIMIT 0` query that `RelationHostResults.Slice` runs next to the count is significant.
- **Option:** Build a literal `Aggregate(plan, [], [Count])` plan node for the count, as the proposal's table reads.
  **Reason:** `CompiledQuery.CountSql` is the same query as DuckDB plans it. A plan-level aggregate adds a schema inference and a common table expression (CTE) and gives the same result.
  **Would change if:** a second compiler backend without subquery support is added.
- **Option:** Show the peek in the inspector or table pane, focused on the hovered port.
  **Reason:** The pane area follows the selection (the `app.ts` store subscription calls `paneArea.showNode`). Hover driving it would rebuild tabs on every sweep and fight the selection, and the pane sits across the screen from the pointer.
  **Would change if:** people need the full paged table for an output that is not the node's first. Click would then also focus the table pane on that port (extension point).
- **Option:** An HTML popover over the canvas.
  **Reason:** It would have to track pan and zoom by hand and would be a second rendering path. A gratify adornment draws in the overlay pass above every node and follows the viewport.
  **Would change if:** people need to select and copy text from the card.
- **Option:** Detect hover inside gratify (read `node.pointer` and `ch.hover` in the adornment).
  **Reason:** An adornment can draw but not dispatch, so the fetch still needs a timer outside gratify. Gratify has no delayed hover-intent interactor.
  **Would change if:** gratify gains a hover interactor that emits an intent after a delay.

## Signatures and contracts
Read-only for every chunk. These were not compiled during planning, because the planner writes no files. C1, C2, C3, and C6 compile them as their first step, and any mismatch goes back to the supervisor.

```ts
// bimopenflow/web/packages/app/src/portResults.ts
import type { NodeDescriptor, TableSlice } from "@bimopenflow/contracts";
import type { State, Store } from "@bimopenflow/state";

/** One page of a node output from the host; PaneContext.requestTable's shape. */
export type ReadPort = (nodeId: string, port: string, skip: number, take: number) => Promise<TableSlice>;

/** Rows a peek card shows and requests. */
export const PEEK_ROWS = 5;
/** Count requests in flight at once; peek requests bypass this queue. */
export const COUNT_CONCURRENCY = 2;

/** A wire's row count; `current` is false while a newer evaluation's count is in flight. */
export interface WireRows { readonly rows: number; readonly current: boolean }

export type PortPeek =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly slice: TableSlice }
  | { readonly kind: "absent"; readonly reason: string };

export interface PortPeekView {
  readonly endpoint: string; // "nodeId.port"
  readonly pinned: boolean;
  readonly peek: PortPeek;
}

/** Immutable snapshot for buildCanvasModel; a new object after every change. */
export interface PortResultsView {
  readonly counts: ReadonlyMap<string, WireRows>; // keyed by source endpoint
  readonly peek: PortPeekView | null;
}

export const NO_PORT_RESULTS: PortResultsView = { counts: new Map(), peek: null };

/** Distinct source endpoints, in edge order, of wires whose source port is Table or
 *  Relation and whose source node's status is Ok. */
export function countTargets(state: State, catalog: ReadonlyMap<string, NodeDescriptor>): string[] {
  throw new Error("not implemented");
}

/** Why the host has nothing for this endpoint, or null when its node is Ok. */
export function absentReason(state: State, endpoint: string): string | null {
  throw new Error("not implemented");
}

export interface PortResults {
  view(): PortResultsView;
  /** New evaluation: bump the generation, mark counts not current, drop counts of
   *  endpoints no longer targeted, re-count the targets, refetch the open peek. */
  evaluated(state: State, catalog: ReadonlyMap<string, NodeDescriptor>): void;
  /** Hovered endpoint or null; ignored while a card is pinned. */
  hover(endpoint: string | null, state: State): void;
  /** Pin the card to an endpoint; null unpins and closes it. */
  pin(endpoint: string | null, state: State): void;
  dispose(): void;
}

export function createPortResults(read: ReadPort, onChange: () => void): PortResults {
  throw new Error("not implemented");
}

/** Calls results.evaluated whenever the store's evalState changes identity. Returns unsubscribe. */
export function watchEvaluations(
  store: Store,
  getCatalog: () => ReadonlyMap<string, NodeDescriptor>,
  results: PortResults,
): () => void {
  throw new Error("not implemented");
}
```

```ts
// bimopenflow/web/packages/app/src/portGeometry.ts
import type { CanvasModel } from "./viewModel.js";

export const SOCKET_GRAB_RADIUS = 12; // moved from canvasParts.ts
export const WIRE_HIT_DISTANCE = 8;   // moved from canvasParts.ts (Wire.hit)

/** World y of the index-th port row of a node whose top is `top`. */
export function portY(top: number, index: number): number {
  throw new Error("not implemented");
}

/** The output endpoint whose socket lies within `radius` of (x, y) in world coords;
 *  else the source endpoint of the wire within WIRE_HIT_DISTANCE; else null. */
export function peekTargetAt(model: CanvasModel, x: number, y: number, radius?: number): string | null {
  throw new Error("not implemented");
}
```

```ts
// bimopenflow/web/packages/app/src/portHover.ts
export const HOVER_DELAY_MS = 300;
export const CLICK_SLOP_PX = 4;

export interface PortHoverDeps {
  /** Endpoint under a canvas-relative CSS-pixel point, or null. */
  targetAt(x: number, y: number): string | null;
  hover(endpoint: string | null): void;
  pin(endpoint: string | null): void;
}

/** Installs pointer and key listeners on the canvas; returns dispose. */
export function installPortHover(canvas: HTMLCanvasElement, deps: PortHoverDeps): () => void {
  throw new Error("not implemented");
}
```

```ts
// bimopenflow/web/packages/app/src/peekCard.ts
import type { PartExt } from "gratify";
import type { PortPeekView } from "./portResults.js";

export const PEEK_COLUMNS = 6;

export interface PeekGrid {
  readonly title: string;                         // "tall.relation · 2 rows · 2 columns"
  readonly columns: readonly string[];            // at most PEEK_COLUMNS
  readonly rows: readonly (readonly string[])[];  // at most PEEK_ROWS; null cells as "null"
  readonly note: string | null;                   // "+k more columns", the absent reason, or "loading…"
}

export function peekGrid(view: PortPeekView): PeekGrid { throw new Error("not implemented"); }
export function rowCountText(rows: number): string { throw new Error("not implemented"); }
/** Adornment for GraphNodePart: draws the card beside the peeked output socket of the
 *  node whose id matches the endpoint; no elements otherwise. */
export function peekAdorn(view: PortPeekView | undefined): PartExt<any> { throw new Error("not implemented"); }
```

```ts
// bimopenflow/web/packages/app/src/viewModel.ts (additions)
export interface CanvasEdge { /* existing fields */ readonly rows?: WireRows }
export interface CanvasModel { /* existing fields */ readonly peek?: PortPeekView }
export function buildCanvasModel(
  state: State,
  catalog: ReadonlyMap<string, NodeDescriptor>,
  preview: string | null = state.selection.at(-1) ?? null,
  results: PortResultsView = NO_PORT_RESULTS,
): CanvasModel;
```

```ts
// bimopenflow/web/packages/app/src/canvasEditor.ts (signature change)
export function createCanvasEditor(
  canvas: HTMLCanvasElement,
  store: Store,
  getCatalog: () => ReadonlyMap<string, NodeDescriptor>,
  onError: (message: string) => void,
  initialTheme: CanvasThemeName = defaultCanvasTheme,
  getPreview: () => string | null = () => store.getState().selection.at(-1) ?? null,
  readPort?: ReadPort, // new; without it the canvas shows no peeks or counts
): CanvasEditor;
```

Host contract relied on, unchanged: `GET /api/analyses/{id}/results/{nodeId}/{port}?skip=0&take=0` returns `TableSlice{columns, rows: [], totalRows, skip: 0}`. It returns 404 when the node is not `Ok`. It never runs an effect.

## Extension points
- Paging inside a pinned card, or a click that also focuses the table pane on that port (today `paneArea.ts` shows `firstTableOutput`).
- A per-graph switch or a row threshold for wire counts, which `table-graph-layers.md` suggests for eager recompute.
- An output hash in `NodeState`, so the client re-counts only ports whose output changed.
- `RelationHostResults.Slice` skips its `LIMIT 0` query when `take` is 0 and reads columns from the schema (`src/flow/BimOpenFlow.Host`).
- A count cache in `RelationRuntime` keyed by plan hash.
- A screen-space card that keeps its size when zoomed out.
- Peeking from input sockets (the upstream value arriving at an input).
- Counts on `Any` ports that carry tables.
- Move `PortResults` to `@bimopenflow/state` if a second surface needs counts.

## Chunks
Paths are relative to the repository root `C:\Users\cdigg\git\bim-open-toolkit`. `app/` below means `bimopenflow/web/packages/app/`. Web commands run from `bimopenflow/web`.

| Id | One-sentence commit | Fence (writes only) | Depends on | Test command | Resources |
|---|---|---|---|---|---|
| C1 | Add the port-results controller: row counts from take-0 pages after each evaluation, one peek per port, and no request for a node that is not Ok | `bimopenflow/web/packages/app/src/portResults.ts`, `bimopenflow/web/packages/app/test/portResults.test.ts` | - | `npm test -w @bimopenflow/app -- portResults` and `npm run typecheck -w @bimopenflow/app` | none |
| C2 | Add port geometry: socket position and the peek hit-test (output socket, else a wire's source port) | `bimopenflow/web/packages/app/src/portGeometry.ts`, `bimopenflow/web/packages/app/test/portGeometry.test.ts` | - | `npm test -w @bimopenflow/app -- portGeometry` and `npm run typecheck -w @bimopenflow/app` | none |
| C3 | Add the port hover listener: a 300 ms rest peeks, a click pins, a held button or leaving the canvas cancels | `bimopenflow/web/packages/app/src/portHover.ts`, `bimopenflow/web/packages/app/test/portHover.test.ts` | - | `npm test -w @bimopenflow/app -- portHover` (jsdom, fake timers) and `npm run typecheck -w @bimopenflow/app` | none |
| C4 | Pin the peek's host contract: take-0 pages count without rows, and peeking upstream of a sink leaves it EffectPending with no file and no run | `tests/flow/BimOpenFlow.Host.Tests/PeekHostTests.cs` (fence extension, open question 6) | - | `dotnet test tests/flow/BimOpenFlow.Host.Tests --filter FullyQualifiedName~PeekHostTests` | Kestrel on port 0 and a temp directory, both from the test's own fixture |
| C5 | The canvas view model carries each wire's row count and the open peek | `bimopenflow/web/packages/app/src/viewModel.ts`, `bimopenflow/web/packages/app/test/viewModelPeek.test.ts` | C1 | `npm test -w @bimopenflow/app -- viewModel` and `npm run typecheck -w @bimopenflow/app` | none |
| C6 | Add the peek card part and adornment, with its grid and row-count text as pure functions | `bimopenflow/web/packages/app/src/peekCard.ts`, `bimopenflow/web/packages/app/test/peekCard.test.ts` | C1, C2 | `npm test -w @bimopenflow/app -- peekCard` and `npm run typecheck -w @bimopenflow/app` | none |
| C7 | The canvas draws each wire's row count and the peek card at its port | `bimopenflow/web/packages/app/src/canvasParts.ts`, `bimopenflow/web/packages/app/test/canvasPeek.test.ts` | C2, C5, C6 | `npm test -w @bimopenflow/app` and `npm run typecheck -w @bimopenflow/app` | `canvasParts.ts` is shared: the supervisor serializes it against any other ticket's chunk on that file |
| C8 | Connect the controller and hover listener to the canvas editor, and pass the host reader from the app | `bimopenflow/web/packages/app/src/canvasEditor.ts`, `bimopenflow/web/packages/app/src/app.ts`, `bimopenflow/web/packages/app/README.md` | C1, C3, C5, C7 | `npm test -w @bimopenflow/app`, `npm run typecheck -w @bimopenflow/app`, `npm run build -w @bimopenflow/app`, then `node gates/web-smoke.mjs` from the repo root | `app.ts` is shared with TKT-12 and TKT-26 C6: serialize. The evidence screenshot needs a running host and the `/duckdb.html` studio (ports 5218 and the app's dev port) |

Parallel waves: {C1, C2, C3, C4}, then {C5, C6}, then C7, then C8. The fences within each wave are disjoint.

What each chunk's tests must show:
- **C1:**
  - `countTargets` matches the worked example.
  - Each target is read once, with `take` 0.
  - A second `evaluated` marks counts not current until the new responses land.
  - A response from an older generation is dropped.
  - At most `COUNT_CONCURRENCY` count reads are pending at once, while a `hover` read starts immediately.
  - A node that is not `Ok` gives `absent` with its reason and no read.
  - A rejected read gives `absent` with the error message.
  - Pinning ignores later hovers, and `pin(null)` closes the card.
  - `watchEvaluations` fires on `evalState` changes and not on selection changes.
  - The fake API object has only `getResult`, so nothing else can be called.
- **C2:** the `peekTargetAt` examples above, and that input sockets are not targets.
- **C3:** the timer example above, click-to-pin within `CLICK_SLOP_PX`, a press elsewhere calls `pin(null)`, Escape calls `pin(null)`, and dispose removes every listener.
- **C4:**
  - `tall.relation?take=0` returns 0 rows and `totalRows` 2, with columns `id, height`.
  - `mat.table?take=0` returns 0 rows and `totalRows` 2.
  - `mat.table?take=5` returns 2 rows.
  - `out/out` returns 404.
  - Afterwards `/state` reports `out` as `EffectPending`, the export path does not exist, and `/runs` is `[]`.
  - Reuse the `rel.csv` fixture pattern in `HostHttpTests.TallWalls`.
- **C5:**
  - Edges get `rows` by their `from` endpoint.
  - `current` is false when `state.dirty`.
  - `peek` passes through.
  - Calls without the fourth argument give the same model as before.
- **C6:** the `peekGrid` and `rowCountText` examples; a `loading` note; the absent reason as the note; and `peekAdorn` returns no elements for a node other than the peeked one.
- **C7:**
  - A headless gratify `Runtime` (the same pattern as `test/canvasParts.test.ts`) steps a model with `rows` and `peek` set, with no errors.
  - A wire without `rows` draws as before.
  - The existing `canvasParts.test.ts` and `canvasFlowMotion.test.ts` pass unchanged.
- **C8:**
  - The full app suite and the build stay green.
  - The README "Structure" section gains one line each for `portResults.ts`, `portGeometry.ts`, `portHover.ts`, and `peekCard.ts`.
  - The report attaches the evidence screenshot.

Baseline gates (2026-09-26, before any change):
- `npm test -w @bimopenflow/app`: 38 files, 261 tests passed. The working tree holds another agent's uncommitted edit to `duckdbDemo.ts`.
- `dotnet test tests/flow/BimOpenFlow.Host.Api.Tests --no-build`: 34 passed.
- `dotnet test tests/flow/BimOpenFlow.Host.Tests --no-build`: 25 passed.
- `node gates/web-smoke.mjs`: not run, because it builds and other builders are active in the same checkout.

## Build log
| Id | Commit | Result |
|---|---|---|

## Review findings

## Debt and extension points

## Report
