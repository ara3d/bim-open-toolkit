# The graph editor as a reusable package

Status: planned, 2026-09-28. Wave A can start now; wave B waits on three chunks of TKT-11 and TKT-12 (see Coordination).

Ticket: TKT-94. Request (owner, 2026-09-28): move the canvas out of `packages/app` into its own package with per-instance state and a read-only mode, so that every graph cell in a notebook is a live editor: no fake diagram, shared selection, no iframe. It is a multi-chunk refactor of code that TKT-11, TKT-12, and TKT-26 have claimed, so it is planned around them.

Workflow: 2 in `PROJECT.md` (ask in plain language and get a graph you can inspect). The notebook is that workflow's transcript surface (`docs/plans/notebook.md`), and its graph embeds today are a picture of the graph, not the graph. The package also serves the developer user of the brief, who extends the toolkit with a pane or a viewer feature and today cannot mount the editor anywhere but the studio shell. `docs/graph-module-layering.md` (decision of 2026-08-31) already names the package: `bimopenflow/web/packages/graph`, `@bimopenflow/graph`, a production-strength node-graph editing layer owned by this repository and built on Gratify's primitives.

## What is wrong today

Every module of the canvas lives in `packages/app/src` and several keep page-wide state, so one page can hold one editor:

| Module | Page-wide state |
|---|---|
| `slotShared.ts` | `dispatchIntent`: the one function every island commit goes through, set by the last `createCanvasEditor` |
| `canvasControls.ts` | `islands` (one input element per parameter row), `openDropdowns`, `suggestionProvider`, `columnSelects` |
| `canvasLongSlot.ts` | `editors`, `editorThemeV` (one long-value editor per row) |
| `canvasParts.ts` | `noteEditors`, `noteEditorThemeV` (one editor per `view.note`) |
| `canvasTheme.ts` | `current`: the active canvas theme; and Gratify's own `tokens`, `themes`, and `themeVersion` are process-wide |

A second `createCanvasEditor` on the same page steals the island dispatch from the first, and the two share one row-key space (`nodeId::name`), so a node id used in both graphs makes their inputs collide. `docs/plans/notebook.md` recorded this under Considered and rejected and drew `graphDiagram.ts` instead: 397 lines of layered layout and edge routing that repeat the shape of `autoLayout.ts` and know nothing of status, badges, peeks, or selection.

## Acceptance criteria

Derived from workflow 2's Done line ("every node shows its state and names the upstream cause, selecting a node lights the path that feeds it, and any wire can be peeked at") applied to the notebook, and from the developer user.

1. `@bimopenflow/graph` exists under `bimopenflow/web/packages/graph` with its own tests and README. It depends on `gratify`, `@bimopenflow/state`, and `@bimopenflow/contracts` only; a test in the package fails on any import of `@bimopenflow/app`, `@bimopenflow/panes`, `@bimopenflow/api-client`, or `@bimopenflow/bim-open-notebook`. `gates/web-smoke.mjs` runs its tests.
2. Two editors on one page keep separate state. A headless test mounts two runtimes over two stores with the same node ids; a toggle press in the first dispatches only to the first store; disposing the first leaves the second's islands, editors, and dispatch in place.
3. A read-only editor pans, zooms, hovers, and selects, and nothing changes the document. A headless test drives a wire drag from a socket, a node drag, Delete with a node selected, and a toggle press, and asserts the document is reference-equal before and after, no rubber wire element appears in the tree, and the selection did change on click.
4. The studio is unchanged. App tests and `node gates/web-smoke.mjs` pass. A session in the browser pane on `/duckdb.html` drags a node, wires two ports, edits a parameter, switches theme, and peeks a wire, and the build log records it.
5. Every graph embed in the twelve sample notebooks renders as a live read-only canvas: the focus nodes are selected and their upstream wires lit (the TKT-24 behaviour, for free), node statuses show once the host answers, "Show text" still folds the print, and Re-evaluate all still reports every graph embed current (56 across the nine reconstructed sessions). `graphDiagram.ts` and its tests are deleted.
6. `packages/app/src` no longer holds a canvas module; `app.ts` imports the editor from the package index only. No file under `packages/bim-open-notebook` imports graph code from `@bimopenflow/app/src` (the graph part of TKT-86).

Out of scope: an editable notebook cell (the cell is a read-only instance; see Extension points), a per-instance theme (a Gratify core gap; see Considered and rejected), peeks inside a cell (Extension points), the client library of TKT-86 beyond the graph helpers, and any change to Gratify.

## Design

### The package

