# Editor UX wave: peek, templates, steps, palette, problems, node styles

Status: done (wave record below)
Request: the owner, 2026-09-28, from the ranked list in the session that wrote [editor-ux-harvest.md](../proposals/editor-ux-harvest.md): build items 1, 3, 4, 5, and 6 (wire peeking connected, a start page from the sample graphs, a step list, adding nodes from the canvas, an error list), skip item 2 (docs on hover; another session has it), and add a switch between node card styles so the owner can compare how a node shows its title, description, and status. Nodes should carry text describing them. The 4 px status dot is in question.
Tickets: TKT-11 (peek), TKT-14 (templates), TKT-95 (step list), TKT-96 (palette), TKT-97 (problems list), TKT-98 (node styles).
Serves: workflow 2 (ask and get a graph you can inspect) and workflow 1 (a start page lists the supported demos). Acceptance criteria per chunk are derived from those Done lines and the tickets' criteria.

Contracts: commit `30cb244`. A `batch` store action (one undo step for several actions), `CanvasNode.description`, the `wireDropped` canvas intent and `CanvasHooks.onWireDropped` in `canvasIntents.ts`, and `canvasParts.ts` raising `wireDropped` when a wire is released with no snap. Read-only for every chunk.
Baseline gates (before any change): `npm test -w @bimopenflow/app` 363 pass in 49 files; `npm test -w @bimopenflow/state` 56 pass; `npm run typecheck -w @bimopenflow/app` clean. Web commands run from `bimopenflow/web`.

## Ground rules for every chunk

- `app/` means `bimopenflow/web/packages/app/`. Every new module is a small file in `app/src/` with a test in `app/test/`, gratify-free and DOM-free where the design says so (the pattern of `portResults.ts` and `nodeBadge.ts`).
- Shared files (`app.ts`, `canvasEditor.ts` after chunk A, `styles.ts`, `shell.ts`, `README.md`) are the supervisor's. A module that needs CSS injects its own `<style>` element with an id, the way `sidebar.ts`'s `ensureSidebarStyles` does. A builder reports the line it would add to `README.md`.
- Every graph mutation is a store dispatch (principle 1). Nothing here evaluates or writes (principle 2). Numbers shown come from the host's results, never invented (principle 3).
- The user-facing noun on screen is "flow", as the topbar and sidebar already say (TKT-4 is open; do not introduce "analysis" or "graph" in new labels).
- Per-chunk check: `npm test -w @bimopenflow/app -- <test file stem>` for the chunk's tests, then `npm run typecheck -w @bimopenflow/app`. A typecheck failure in a file outside the fence belongs to that file's owner: rerun once, then report it.

## Design

### A. Connect wire peeking (TKT-11, the plan's chunk C8)

[peek-any-wire.md](peek-any-wire.md) built the controller, geometry, hover listener, card, and view model, and left C8 undone: `canvasEditor.ts:40` calls `buildCanvasModel` without results and nothing calls `installPortHover`. The wiring goes in one new module so it is testable without mounting gratify.

```ts
// app/src/peekWiring.ts
import type { NodeDescriptor } from "@bimopenflow/contracts";
import type { Store } from "@bimopenflow/state";
import type { CanvasModel } from "./viewModel.js";
import type { PortResultsView, ReadPort } from "./portResults.js";

export interface PeekWiringDeps {
  readonly store: Store;
  readonly getCatalog: () => ReadonlyMap<string, NodeDescriptor>;
  readonly readPort: ReadPort;
  /** The canvas doc and viewport the hit-test reads, as the runtime holds them. */
  readonly getDoc: () => CanvasModel;
  readonly getViewport: () => { zoom: number; pan: { x: number; y: number } };
  /** Called after every controller change; the editor re-syncs the canvas. */
  readonly onChange: () => void;
}

export interface PeekWiring {
  /** The snapshot buildCanvasModel takes as its `results` argument. */
  view(): PortResultsView;
  dispose(): void;
}

/** Creates the controller, watches evaluations, and installs the hover
 *  listener on `canvas`, converting CSS pixels to world coordinates through
 *  the viewport (as canvasEditor's context-menu hit test does). */
export function createPeekWiring(canvas: HTMLCanvasElement, deps: PeekWiringDeps): PeekWiring;
```

`createCanvasEditor` gains an optional `readPort?: ReadPort` in a new options object or trailing parameter (the builder chooses; the existing positional parameters stay valid). With it, the editor creates the wiring, passes `wiring.view()` as the fourth argument of `buildCanvasModel`, and disposes it. The supervisor passes `boundCtx.requestTable` from `app.ts` in the integration commit.