`bimopenflow/web/packages/graph`, `@bimopenflow/graph`, a member of the `bimopenflow/web` npm workspace beside `state` and `panes`, with `main` pointing at `src/index.ts` as those do. Its `vite`/`vitest`/`tsc` configuration copies the app's `gratify` alias and the `toolkitAlias`. Layer: above `state` and `contracts`, below `app` and `bim-open-notebook`. It is a library by every test in `LIBRARIES.md`: it can be described without a BIM word ("a node-graph editor over a graph document store"), a second page uses it, it changes at a different rate from the studio shell, and its tests run headless without the application.

The modules move as they are, one file each, keeping their names, so `git log --follow` and the plans that cite them (`peek-any-wire.md`, `remove-properties-panel.md`) stay readable:

| Stays in `app` | Moves to `graph` |
|---|---|
| `app.ts`, `shell.ts`, `styles.ts`, `sidebar.ts`, `topbar.ts`, `toast.ts`, `ids.ts`, `themeChoice.ts` (a preference), `prefs.ts`, the pane and Ask modules, `main.ts`, `graphDemo.ts`, `duckdbDemo.ts`, `showcase.ts` | `autoLayout`, `canvasControls`, `canvasEditor`, `canvasIntents`, `canvasLongSlot`, `canvasParts`, `canvasSlots`, `canvasTheme`, `columnSelect`, `graphPreview`, `graphWidgets`, `longValueEditor`, `nodeBadge`, `nodeContextMenu`, `numericParam`, `paramText`, `peekCard`, `portGeometry`, `portHover`, `portResults`, `selectionBorder`, `slotRegistry`, `slotShared`, `suggestInput`, `suggestText`, `upstreamEdges`, `viewModel`, and each one's test file |

`graphPreview.ts` (`nodeTitle`, `upstreamIds`, `previewAfterEdit`) is pure over a `GraphDocument` and belongs one layer lower, in `state`; it moves to `graph` now because `state/**` is in TKT-12's and TKT-17's fences, and the graph package exports it so `app` and the notebook import it from one place (Extension points).

**Building apart (the owner's direction, 2026-09-28 evening: "figure it out, copy the files out if you have to").** `PLANNING.md` allows a plan to copy code that other work is changing instead of extracting it first. G2 copies the cluster and its tests from commit `3e4a699` into the package and leaves `app/src` untouched, so the Editor UX wave and TKT-12 keep editing the app's copy while the per-instance and read-only work happens in the package. The copy is listed under Planned debt with its payoff, G7: replace every app copy with an import from the package index and re-apply, by hand from `git diff 3e4a699..HEAD -- bimopenflow/web/packages/app/src/<cluster>`, whatever the other tickets changed in between. Until G7, a change to a canvas file in `app/src` is not in the package, and a change in the package is not in the studio; the supervisor re-syncs after each of the other tickets' commits so the diff stays small (the first re-sync is the UX wave's chunk F, which rewrites node drawing into `nodeRender.ts`).

### Per-instance state

One new module, `graph/src/instance.ts`, defines `CanvasInstance`: everything a mounted canvas owns that used to be module-level. `createGraphEditor` creates one and threads it through the view: `canvasView(model, instance)` passes it into every node's `SlotContext` and into the note editor lookup, so a part reads `node.props.instance` (the props are the only thing a Gratify part sees at render, island, and gesture time). The row key stays `nodeId::name`, now scoped by the map it is looked up in.

```ts
// graph/src/instance.ts
import type { SuggestionList } from "@bimopenflow/contracts";
import type { CanvasIntent } from "./canvasIntents.js";
import type { ColumnSelects } from "./columnSelect.js";
import type { LongValueEditor } from "./longValueEditor.js";
import type { IslandEntry } from "./canvasControls.js"; // exported by G5

export type SuggestionProvider = (nodeId: string, param: string) => Promise<SuggestionList>;

/** State one mounted canvas owns; nothing here is shared between two canvases on a page. */
export interface CanvasInstance {
  /** Enters the runtime's intent flow from the DOM side (islands, long-value editors). */
  dispatch(intent: CanvasIntent): void;
  /** True for a viewer: gestures never begin a mutation, islands are disabled, and the update drops mutating intents. */
  readonly readOnly: boolean;
  /** The DOM document islands are created in; tests pass jsdom's. */
  readonly document: Document;
  readonly islands: Map<string, IslandEntry>;
  readonly openDropdowns: Set<string>;
  readonly longEditors: Map<string, LongValueEditor>;
  readonly longEditorThemeV: Map<string, number>;
  readonly noteEditors: Map<string, LongValueEditor>;
  readonly noteEditorThemeV: Map<string, number>;
  readonly columnSelects: ColumnSelects;
  suggestionProvider: SuggestionProvider | null;
}

export function createCanvasInstance(options: {
  document: Document;
  readOnly: boolean;
  dispatch: (intent: CanvasIntent) => void;
}): CanvasInstance;

/** Drops the islands, editors, and dropdown flags of rows not in `liveKeys` (every row when the set is empty). */
export function pruneInstance(instance: CanvasInstance, liveKeys: ReadonlySet<string>): void;
```