Worked example: a store with `a (k.a, Ok) -> b`, catalog `k.a` with output `out: Table`, a fake `readPort` resolving `{columns:[{name:"id"}], rows:[], totalRows: 142, skip: 0}`. After `applyServerState`, `view().counts.get("a.out")` is `{rows: 142, current: true}` and `onChange` was called. A `pointermove` at the socket's CSS position followed by 300 ms (fake timers) makes `view().peek?.endpoint` equal `"a.out"`.

### B. Start page from the sample graphs (TKT-14, first cut)

The host seeds the sample folders into an empty store (`src/flow/BimOpenFlow.Host/SampleSeeding.cs`, `BimSampleSeeding.cs`), so the analyses list already holds them, but nothing tells a newcomer what each one is. This chunk generates a catalog of templates from the sample folders and shows it as a start page.

- **Generator** `scripts/build-flow-templates.mjs` (Node, no dependencies): reads every `samples/*-analyses/*.json` graph document (and `samples/analyses/*.json`; `samples/duckdb-analyses/workflows.json` is an array of `{id, title, tag, description, result, graph}` and is read as such), pairs each with its description from the folder's `README.md` table (the row whose first cell is the id in backticks; the description is the second cell, whatever the header says), and writes `app/src/templates.generated.ts`. Files that are not graph documents (`federation-match.json`, `shared-color-legend.json` if it lacks `structure`) are skipped. `--check` exits 1 when the committed file differs, the way `docs/nodes.md` is checked.
- **Generated shape** (`app/src/templates.ts` holds the types and the pure grouping):

```ts
export interface FlowTemplate {
  readonly id: string;            // the analysis id the host seeds
  readonly folder: string;        // "bim-analyses", "nrc-analyses", ...
  readonly title: string;         // from README/workflows.json title, else the id
  readonly description: string;   // one line; "" when the README has none
  readonly nodeCount: number;
  readonly kinds: readonly string[];  // distinct node kinds, sorted
}
export interface TemplateGroup { readonly folder: string; readonly label: string; readonly templates: readonly FlowTemplate[] }
/** Groups templates by folder in a fixed order with a readable label
 *  ("Tables", "BIM", "NRC paper", "Showcase", "3D", "Snowdon", "DuckDB studio"),
 *  and marks which are present in the host's analysis list. */
export function groupTemplates(templates: readonly FlowTemplate[], present: ReadonlySet<string>): TemplateGroup[];
```