Worked example: two instances `a` and `b` over two stores that both hold node `q` with parameter `limit`. `a.islands.get("q::limit")` and `b.islands.get("q::limit")` are two different input elements; a commit on the first calls `a.dispatch`, which reaches only `a`'s runtime and store. `pruneInstance(a, new Set())` removes `a`'s input from the DOM and leaves `b`'s.

`SlotContext` (`canvasSlots.ts`) gains `readonly instance: CanvasInstance`. `setInlineControlDispatch`, `dispatchInline`, `setSuggestionProvider`, `refreshColumnOptions`, `pruneInlineControls`, `disposeInlineControls`, `pruneLongValueEditors`, `pruneSlots`, and `disposeSlots` lose their module-level state: the first two become `instance.dispatch`, the next two become methods on the editor, and the pruning functions take the instance. Every part definition (`part("bof-...")`) stays module-level, because a part definition is immutable and Gratify keys its caches by definition; only the maps move.

### The editor

```ts
// graph/src/canvasEditor.ts
export interface GraphEditorOptions {
  readonly store: Store;
  readonly catalog: () => ReadonlyMap<string, NodeDescriptor>;
  readonly onError: (message: string) => void;
  /** Viewer mode: see CanvasInstance.readOnly. Default false. */
  readonly readOnly?: boolean;
  readonly theme?: CanvasThemeName;
  /** The node whose upstream path is highlighted; defaults to the last selected node. */
  readonly getPreview?: () => string | null;
  /** Double-click on a node (TKT-81). */
  readonly onShowNode?: (nodeId: string) => void;
  /** Host reader for peeks and row counts (TKT-11 C8); without it the canvas shows neither. */
  readonly readPort?: ReadPort;
  /** Live values for suggest-annotated parameters (the app's suggestions endpoint). */
  readonly suggestions?: SuggestionProvider;
  /** Gestures the canvas cannot resolve alone (a wire dropped on empty canvas), answered by the host's DOM surfaces; see CanvasHooks in canvasIntents.ts (30cb244). */
  readonly hooks?: CanvasHooks;
}

export interface GraphEditor {
  refresh(): void;
  fit(): void;
  focus(nodeId?: string): void;
  /** Re-reads the column options of every column selector (after an evaluation update). */
  refreshSuggestions(): void;
  /** Switches the canvas theme. The theme is page-wide (Gratify's tokens are); every mounted canvas follows. */
  setTheme(theme: CanvasThemeName): void;
  dispose(): void;
}

export function createGraphEditor(canvas: HTMLCanvasElement, options: GraphEditorOptions): GraphEditor;
```

The positional `createCanvasEditor(canvas, store, getCatalog, onError, theme, getPreview, onShowNode)` becomes this options object; TKT-11 C8 is about to add an eighth positional argument (`readPort`), which is the moment to stop. `app.ts` is the only caller. The shape of `dispose` is unchanged: unsubscribe, remove listeners, prune the instance with an empty set, stop the runtime.

Worked example: `createGraphEditor(canvas, { store, catalog: () => catalog, onError: fail, readOnly: true })` over a store holding the S7 zone graph draws it, `fit()` frames it, a click on `unmatchedInFile` selects it and lights the wires from `csv.relation`, and a drag from its output socket draws nothing and dispatches nothing.

### Read-only mode

Two layers, so the rule holds even if one part forgets it:

- `makeCanvasUpdate(store, onError, getPreview, readOnly)` drops `move`, `moveEnd`, `connect`, `setParam`, `deleteSelected`, and `openEditor` when `readOnly` is true and returns the doc unchanged. `selectNode`, `selectEdge`, `clearSelection`, `closeEditor`, and `sync` still run: a viewer selects, and selection is a store action that touches no document layer.
- The parts hide the affordances: the wire and move gestures return `null` from `begin` when `node.props.instance.readOnly`; the dropdown's `reduce` ignores `toggle`; island inputs are created with `disabled = true`; the long-text row and the note ignore their press; the surface omits the Delete and Backspace keys; the context menu is not installed. Pan and wheel zoom stay.

Selection is the store's, not the editor's. The editor owns no selection state: it reads `State.selection` and dispatches `select`, exactly as the studio's canvas does today, so a host that gives several editors one store shares one selection across them, and a host that gives each cell its own store keeps them apart. The notebook takes the second option (below), because each turn's embed holds that turn's version of the graph.

### The notebook cell

`bim-open-notebook/src/embeds/graph.ts` mounts `createGraphEditor` read-only on a `<canvas>` in the embed body, replacing the SVG diagram; the header, the "Open in editor" link, the "Show text" fold, and the status line stay.