- **Start page** `app/src/startPage.ts`: a DOM overlay covering the canvas host (`position:absolute; inset:0`), with a heading, one section per group, and a card per template (title, description, node count, the kinds as small chips). A card whose id the host lists opens it (`onOpen(id)`); one the host does not list is dimmed and says "not seeded in this host profile". A "Blank flow" card calls `onBlank()`. A "Copy" button on a present card calls `onCopy(id)`: the supervisor implements copy in `app.ts` as GET document, PUT under a fresh id, open (that is "new from template" with the host's already-resolved paths). Escape or a close button hides it.

```ts
export interface StartPageDeps {
  readonly templates: readonly FlowTemplate[];
  readonly onOpen: (id: string) => void;
  readonly onCopy: (id: string) => void;
  readonly onBlank: () => void;
}
export interface StartPage {
  /** Re-renders with the ids the host currently lists. */
  setPresent(ids: readonly string[]): void;
  show(): void;
  hide(): void;
  isOpen(): boolean;
  dispose(): void;
}
export function createStartPage(host: HTMLElement, deps: StartPageDeps): StartPage;
```

The supervisor wires it: shown at boot when no `initialAnalysis` option is given and the store lists more than one flow, and from the topbar's New button (which becomes "New…" in the integration commit).

### C. Step list (TKT-95)

A read-only second reading of the graph, in the sidebar between Flows and the catalog.

```ts
// app/src/graphOrder.ts — pure
/** Nodes in dataflow order: by longest upstream chain, then by layout y then x
 *  within a depth, then id. Every node appears once; a cycle breaks at its
 *  first node. */
export function dataflowOrder(document: GraphDocument): string[];
/** The ids of the nodes feeding `nodeId`, in dataflow order. */
export function feeders(document: GraphDocument, nodeId: string): string[];

// app/src/stepList.ts
export interface Step {
  readonly index: number;          // 1-based
  readonly nodeId: string;
  readonly title: string;          // nodeTitle(kind) from graphPreview.ts
  readonly kind: string;
  readonly summary: string;        // "table = doors · limit = 10"; "" when no params set
  readonly status?: NodeStatus;
  readonly badge?: string;         // nodeBadge text
  readonly rows?: number;          // first Table/Relation output's count when known
  readonly from: readonly number[]; // step indexes that feed this one, when more than the previous step
  readonly selected: boolean;
}
export function stepListModel(state: State, catalog: ReadonlyMap<string, NodeDescriptor>, results: PortResultsView): Step[];
export interface StepListDeps { readonly onSelect: (nodeId: string) => void }
export interface StepList { render(steps: readonly Step[]): void; dispose(): void }
export function createStepList(host: HTMLElement, deps: StepListDeps): StepList;
```

`sidebar.ts` gains a `stepsEl: HTMLElement` section titled "Steps" between the flows and the catalog; the supervisor calls `createStepList(sidebar.stepsEl, ...)` and re-renders on store changes and peek-count changes. The summary uses `fileName()` from `paramText.ts` for FilePath values and truncates long values to 40 characters with an ellipsis. `feeders` names steps only when a step has more than one feeder or its feeder is not the previous step ("from 2, 3").

Worked example: `doors (duck.query) -> join (table.join) <- storeys (duck.query)`, `join -> answer (table.sort)`. Order: `doors, storeys, join, answer` (doors and storeys share depth 0 and sort by y). Steps: 1 doors, 2 storeys, 3 join `from: [1, 2]`, 4 answer `from: []` (its only feeder is step 3, the previous step).

### D. Palette on the canvas (TKT-96)

Two gestures share one DOM palette. Both add nodes through the `batch` action so each is one undo step.

```ts
// app/src/paletteFilter.ts — pure
export interface PaletteEntry { readonly desc: NodeDescriptor; readonly port?: string } // port: the input (or output) that takes the dropped wire
/** Kinds matching `query` (case-insensitive substring over kind and description, kind matches first).
 *  With `wire`, only kinds with a port of the opposite direction whose type is compatible
 *  (canConnect's rule), and `port` names the first such port. */
export function filterPalette(catalog: readonly NodeDescriptor[], query: string, wire?: { dir: AnchorDir; type: PortType }): PaletteEntry[];

// app/src/addNodePlan.ts — pure
/** The actions that add `desc` at (x, y), select it, and optionally connect it to `wire`
 *  (from an output anchor: the new node's `port` input; from an input anchor: the new node's
 *  `port` output), for a store batch. Uses freshNodeId, nodeWidth, nodeHeight, inlineParams. */
export function addNodeActions(state: State, desc: NodeDescriptor, at: { x: number; y: number }, wire?: { from: AnchorRef; port: string }): Action[];

// app/src/canvasPalette.ts — DOM
export interface CanvasPaletteDeps {
  readonly getCatalog: () => readonly NodeDescriptor[];
  readonly onPick: (entry: PaletteEntry, at: { x: number; y: number }, wire?: AnchorRef) => void;
}
export interface CanvasPalette {
  /** Opens at a CSS-pixel position; `at` is the world point a picked node is placed at. */
  open(client: { x: number; y: number }, at: { x: number; y: number }, wire?: { from: AnchorRef; type: PortType }): void;
  close(): void;
  isOpen(): boolean;
  dispose(): void;
}
export function installCanvasPalette(canvas: HTMLCanvasElement, deps: CanvasPaletteDeps): CanvasPalette;
```

The palette is a positioned `<div role="listbox">` with a search input focused on open, arrow keys and Enter to pick, Escape or a click elsewhere to close, and entries showing kind and description (the wire-filtered form also shows the port it would connect). `nodeContextMenu.ts` gains an optional `onEmptyCanvas(clientX, clientY, canvasX, canvasY)` dependency called when the right-click hits no node; the palette builder adds it and the supervisor connects it. The supervisor also passes `onWireDropped` through `CanvasHooks` and converts world to client coordinates for `open`. `app.ts`'s `addNode` will dispatch `addNodeActions` as one batch in the integration commit, which closes the TODO there.

### E. Problems list (TKT-97)

```ts
// app/src/graphProblems.ts — pure
export interface Problem {
  readonly nodeId: string;
  readonly title: string;      // nodeTitle(kind)
  readonly status: Exclude<NodeStatus, "Ok">;
  readonly text: string;       // nodeBadge text
  readonly causeNodeId?: string;
  readonly depth: number;      // longest upstream chain; sort key
}
/** Every node whose status is not Ok (nodes with no state yet are left out), root causes first:
 *  by depth, then Error before EffectPending before Unavailable before Unready, then id. */
export function graphProblems(state: State): Problem[];
export function problemsSummary(problems: readonly Problem[]): string; // "" | "1 problem" | "3 problems · 1 error"

// app/src/problemsPanel.ts — DOM
export interface ProblemsPanelDeps { readonly onSelect: (nodeId: string) => void }
export interface ProblemsPanel { render(problems: readonly Problem[]): void; dispose(): void }
/** A strip along the bottom of `host` (the canvas host) showing the summary; clicking it
 *  toggles the list. Hidden entirely when there are no problems. */
export function createProblemsPanel(host: HTMLElement, deps: ProblemsPanelDeps): ProblemsPanel;
```

`EffectPending` is listed with its badge text ("Run to see results") but styled as information, not a fault, since it is the expected state of a sink before Run (principle 2).

### F. Node styles (TKT-98)

Node drawing moves out of `canvasParts.ts` into a module with a pure layout function, and the owner gets a switch between styles. Geometry that other modules depend on (`NODE_HEADER`, `PORT_SPACING`, `portY`, the socket positions) is fixed in this wave; styles differ in what the card draws and where, within that frame. Every style draws the description.

```ts
// app/src/nodeStyle.ts
export const nodeStyleNames = ["classic", "banner", "chip", "bar"] as const;
export type NodeStyleName = (typeof nodeStyleNames)[number];
export const defaultNodeStyle: NodeStyleName;
export const isNodeStyleName: (v: string) => v is NodeStyleName;
export function currentNodeStyle(): NodeStyleName;
export function setNodeStyle(name: NodeStyleName): void;   // notifies listeners
export function onNodeStyleChange(listener: () => void): () => void;

// app/src/nodeRender.ts
/** Where each text and the status indicator go, for a node of the given size in a style.
 *  Pure, so a test can assert the layout per style without a painter. */
export interface NodeCardLayout {
  readonly title: { text: string; x: number; y: number; size: number; weight: number };
  readonly subtitle?: { text: string; x: number; y: number; size: number };  // the id, or kind
  readonly description?: { text: string; x: number; y: number; size: number; maxWidth: number };
  readonly status?: { kind: "dot" | "chip" | "bar" | "tint"; x: number; y: number; w: number; h: number; text?: string };
  readonly badge?: { text: string; x: number; y: number; align: "left" | "right" };
}
export function nodeCardLayout(props: CanvasNode, style: NodeStyleName): NodeCardLayout;
/** Draws the card body (box, texts, status, ports, separator) for `props` in the current style. */
export function renderNodeCard(node: GNode<NodeProps>, painter: Painter, style: NodeStyle): void;

// app/src/nodeStyleChoice.ts — loadNodeStyleChoice / saveNodeStyleChoice, the themeChoice.ts pattern
```

The four styles:
- **classic**: today's card (title, id, dot at top right, badge text under it) plus the description as one dim line below the id. The port rows and everything below stay where they are because `NODE_HEADER` is unchanged; the description line fits in the header only if the header holds three lines, so classic may draw the description in the footer area below the params instead, and says so in its layout.
- **banner**: the header band tinted by the status colour at low alpha, the title on it, no dot; the badge text right-aligned in the band; description below.
- **chip**: no dot; a rounded status chip with the badge text ("Ok", "Needs setup") at the top right; description below the title.
- **bar**: a 4 px status-coloured bar down the card's left edge; title and id as today; description below.

Since the header height is fixed at 46, the builder decides per style whether the description goes in the header (dropping the id to a hover-free tooltip is not possible on canvas, so the id may move to the right of the title at a smaller size) or into a footer strip below the params. Either choice is fine; the layout function records it and the test asserts it. Truncate the description with `fitText` to the card width.

`topbar.ts` gains a "Node style" `<select>` next to the theme picker, calling `onNodeStyleChange(name)`; the supervisor connects it to `setNodeStyle` and `canvasEditor.refresh()`. `canvasParts.ts`'s `GraphNodePart.render` becomes a call to `renderNodeCard` (the note branch stays in canvasParts).

## Considered and rejected

- **Option:** Put the step list and the problems list in the pane area as new pane kinds. **Reason:** the pane area follows the answer node (TKT-81); these two views describe the whole graph, not one node, and would fight `applyShown`. **Would change if:** the pane area gains graph-scoped tabs.
- **Option:** Instantiate a template by PUTting the sample JSON from the client. **Reason:** sample documents carry `{SAMPLES}`-style placeholders the host resolves at seed time; a client PUT would carry them raw and the nodes would error. Copying the host's seeded copy has resolved paths. **Would change if:** the host gains a template-instantiate endpoint (extension point, TKT-14's third criterion).
- **Option:** Let styles change `NODE_HEADER` and port spacing. **Reason:** `portY` is shared by drawing, wire anchors, and the peek hit-test; a per-style height would thread a style parameter through `viewModel.ts`, `portGeometry.ts`, `canvasSlots.ts`, and every test fixture. **Would change if:** a style the owner picks needs a taller header; then the height becomes a style property in one place (`portGeometry.ts`).
- **Option:** Splice a dropped node into a wire (Studio Graph `wires.ts:386-447`). **Reason:** not one of the five items; it needs a wire hit test during a node drag and a third gesture on `canvasParts.ts`, which chunk F owns. Extension point, one ticket after this wave.
- **Option:** Docs on hover in this wave. **Reason:** the owner says another session started it. Chunk F's description line is the "nodes carry text" part only.

## Chunks

| Id | One-sentence commit | Fence (writes only) | Depends on | Test command | Resources |
|---|---|---|---|---|---|
| A | Connect the peek controller and hover listener to the canvas editor through a peekWiring module | `app/src/peekWiring.ts`, `app/src/canvasEditor.ts`, `app/test/peekWiring.test.ts` | contracts | `npm test -w @bimopenflow/app -- peekWiring`; typecheck | none |
| B | Generate a flow template catalog from the sample folders and show it as a start page | `scripts/build-flow-templates.mjs`, `app/src/templates.ts`, `app/src/templates.generated.ts`, `app/src/startPage.ts`, `app/test/templates.test.ts`, `app/test/startPage.test.ts` | contracts | `node scripts/build-flow-templates.mjs --check`; `npm test -w @bimopenflow/app -- templates startPage`; typecheck | none |
| C | A step list in the sidebar reads the flow as numbered steps with parameters, status, and row counts | `app/src/graphOrder.ts`, `app/src/stepList.ts`, `app/src/sidebar.ts`, `app/test/graphOrder.test.ts`, `app/test/stepList.test.ts`, `app/test/sidebar.test.ts` | contracts | `npm test -w @bimopenflow/app -- graphOrder stepList sidebar`; typecheck | none |
| D | A canvas palette: right-click opens it at the cursor, a dropped wire opens it filtered to compatible kinds, and each pick is one undo step | `app/src/paletteFilter.ts`, `app/src/addNodePlan.ts`, `app/src/canvasPalette.ts`, `app/src/nodeContextMenu.ts`, `app/test/paletteFilter.test.ts`, `app/test/addNodePlan.test.ts`, `app/test/canvasPalette.test.ts`, `app/test/nodeContextMenu.test.ts` | contracts | `npm test -w @bimopenflow/app -- paletteFilter addNodePlan canvasPalette nodeContextMenu`; typecheck | none |
| E | A problems strip under the canvas lists every node that is not Ok, root causes first | `app/src/graphProblems.ts`, `app/src/problemsPanel.ts`, `app/test/graphProblems.test.ts`, `app/test/problemsPanel.test.ts` | contracts | `npm test -w @bimopenflow/app -- graphProblems problemsPanel`; typecheck | none |
| F | Node drawing moves to nodeRender with four switchable styles that all show the description | `app/src/nodeStyle.ts`, `app/src/nodeRender.ts`, `app/src/nodeStyleChoice.ts`, `app/src/canvasParts.ts`, `app/src/topbar.ts`, `app/test/nodeStyle.test.ts`, `app/test/nodeRender.test.ts`, `app/test/canvasParts.test.ts`, `app/test/topbar.test.ts` | contracts | `npm test -w @bimopenflow/app -- nodeStyle nodeRender canvasParts topbar`; typecheck | none |
| G | Integration: app.ts and canvasEditor.ts wire the start page, step list, palette, problems strip, node style switch, and batch add; README lines | `app/src/app.ts`, `app/src/canvasEditor.ts`, `app/src/shell.ts`, `app/src/styles.ts`, `app/README.md`, `docs/plans/editor-ux-wave.md` | A–F | full app suite, typecheck, `npm run build -w @bimopenflow/app`, `node gates/web-smoke.mjs`; browser check on the tables profile | supervisor only |