- **Store.** `createStore({ ...initialState, document: parseDocument(embed.document), selection: embed.focus ?? [] })` when the embed carries a document; when it does not, the text print shows open (today's fallback) until `refresh()` fetches the document.
- **Catalog.** `EmbedContext` gains `catalog(): Promise<ReadonlyMap<string, NodeDescriptor>>`, one page-level promise that `page/main.ts` builds from `api.getNodeCatalog()` and that every cell shares; without a catalog the editor draws portless nodes, as `buildCanvasModel` already does. Tests pass a resolved map.
- **Refresh.** `refresh()` keeps its comparison by graph hash from the text print, then dispatches `setDocument` with the current document and `applyServerState` with `getAnalysisState`, so statuses and badges appear on the cell exactly as they do in the studio.
- **Mount.** The same `IntersectionObserver` rule as `view3d.ts` (root margin 800 px, immediate where the observer is missing), and `fit()` on the first non-zero canvas size, since a hidden or unlaid-out canvas is 0 by 0 at mount (the memory note on the browser pane). Zoom from `fit()` is capped at 1 so text is never smaller than the studio draws it; a wide graph is panned, not shrunk.
- **Size.** A fixed-height block (320 px) at the column's width; the embed body's horizontal scroll rule is not needed for a canvas.

The TKT-80 owner's requirements for the cell (message of 2026-09-28, session "Notebook interface idea"), each kept by the design above: (1) renders with no host from the embed's `document`, falling back to the `text` print; (2) `refresh()` keeps the `Freshness` contract, restoring a missing analysis with PUT; (3) `embed.focus` nodes are highlighted; (4) "Open in editor" stays a separate link and the cell is read-only; (5) legible in the 760 px column, with the widest committed graphs (S7's 12 nodes, `nrc-dc-w1-verdicts`' 16) panned rather than shrunk below zoom 1; (6) several cells per page, mounted independently (S7 has two, S1 several); (7) `test/samples.test.ts` and the graph cases of `test/graphPictureFile.test.ts` still pass, and `graphDiagram.test.ts`'s checks are replaced by equivalents where they still apply. G9 also updates `docs/plans/notebook.md` where it names the SVG diagram (Design, Debt "Two node layouts", Considered and rejected "embed the canvas editor").

Worked example: the S7 sample's third turn embeds `nrc-zones-unmatched` with focus `["unmatchedInFile"]`. The cell opens fitted, `unmatchedInFile` selected and the wire from `csv.relation` lit; after Re-evaluate, every node carries its Ok dot and the status line says current.

### Retires

- `bim-open-notebook/src/embeds/graphDiagram.ts` (397 lines), `test/graphDiagram.test.ts`, and the sample-wide text-size and edge-route checks that call `layoutGraphDiagram`. `docs/plans/notebook.md`'s debt item "Two node layouts" closes with them.
- The page-wide functions `setInlineControlDispatch`, `dispatchInline`, `setSuggestionProvider`, `refreshColumnOptions`, `disposeInlineControls`, `pruneInlineControls`, `pruneLongValueEditors`, `pruneSlots`, `disposeSlots`, and the seven module-level maps and sets in the table above.
- The positional `createCanvasEditor`.
- The graph part of TKT-86's deep-import debt: the notebook's `nodeTitle` import from `@bimopenflow/app/src/graphPreview` and its `ResultApi` import stay TKT-86's until that ticket moves the pane helpers; the graph helpers come from `@bimopenflow/graph`.

## Considered and rejected

- **Option:** an iframe per graph cell, each loading the editor page. **Reason:** the owner's request excludes it; an iframe is a second document with its own store, selection, theme, and scroll, and a notebook with twelve cells would load the app twelve times. **Would change if:** a cell had to run untrusted graph code, which it does not.
- **Option:** keep `graphDiagram.ts` as the cell and improve it. **Reason:** it is a second renderer of the same graph, already with its own layout and edge routing (TKT-80's last four commits were all diagram fixes), and it can never show status, badges, peeks, or the selected path without repeating the canvas. **Would change if:** a static export needed a DOM-free picture of a graph (the notebook plan's "static HTML export" extension point); then a Gratify `NullPainter` recording, not a second layout, is the way.
- **Option:** fix the singletons in place inside `app` and let the notebook deep-import `app/src/canvasEditor`. **Reason:** no build-enforced boundary, more of the deep-import debt TKT-86 exists to remove, and `app` is an application, not a library; `docs/graph-module-layering.md` already decided the package. **Would change if:** the workspace dropped npm packages for a single source tree.
- **Option:** put the canvas into `@bimopenflow/panes`. **Reason:** panes depend on `three` and the viewer packages; the canvas depends on `gratify`; they change at different rates and are fenced by different tickets (TKT-15, TKT-16 hold `panes/**`). **Would change if:** the canvas became a pane in the pane area, which TKT-28 (3D inside the studio) does not ask for.
- **Option:** a per-instance theme. **Reason:** Gratify's `tokens`, `themes`, and `themeVersion` are module-level, and every part's `style` reads the one live token set, so two canvases on a page cannot differ without a per-runtime token set in Gratify core, the kind of core gap `docs/graph-module-layering.md` says goes upstream, not into this package. `setTheme` stays on the editor and is documented as page-wide. **Would change if:** Gratify's runtime took a token set in `RuntimeOpts`.
- **Option:** one shared store per analysis id across a notebook page, so every cell of a graph shares selection and refreshes at once. **Reason:** a transcript's turns embed different versions of the same analysis (S1 has five graphs over five turns), and one store would show the last version in the first turn. **Would change if:** notebooks stored one graph per analysis id.
- **Option:** move `graphPreview.ts` to `@bimopenflow/state` now. **Reason:** `state/**` is in TKT-12's and TKT-17's fences. **Would change if:** either released it; it is an extension point.
- **Option:** start wave B now by narrowing TKT-11's and TKT-12's fences to their pending chunks' files. **Reason:** not rejected, offered: it is the owner's call and it shortens the wait by however long TKT-11 C8, TKT-12 C9, and TKT-12 C10 take. The plan is written so nothing changes except the start date.
- **Option:** rename the modules as they move (`canvasParts` to `parts`, and so on). **Reason:** a rename in the same commit as a move hides the move from `git log --follow` and breaks the references in three plans; renaming is a separate, later chunk if wanted. **Would change if:** the package grew subfolders.

## Signatures and contracts

Read-only for every chunk. They are not compiled during planning, since the planner writes no source files; G1 and G3 compile them as their first step, and a mismatch goes back to the supervisor. Additions to existing signatures:

```ts
// graph/src/canvasSlots.ts
export interface SlotContext {
  readonly nodeId: string;
  readonly param: CanvasParam;
  readonly w: number;
  readonly open: boolean;
  readonly instance: CanvasInstance; // new (G5)
}

// graph/src/canvasParts.ts
export function canvasView(model: CanvasModel, instance: CanvasInstance): Element; // instance new (G5)

// graph/src/canvasIntents.ts. `hooks` landed in 30cb244 (the Editor UX wave, TKT-96): a
// wire dropped on empty canvas is answered by the editor's palette. readOnly goes after it.
export function makeCanvasUpdate(
  store: Store,
  onError: (message: string) => void,
  getPreview?: () => string | null,
  hooks?: CanvasHooks,
  readOnly?: boolean, // new (G6); default false
): (doc: CanvasModel, intent: CanvasIntent) => CanvasModel;

// graph/src/canvasControls.ts (G5): the per-row island record becomes public so the instance can hold it
export interface IslandEntry { el: HTMLInputElement; themeV: number; descriptor: string; canonical: string; paramKind: ParamKind; detachSuggest?: () => void }
export function pruneInlineControls(instance: CanvasInstance, liveKeys: ReadonlySet<string>): void;

// graph/src/canvasLongSlot.ts and canvasParts.ts (G5)
export function pruneLongValueEditors(instance: CanvasInstance, liveKeys: ReadonlySet<string>): void;

// graph/src/index.ts: the public surface app and the notebook import
export { createGraphEditor } from "./canvasEditor.js";
export type { GraphEditor, GraphEditorOptions } from "./canvasEditor.js";
export { anchorId, parseAnchorId } from "./canvasIntents.js";
export type { AnchorRef, CanvasHooks, CanvasIntent } from "./canvasIntents.js";
export { createCanvasInstance, pruneInstance } from "./instance.js";
export type { CanvasInstance, SuggestionProvider } from "./instance.js";
export { buildCanvasModel, freePosition, nodeHeight, nodeWidth, NOTE_KIND } from "./viewModel.js";
export type { CanvasModel, CanvasNode, CanvasEdge } from "./viewModel.js";
export { inlineParams } from "./canvasSlots.js";
export { autoLayout } from "./autoLayout.js";
export { nodeTitle, upstreamIds, previewAfterEdit } from "./graphPreview.js";
export { applyCanvasTheme, canvasThemeNames, defaultCanvasTheme, isCanvasThemeName } from "./canvasTheme.js";
export type { CanvasThemeName } from "./canvasTheme.js";
export type { ReadPort } from "./portResults.js";

// bim-open-notebook/src/embeds/contract.ts (G8)
export interface EmbedContext {
  readonly api: NotebookApi;
  readonly selection: SelectionBus;
  /** The host's node catalog, fetched once per page; a cell draws portless nodes until it resolves. */
  readonly catalog: () => Promise<ReadonlyMap<string, NodeDescriptor>>;
}
```

`graph/test/layering.test.ts` (G1) reads every file under `graph/src` and fails on an import specifier that starts with `@bimopenflow/app`, `@bimopenflow/panes`, `@bimopenflow/api-client`, `@bimopenflow/bim-open-notebook`, or a relative path that leaves `src`. The same test also fails on `../../../../submodules/gratify/examples/` (the `graphWidgets.ts` import of the example widgets moves to a copy under `graph/src` in G4, listed as planned debt below).

## Extension points

Each becomes a ticket when the plan closes, per `TECHNICAL_DEBT.md`.

- **An editable cell.** `readOnly: false` plus `connectAnalysis` over the cell's analysis id gives a cell that autosaves to the host, which is the notebook plan's Editor embed (S4, S8). Open question first: a turn's embed is a snapshot of that turn, so an edit either forks the analysis or rewrites history; TKT-91 holds the embed kinds.
- **Peeks inside a cell.** Pass `readPort` bound to `api.getResult(embed.analysisId, ...)` once TKT-11 C8 has wired it into the editor; the analysis must exist on the host, which `refresh()` already ensures by restoring it.
- **Cross-cell node selection.** The page's `SelectionBus` carries element ids; node ids are another identity space (`app.ts` says so at `onSelect`). A typed bus, or a second channel, lets a node selected in one cell highlight the table that node produced. Waits on TKT-88's chart selection.
- **`graphPreview.ts` down to `state`.** When `state/**` leaves TKT-12's and TKT-17's fences.
- **Per-runtime theme in Gratify core.** `RuntimeOpts.tokens`, then `CanvasInstance` carries a theme and `canvasColors()` reads it from the instance.
- **Focus-scoped keys.** Gratify attaches `keydown` on `window` per runtime, so two editable canvases on one page both receive Delete. A viewer omits the key map, so cells are unaffected; two editors would need a focused-runtime rule in core.
- **Subfolders and renames** inside the package once it is stable (`parts/`, `slots/`, `results/`).

## Planned debt

- **The canvas cluster exists twice** from G2 until G7: `app/src` (the studio's, edited by the Editor UX wave and TKT-12) and `graph/src` (this plan's, copied at `3e4a699`). Payoff: G7 deletes the app copies and re-applies the other tickets' diffs to the package. Each re-sync before G7 is recorded in the build log with the commit range it applied.
- `graphWidgets.ts` imports `../../../../submodules/gratify/examples/shared/widgets` (the slider and range widgets). G4 copies that file to `graph/src/gratifyWidgets.ts` rather than reaching into the submodule's examples, which `docs/graph-module-layering.md` says nothing imports. Payoff: TKT-23 rebuilds the slider and range as this package's own parts (its notes already plan a typed slider), and the copy is deleted then. Filed with the extension points.

## Coordination

The three claimed tickets hold, in their fences, files this plan moves. Their pending chunks, from their plans' build logs on 2026-09-28:

| Ticket | Pending chunk | Files it edits that this plan moves or edits |
|---|---|---|
| TKT-11 (peek any wire) | C8 | `canvasEditor.ts`, `app.ts`, `app/README.md` |
| TKT-12 (run from the editor) | C9 | `nodeBadge.ts`, `viewModel.ts`, `test/nodeBadge.test.ts`, `test/viewModelRun.test.ts` (new) |
| TKT-12 | C10 | `app.ts`, `topbar.ts`, `test/topbar.test.ts` (new) |
| TKT-26 (agent in the open graph) | C7 | `askRequest.ts`, `duckdbDemo.ts`; none of this plan's files, but `app.ts` stays in its fence for fixes |
| Editor UX wave: TKT-95 (step list), TKT-96 (canvas palette), TKT-97 (problems list), TKT-98 (node card styles); no plan file and empty fences as of 2026-09-28 19:17 | its contracts commit 30cb244 and whatever follows | already edited `canvasIntents.ts` (`wireDropped`, `CanvasHooks`), `canvasParts.ts`, `viewModel.ts` (`CanvasNode.description`), and `state/src/{actions,reducer}.ts` (a `batch` action); TKT-98 will split node drawing out of `canvasParts.ts` into its own module, TKT-96 will add a palette answering `onWireDropped`, and all four add modules under `app/src` |

The Editor UX wave is the collision that matters most: it builds behaviour in the same files wave B moves. Two orders work, and the owner picks:

- **UX wave first (the default, since it has started).** G4 moves the canvas cluster as it stands when G4 begins, so its file list grows by the wave's new canvas modules (the node-style module of TKT-98, the palette of TKT-96, and any module of theirs that imports `gratify` or is imported only by modules that do). The step list (TKT-95) and the problems strip (TKT-97) are chrome beside the canvas and stay in `app`, importing from the package like `sidebar.ts` does. G4 starts after the wave's last commit to a canvas file.
- **G4 first.** The move is one chunk of shims and takes a session; the wave then builds its canvas work in `packages/graph` and its chrome in `app`. This is cheaper overall, because a behaviour chunk built in `app` moves twice, but it needs the wave to pause for that session and TKT-11 C8 and TKT-12 C9 to be in, or their fences narrowed.

Either way the wave's ticket fences should name their files before its next chunk, so this plan's fence and theirs can be checked against each other; today all four are empty.

Rules this plan follows:

- Wave A touches no file in a claimed fence except `bimopenflow/web/package-lock.json` and `gates/web-smoke.mjs`, both in TKT-80's fence (the notebook supervisor), and both edited by every new package; G1 is serialized with any TKT-80 commit to them.
- G2 moves the test files of the leaf modules. `app/test/**` is in the three fences, but no pending chunk names those files; the supervisor confirms with the three owners before G2, or G2 leaves the tests in `app/test` importing the shims and G4 moves them.
- Wave B starts when TKT-11 C8, TKT-12 C9, and TKT-12 C10 are committed, or when the owner narrows those tickets' fences to release the files above. G4 and G7 are serialized against any later fix chunk of TKT-11, TKT-12, or TKT-26 that names `app.ts`.
- G8 and G9 edit the notebook package, which is TKT-80's fence. Either the notebook supervisor builds them from this plan, or TKT-80 releases `src/embeds/graph.ts`, `src/embeds/graphDiagram.ts`, `src/embeds/contract.ts`, `src/page/main.ts`, `src/page/notebookView.ts`, `src/page/styles.ts`, `package.json`, `README.md`, and the tests named in the table.
- TKT-23 (node controls, open, fence `app/**`) and TKT-17 (agent edits, open, fence `app/**` and `state/**`) are unclaimed; whoever claims them after G4 works in `packages/graph`, and the ticket fences are updated in G10.
- TKT-86 (client library) narrows: after G7 and G8 its graph-helper criterion is met, and its remaining scope is the pane helpers and the Ask reader.

## Chunks

Test command for a package chunk, from `bimopenflow/web`: `npm test -w <package>` and `npm run typecheck -w <package>`; for a chunk that touches `app`, also `npm run build -w @bimopenflow/app`; for the last chunk of each wave, `node gates/web-smoke.mjs` from the repository root. Baseline before G1 (from the last build logs and 30cb244): app 363 tests, state 56, notebook 290, web-smoke passes; G1 re-measures.

### Wave A: unblocked now

| Id | One-sentence commit | Fence (writes only) | Depends on | Test |
|---|---|---|---|---|
| G1 | Add the `@bimopenflow/graph` package skeleton with a layering test and a smoke step | `bimopenflow/web/packages/graph/{package.json,tsconfig.json,vitest.config.ts,README.md,src/index.ts,test/layering.test.ts}`, `bimopenflow/web/package-lock.json`, `gates/web-smoke.mjs` | - | the package's tests and typecheck pass; `node gates/web-smoke.mjs` runs the new step; `npm ls @bimopenflow/graph` resolves from `app` |
| G2 | Copy the canvas cluster and its tests from `3e4a699` into the graph package, with a real index | `bimopenflow/web/packages/graph/src/**` (the 28 modules of the table above plus `gratifyWidgets.ts` and `gratifyRangeMath.ts`, copied from gratify's examples), `bimopenflow/web/packages/graph/test/**` (29 test files), `graph/README.md`; nothing under `app` | G1 | graph tests equal the copied ones (202), typecheck clean, layering test passes |
| G3 | (dropped: the copy compiles the real signatures, so no stubs are needed; the per-instance signatures land with G5) | | | |

### Wave B: after TKT-11 C8 and TKT-12 C9 and C10

| Id | One-sentence commit | Fence (writes only) | Depends on | Test |
|---|---|---|---|---|
| G4 | Re-sync: apply the Editor UX wave's chunk F (node drawing in `nodeRender.ts`, `nodeStyle.ts`, `nodeStyleChoice.ts`) and any later canvas commits to the package copy | `graph/src/**`, `graph/test/**` | G2; the UX wave's F committed | graph tests and typecheck; the build log names the commit range applied |
| G5 | Give each mounted canvas its own island, editor, dropdown, dispatch, and suggestion state | `graph/src/{instance,canvasSlots,slotShared,slotRegistry,canvasControls,canvasLongSlot,canvasParts,canvasEditor,index}.ts`, `graph/test/{instance,canvasControls,canvasLongSlot,nodeParams,canvasParts}.test.ts` | G2 (G4 first when F has landed, so the refactor is done once) | acceptance 2: `test/instance.test.ts` mounts two headless runtimes over two stores |
| G6 | A read-only editor pans, zooms, and selects, and nothing changes the document | `graph/src/{canvasIntents,canvasParts,canvasControls,canvasLongSlot,canvasEditor}.ts`, `graph/test/readOnly.test.ts` | G5 | acceptance 3, driven through `Runtime.pointerDown/Move/Up` and `key` |
| G7 | Payoff: the app imports the editor from the graph package and its copies of the cluster go | `app/src/{app,paneArea,themeChoice,topbar}.ts` and any other app file importing a cluster module, the cluster files under `app/src` and their tests under `app/test` (deleted), `app/README.md`, `bim-open-notebook/src/embeds/graphDiagram.ts` (its `nodeTitle` import only, until G9 deletes it) | G5, G6; the UX wave's G committed; TKT-12 C9 and C10 either committed or re-fenced to the package | acceptance 4: app tests, build, `node gates/web-smoke.mjs`, and the browser-pane session on `/duckdb.html` recorded in the build log |
| G8 | Every graph embed is a live read-only canvas over its own store | `bim-open-notebook/src/embeds/{graph,contract}.ts`, `bim-open-notebook/src/page/{main,notebookView,styles}.ts`, `bim-open-notebook/test/{graphPictureFile,notebookView}.test.ts`, `bim-open-notebook/package.json`, `bim-open-notebook/README.md` | G6, G7 | acceptance 5 in the browser pane (`notebook-web` on 5350 against `notebook-studio` on 5366): the S7 example above, Re-evaluate all reports 56 current; notebook tests |
| G9 | Delete the SVG graph diagram and its tests | `bim-open-notebook/src/embeds/graphDiagram.ts`, `bim-open-notebook/test/graphDiagram.test.ts`, the `layoutGraphDiagram` checks in other notebook tests, `docs/plans/notebook.md` (Debt: "Two node layouts" closed) | G8 | notebook tests and typecheck; `grep -r graphDiagram bimopenflow/web/packages` finds nothing |
| G10 | Document the graph package and update the tickets that fence the moved files | `docs/ARCHITECTURE.md` (the `bimopenflow/web` bullet), `docs/graph-module-layering.md` (Consequences: built), `bimopenflow/web/packages/graph/README.md`, `tickets/TKT-17.md`, `tickets/TKT-23.md`, `tickets/TKT-86.md` (fences and notes), new tickets for the extension points and the planned debt | G9 | `node gates/web-smoke.mjs`; the ticket tool lists the new tickets |

Supervisor-owned across every chunk: this plan file, `bimopenflow/web/package-lock.json`.

## Build log

| Id | Commit | Result |
|---|---|---|
| G1 | 3e4a699 | Skeleton; layering test 1 pass, typecheck clean; `gates/web-smoke.mjs` gained the step; lock file updated by `npm install`. |
| G2 | (see git log) | 28 modules and 29 test files copied from `3e4a699`; gratify's example `widgets.ts` and `range-math.ts` copied as `gratifyWidgets.ts` and `gratifyRangeMath.ts` (Planned debt); 202 tests pass, typecheck clean, layering test passes. The UX wave's chunk F (`nodeRender.ts` and friends) was uncommitted at copy time and arrives with G4. |
| G5 | 1947620 | CanvasInstance holds the former module-level state; canvasView(model, instance); createGraphEditor(canvas, options) replaces the positional createCanvasEditor; test/instance.test.ts mounts two headless runtimes over two stores with the same node id. 205 tests, typecheck clean. |
| G4 | (see git log) | Re-sync of the UX wave's chunk F (2f88912): nodeRender.ts, nodeStyle.ts and their tests copied in; canvasParts.ts's node drawing replaced by renderNodeCard; nodeStyleChoice.ts stays in the app (it uses the app's prefs.ts, like themeChoice.ts) and its persistence cases are dropped from the package's nodeStyle test. Range applied: 3e4a699..2f88912 for the canvas files. 228 tests, typecheck clean. Still to re-sync: the wave's chunk G (canvasEditor.ts, in progress in the app). |
| G6 | (see git log) | MUTATING_INTENTS dropped by makeCanvasUpdate(..., readOnly); the wire gesture never begins, the move gesture only selects, the dropdown never opens, island inputs and column selectors are disabled. test/readOnly.test.ts drives a header click, a node drag, a socket drag, Delete, and a toggle press through the runtime. 233 tests, typecheck clean. |

## Review findings

## Debt and extension points

See Extension points and Planned debt above; G10 files them.