All of A to F start at once; G is the supervisor's.

## Extension points

- Splice a dropped node into a wire (ticket after the wave).
- A host endpoint that instantiates a template with resolved paths, and a `description` on `AnalysisSummary`, so the start page needs no generated file.
- Row counts and the step list for relation wires once TKT-11's kill criterion (2 s per pass) is measured on Snowdon.
- Making the step list editable (reorder, insert) once principle 1's operations are exposed as list gestures.
- A style that changes header height, via a style property in `portGeometry.ts`.

## Build log
| Id | Commit | Result |
|---|---|---|
| G | 40228a7 | Integration: app suite 464 pass in 63 files, typecheck clean, vite build ok, browser check on the tables profile (see the commit message). Adds freshCopyId and ids.test.ts. |
| F | 2f88912 | 33 tests pass (full suite 461), typecheck clean; fence respected (9 files). Description goes in a hanging 18 px footer for classic and bar, in the header for banner and chip; nodeCardLayout takes a Measure; the topbar's style select is opt-in. |
| C | c873235 | 25 tests pass (full suite 432), typecheck clean; fence respected (6 files). Plan's worked example had a stray doors -> answer edge; the builder built it without, matching the "from only on the join" criterion. Steps section capped at 30% of the sidebar. |
| D | 480b8f8 | 33 tests pass, typecheck clean; fence respected (8 files). The listbox sits inside a positioned container (an input inside a listbox is invalid ARIA). addNodeActions places by socket y; no nodeHeight needed. |
| B | 5e1e511 | 12 tests pass, --check up to date (56 templates), typecheck clean; fence respected (6 files). federation-match and shared-color-legend (another session's uncommitted files) are included; --check fails if they move. DuckDB cards show the README's short shape text rather than workflows.json's description: revisit in G. |
| E | 532d1cd | 12 tests pass, typecheck clean; fence respected (4 files). Strip is position:absolute; the canvas host is already position:relative. |
| A | 8544984 | 3 tests pass, typecheck clean; fence respected (3 files). createCanvasEditor takes a trailing optional readPort; app.ts passes boundCtx.requestTable in G. |

## Wave record

Outcome: success for TKT-11, TKT-95, TKT-96, TKT-97, TKT-98 (closed). TKT-14 stays open: its first cut (a start page generated from the sample folders, Open and Copy) is done; "needs-setup badges for a template whose inputs the model lacks" and grouping by persona rather than folder are not.
Gates: `npm test -w @bimopenflow/app` 464 pass in 63 files (baseline 363 in 49); `npm test -w @bimopenflow/state` 56 pass; `npm run typecheck -w @bimopenflow/app` clean; `npm run build -w @bimopenflow/app` ok; `node scripts/build-flow-templates.mjs --check` up to date. `node gates/web-smoke.mjs` FAIL on one pre-existing test, `@bimopenflow/api-client` "covers every fetch-backed endpoint" (the client lacks one endpoint the contract lists; neither file changed in this wave, last commit 130c910). Every other step of the gate passed, including the new `@bimopenflow/graph` package's 228 tests. Browser check on the tables profile (`bof-review-tables-host` and `-web`): start page, steps with row counts, right-click palette, one-step undo, wire-drop palette, chip style, peek card, problems strip.
Commits: contracts 30cb244, plan f7ae075, A 8544984, E 532d1cd, B 5e1e511, D 480b8f8, C c873235, F 2f88912, G 40228a7, tickets 7bc5370.
Findings: the plan's step-list example had a stray edge (fixed in the plan). The `bof-tables` launch entry cannot build while another session's host holds `artifacts/bim-flow/host`; `bof-rel-web` passes `5310` to Vite as a root directory, not a port (a launch.json fix for a separate commit; the file has another session's uncommitted edit). B includes two graph files another session has not committed (`federation-match.json`, `shared-color-legend.json`); `--check` will fail if they move. DuckDB cards show the README's short shape text rather than `workflows.json`'s description. The TKT-94 session (graph package) asked for no module-level state in canvas files; G complies, but `nodeStyle.ts` (F) keeps the current style at module scope, which that session will make per instance.
Timing: about 75 minutes from contracts to G; builders ran 1 to 10 minutes each in parallel (F longest at 10); a sequential build would have been about 35 minutes of builder time plus the same integration, so the wave saved roughly 25 minutes; no builder was blocked.
