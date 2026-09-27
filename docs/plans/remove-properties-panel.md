# Remove the properties panel: every parameter is edited on its node

Status: building
Request: TKT-22. Remove the properties panel (`paramsPane.ts`) from the BimOpenFlow web editor so that every node parameter is edited on its node card. The owner decided this in TKT-5 (2026-09-26): "Scalar parameters live in the graph. Always. The properties panel should be thrown out." Json, Expression, ModelRef, and long Text move onto the node, and a long value opens an editor anchored to the node. Every edit goes through `setParam` and reverts in one undo step. TKT-23 follows and will make each parameter kind a richer control on the card, so each parameter row and the way its control is chosen must stay fixed for TKT-23 to build on.
Open questions (each has a default, so none blocks the build; the supervisor took the defaults on 2026-09-26):
1. Parameters whose descriptor sets `control.kind: "hidden"` could only be edited in the pane. These are `duck.query.path`, `table.sort.by`, and `table.sort.descendingA/B/C` (the sort-column control already sets the `descending*` values). After this feature, only agents, MCP, and the document itself can change them. Default: they stay hidden, because hiding them was the node author's choice.
2. The ticket says `inspectorPane.ts` holds the 3D pane's picked-element property sets. It does not: `inspectorPane.ts` is the node Inspector tab, and it shows a read-only list of parameters. The 3D property sets are in `viewPane3D.ts` and `entityProperties.ts`. Default: leave all of `packages/panes` untouched, as the criterion asks. A read-only list is not an editing path. If the owner counts it as "a second place to look", removing it becomes its own ticket.
3. `npm test` in `bimopenflow/web` fails with `Missing script: "test"` because the root `package.json` has no `test` script. Default: the plan uses `npm test --workspaces --if-present`, which runs every package's tests. Adding a root script would change a file outside the ticket's fence.
4. Chunk C9 updates three documents outside the ticket's fence (`NOTES.md` and two proposals). Decision: the fence is widened to those three files; the ticket's fence line records it.

## Brainstorm
skipped

## Acceptance criteria
- `src/paramsPane.ts` and `test/paramsPane.test.ts` are deleted. `choosePanes` never returns `"params"`, so the tab strip offers no Params tab. The Inspector tab stays. Nothing under `bimopenflow/web` references `paramsPane`, `createParamsPane`, or `bof-app-params`.
- Every `ParamKind` in `contracts/contracts.json` has a control on the node card. `KIND_CONTROL` is a `Record<ParamKind, SlotControl>`, and `SLOT_FACTORIES` is a `Record<SlotControl, SlotFactory>`. When a kind is added to `contracts.json`, the typecheck fails until both tables have a row for it. A kind the client does not know, sent by a newer host, falls back to the plain text field.
- Each kind gets this control:
  - Boolean: toggle.
  - Enum: dropdown.
  - Integer, Number, Fraction, and Percent: number field. A `slider` or `range` descriptor keeps its widget.
  - Text, FilePath, DateTime, and ModelRef: text field. A Text parameter with a ColumnsOf suggestion source keeps its live suggestion list, and a `sortColumn` descriptor keeps the column picker.
  - Json and Expression: a long-text row.
  - Text with a line break or more than 60 characters, no suggestion source, and no control descriptor: a long-text row.
- A long-text row shows a one-line preview. Pressing it opens a multi-line editor anchored under the row. The editor follows pan, zoom, and node moves. Apply, Ctrl+Enter or Cmd+Enter, or clicking outside the editor commits. Escape or Cancel discards. Only one editor is open at a time.
- Every commit from any on-node control is exactly one `setParam` through the canvas `setParam` intent. One undo restores the previous value. Committing unchanged text dispatches nothing.
- Nodes show every non-hidden parameter as its own row, as they do today.
- `npm test --workspaces --if-present` (from `bimopenflow/web`) and `node gates/web-smoke.mjs` (from the repository root) pass. `test/nodeParams.test.ts` replaces the pane's test and covers Json, Expression, ModelRef, Text with ColumnsOf suggestions, and the range control.
- `bimopenflow/web/packages/panes/**` is unchanged, including `inspectorPane.ts`, `entityProperties.ts`, and `viewPane3D.ts`. `sidebar.ts` and `duckdbDemo.css` are unchanged.
- Excluded:
  - the rich controls (swatch, slider with a typed value, column picker for every ColumnsOf parameter), which are TKT-23;
  - typed number entry for a `range` band, which the pane had and the canvas lacks (drag only) until TKT-23's typed slider;
  - JSON validation messages;
  - model-list suggestions for ModelRef;
  - collapsing parameter groups;
  - the catalog collapse (TKT-27) and the Ask panel (TKT-25);
  - any C# or catalog change;
  - editing hidden parameters (open question 1).

Evidence:
- `npm test --workspaces --if-present` lists `test/nodeParams.test.ts` as passing, with a case for each of Json, Expression, ModelRef, ColumnsOf Text, and range, and `paramsPane.test.ts` no longer appears.
- `node gates/web-smoke.mjs` ends with `WEB SMOKE: PASS`.
- `git grep -n -E "paramsPane|createParamsPane|bof-app-params" -- bimopenflow/web` prints nothing.
- `git diff --stat <first chunk's parent>..HEAD -- bimopenflow/web/packages/panes bimopenflow/web/packages/app/src/sidebar.ts bimopenflow/web/packages/app/src/duckdbDemo.css` prints nothing.
- Optional manual check by the owner in `npm run web`: a `check.rule` node shows `Expr` and `Review expr` rows; clicking one opens the editor under the node; Ctrl+Enter applies the edit; Ctrl+Z (with focus on the canvas) restores the old value.

Kill criteria: none for the feature, because the owner's decision is final. For the design of the anchored editor: if C5 finds that a gratify island cannot show a focused `<textarea>` outside its row's rectangle, stop C5 and report. Examples would be the island layer clipping to the node or taking pointer events away from the textarea. The fallback is recorded under "Considered and rejected". Gratify must not change.

## Design

**What the pane holds that the node card does not (question 1).** `inlineParams` in `canvasSlots.ts` filters by the `INLINE` set, so Json, Expression, and ModelRef never reach the card. The pane also shows parameters with a `hidden` control, and it allows typed entry for a `range` band. Every other kind is already on the card: `canvasControls.ts` draws toggles, dropdowns, and DOM "island" inputs (a gratify island is a real DOM element pinned to a world-space rectangle), and `graphWidgets.ts` draws sliders and ranges.

**One row per parameter, with the control chosen from the descriptor.** This is the structure TKT-23 builds on. Three pieces replace the four places that list kinds today (the `INLINE` set, the `slotHeight` switch, the `placeSlots` ternary, and the `slotElement` if/switch chain):
1. `slotControl(param)` in `canvasSlots.ts` is a pure function. It checks the descriptor's `control.kind` first (`sortColumn`, `slider`, `range`), then `KIND_CONTROL[param.kind]`, then the long-Text rule. The plain text field is the fallback.
2. `CONTROL_HEIGHT` in `canvasSlots.ts` gives each row's height, so `placeSlots` and `nodeHeight` stay free of gratify.
3. `SLOT_FACTORIES` in a new file, `slotRegistry.ts`, maps each control to the gratify element that draws it.

TKT-23 adds a `SlotControl` member, a height, a factory module, and a rule in `slotControl`. The row itself, its placement, and the `setParam` path stay where they are.

This is the registry that `docs/proposals/param-data-types.md` proposes, keyed by control instead of by kind. The reason for the difference is under "Considered and rejected".

**The long-value editor.**
- `longValueEditor.ts` is plain DOM with no gratify: a wrapper holding a `<textarea>` and Apply and Cancel buttons. It decides when to commit and when to discard.
- `canvasLongSlot.ts` is the gratify part. It paints the label and a one-line preview, and pressing it emits `openEditor`.
- Which editor is open is transient presentation state, stored in the canvas document as `CanvasModel.openEditor`, the same way the selected wire is. The canvas update function handles the `openEditor` and `closeEditor` intents. `sync` keeps the open editor while its node and parameter still exist, so an evaluation update arriving mid-typing does not close it.
- While a row is open, its island facet returns the editor's wrapper with a rectangle under the row: at least 360 by 200 world pixels. Gratify's island layer moves it with pan and zoom, so it stays anchored to the node.
- The editor must be an island on the row itself, not a gratify adornment. `Runtime.syncIslands` walks only the main tree and never the adornment tree (`submodules/gratify/src/gratify/runtime.ts`, `syncIslands`), so an island inside an adornment would never be mounted.

**Node card with many parameters (question 2).** All non-hidden parameters stay visible, one row each. That is today's behaviour and the usual one in node editors (Blender and ComfyUI show every widget on the node). The busiest nodes show about 8 rows today, and this feature adds at most two, on `check.rule`. A collapsed group is recorded as the alternative.

**One undo step per edit (question 4).** In `packages/state/src/reducer.ts`, `edited()` pushes one snapshot of the whole document per `setParam`, whether or not the value changed. The inline islands already commit only on `change`, Enter, or blur, and only when the canonical value differs (`canvasControls.ts`, `islandFor` → `commit`). The long editor follows the same rule: it commits once, when the editor closes, and only if the text changed. It does not commit on each keystroke, and it has no debounce, because a debounce would turn each pause into an undo step and an autosave of half-typed text. `makeCanvasUpdate` sends `select` and then `setParam`, and `select` adds no undo step. Nothing in `packages/state` changes.

**Tests without a browser (question 5).** The app tests run in vitest with jsdom (`packages/app/vitest.config.ts`). `test/canvasControls.test.ts` already calls a part's `island()` facet directly to get its DOM element, and it drives `Runtime` headless for gratify-drawn presses. The pane's single test, a typed range band, becomes a test of `rangeSlot`'s `set` callback. The three kinds the pane held get a new `test/nodeParams.test.ts`. It builds a row with `slotElement`, gets the island element, fires DOM events, feeds the dispatched intents through `makeCanvasUpdate` into a real store, and checks the document value and one `undo`.

**Pane removal (question 3).** Once no pane emits `setParam`, the following code has no caller: the `"params"` pane kind, the pane area's `setParam` handling, the `onSetParam` dependency and its wiring in `app.ts`, and the CSS rules. The Retires line lists all of it.

**Libraries.** No new library. Everything stays in `@bimopenflow/app`. `packages/panes` and `packages/state` are unchanged.

Retires:
- `src/paramsPane.ts`, including its `editorFor` if-chain, and `test/paramsPane.test.ts`.
- `"params"` in `PaneKind` and in `choosePanes`; `PANE_LABELS.params`; the `"params"` case in `paneFactory`; the `activeKind === "params"` test in `feedData`.
- The `setParam` branch of `onPaneEvent`; `PaneAreaDeps.onSetParam`; its wiring in `app.ts` (lines 115-116); the two `onSetParam: () => {}` stubs in `test/paneArea.test.ts`.
- The three `.bof-app-params` rules in `src/styles.ts` (lines 113-118).
- From `canvasSlots.ts`: the `INLINE` set, `isInlineKind` and its test, the `slotHeight(kind)` switch, and the control ternary inside `placeSlots`.
- From `canvasControls.ts`: the `slotElement` chain (it moves to `SLOT_FACTORIES`), and `layoutOf` with its `IslandLayout` type (replaced by `slotControl`). The private dispatch holder, `islandKey`, and `styleIsland` move to `slotShared.ts`.
- The `paramsPane.ts` entry in `packages/app/README.md`.

Not retired, recorded as debt: `PaneContext.requestSuggestions` and `PaneInput["inspect"].nodeId` in `packages/panes/src/pane.ts` no longer have a pane that uses them, but they sit outside the fence. The Inspector tab's read-only Params list also stays (open question 2).

## Considered and rejected
- **Option:** keep a smaller pane just for Json, Expression, and ModelRef, which was TKT-5's default.
  **Reason:** the owner rejected it on 2026-09-26: a second place to look is exactly what the decision removes.
  **Would change if:** the owner reopens TKT-5.
- **Option:** put the editor in a gratify modal adornment, the way the Enum option list works, with a textarea island inside it.
  **Reason:** `Runtime.syncIslands` collects islands only from `this.root` and never from `adornRoot`, so the textarea would never be mounted, and gratify must not change.
  **Would change if:** gratify starts collecting islands from adornments.
- **Option:** a free DOM popover outside gratify, placed from `runtime.viewport`. This is also the fallback for C5.
  **Reason:** it duplicates the island placement math and has to be re-placed on every pan, zoom, and node move by hand.
  **Would change if:** C5 hits the kill criterion above.
- **Option:** a single-line input with an "expand" button for Json and Expression.
  **Reason:** `<input type="text">` removes line breaks from its value, so one edit in the small field would rewrite a multi-line JSON, expression, or SQL value. The long-text row therefore shows a painted preview and never an input.
  **Would change if:** the stored forms of these values could never contain line breaks.
- **Option:** `Map<ParamKind, EditorFactory>`, keyed by kind, as `param-data-types.md` §1 proposes.
  **Reason:** the control depends on kind, descriptor, and value together (a slider on Fraction, a column picker on Text, long Text). Keying by kind would push those rules back into each factory. The plan keeps a per-kind default table (`KIND_CONTROL`) and keys the factories by control, which is the shape TKT-23 needs.
  **Would change if:** descriptors stop overriding the kind's default control.
- **Option:** one module per editor group now (scalars, dates, colours).
  **Reason:** the existing parts share one file and one island registry, and splitting them adds no capability in this feature.
  **Would change if:** TKT-23 adds its controls; each new control gets its own module then.
- **Option:** collapse parameter rows beyond a fixed number behind an expand toggle.
  **Reason:** it is less common in node editors and hides values that people scan for; no node shows more than about 10 rows.
  **Would change if:** a catalog node shows more than 10 rows, or cards in the sample graphs overlap after C7.
- **Option:** commit from the textarea while typing, with a debounce.
  **Reason:** every pause would become an undo step and an autosave-plus-evaluation of a half-typed expression.
  **Would change if:** the state package gains undo steps that merge several edits.
- **Option:** choose long Text by an author annotation (`control.kind: "multiline"`) instead of by length and line breaks.
  **Reason:** it requires changing C# node specs, which is outside this web-only ticket. The line-break rule is needed for correctness anyway.
  **Would change if:** TKT-23 or a catalog change adds the annotation. `slotControl` already checks `control.kind` first, so it is a one-line rule.

## Signatures and contracts
All paths are under `bimopenflow/web/packages/app/src/`. Chunks treat these as read-only. They were not compiled during planning, because the planner writes no files. The chunk that introduces each one runs `npm run typecheck -w @bimopenflow/app` first.

`slotShared.ts` (new, C1). Island plumbing shared by every on-node control:
```ts
import type { Tokens } from "gratify";
import type { CanvasIntent } from "./canvasIntents.js";
/** Key of one parameter row: "nodeId::name". */
export const islandKey = (nodeId: string, name: string): string => `${nodeId}::${name}`;
/** canvasEditor registers the runtime's dispatch after mount. */
export function setInlineControlDispatch(fn: (intent: CanvasIntent) => void): void { throw new Error("stub"); }
/** DOM-side commits (islands, the long-value editor) enter the canvas intent flow here. */
export function dispatchInline(intent: CanvasIntent): void { throw new Error("stub"); }
/** Border, background, font, and focus colour from the canvas theme. */
export function styleIsland(el: HTMLInputElement | HTMLTextAreaElement, palette: Omit<Tokens, "mix">): void { throw new Error("stub"); }
```
Example: `islandKey("f1", "expr")` returns `"f1::expr"`.

`canvasSlots.ts` (additions in C2):
```ts
/** The control a parameter row shows. TKT-23 adds members (swatch, typed slider, column picker). */
export type SlotControl =
  | "toggle" | "dropdown" | "number" | "slider" | "range" | "columnSelect" | "field" | "longText";

/** Default control per kind. The Record forces a row for every ParamKind. */
export const KIND_CONTROL = {
  Boolean: "toggle", Enum: "dropdown",
  Integer: "number", Number: "number", Fraction: "number", Percent: "number",
  Text: "field", FilePath: "field", DateTime: "field", ModelRef: "field",
  Json: "longText", Expression: "longText",
} as const satisfies Record<ParamKind, SlotControl>;

/** Row height per control: compact 32, field 50, widget 70. */
export const CONTROL_HEIGHT: Readonly<Record<SlotControl, number>>;
// toggle, dropdown, number, columnSelect: COMPACT_SLOT_H; field, longText: FIELD_SLOT_H; slider, range: WIDGET_SLOT_H

/** Plain Text longer than this, or with a line break, gets the long-text row. */
export const LONG_TEXT_CHARS = 60;

/** Descriptor control first (sortColumn -> columnSelect, slider, range), then
 *  KIND_CONTROL, then the long-Text rule (Text, no suggest, no control). Unknown kind -> "field". */
export function slotControl(param: Pick<CanvasParam, "kind" | "value" | "control" | "suggest">): SlotControl { throw new Error("stub"); }

/** Replaces slotHeight(kind). */
export function slotHeight(param: Pick<CanvasParam, "kind" | "value" | "control" | "suggest">): number { throw new Error("stub"); }

/** Whitespace runs (including line breaks) collapsed to one space, trimmed,
 *  cut to maxChars with a trailing "…". */
export function previewText(value: string, maxChars: number): string { throw new Error("stub"); }

/** What a slot factory receives for one parameter row. */
export interface SlotContext {
  readonly nodeId: string;
  readonly param: CanvasParam;
  /** Row width in world pixels (node width minus side padding). */
  readonly w: number;
  /** True when CanvasModel.openEditor names this row. */
  readonly open: boolean;
}
```
Examples:

| Call | Result |
|---|---|
| `slotControl({kind:"Fraction", value:"0.5", control:{kind:"slider", min:0, max:1}})` | `"slider"` |
| `slotControl({kind:"Text", value:"select *\nfrom doors"})` | `"longText"` |
| `slotControl({kind:"Text", value:"a,b", suggest:{kind:"ColumnsOfInput", source:"table"}})` | `"field"` |
| `slotControl({kind:"ModelRef", value:"duplex.bos"})` | `"field"` |
| `slotControl({kind:"Color" as ParamKind, value:"#ff8800"})` | `"field"` |
| `previewText('{\n  "a": 1\n}', 20)` | `'{ "a": 1 }'` |
| `previewText("area > 10 AND level = 'L1'", 12)` | `"area > 10 A…"` |
| `previewText("", 12)` | `""` |

`viewModel.ts` and `canvasIntents.ts` (C3):
```ts
// viewModel.ts
/** The parameter whose long-value editor is open; at most one. */
export interface OpenEditor { readonly nodeId: string; readonly name: string; }
export interface CanvasModel {
  readonly nodes: readonly CanvasNode[];
  readonly edges: readonly CanvasEdge[];
  readonly selectedEdgeId: string | null;
  readonly openEditor: OpenEditor | null;   // buildCanvasModel returns null
}
// canvasIntents.ts: CanvasIntent gains
  | { kind: "openEditor"; nodeId: string; name: string }
  | { kind: "closeEditor" }
```
Update rules:
- `openEditor` sets the field and does not touch the store.
- `closeEditor` sets the field to null.
- `sync` with `doc.openEditor === null` returns `intent.model` itself. This keeps the existing test "routes sync to a full model replacement", which checks for the same object.
- Otherwise `sync` returns `{ ...intent.model, openEditor: doc.openEditor }` when the new model still has that node with that parameter, and `intent.model` when it does not.

Example: with `f.expr` open, a `sync` after `removeNode f` gives `openEditor: null`.

`longValueEditor.ts` (new, C4). Plain DOM, no gratify, no intents:
```ts
export interface LongValueEditorOpen {
  /** Accessible name and heading, e.g. "Rules (JSON)". */
  readonly label: string;
  /** Value loaded when opening, and the target of a discard. */
  readonly value: string;
  /** At most once per opening, only when the text differs from value. */
  readonly onCommit: (value: string) => void;
  /** Exactly once per user-initiated close (commit or discard), after onCommit. */
  readonly onClose: () => void;
}
export interface LongValueEditor {
  /** Stable wrapper (textarea + Apply + Cancel), z-index 1; the caller places it. */
  readonly el: HTMLElement;
  readonly textarea: HTMLTextAreaElement;
  /** Loads value, focuses the textarea. */
  open(request: LongValueEditorOpen): void;
  isOpen(): boolean;
  /** Closes silently (no callbacks): the canvas closed the editor itself. */
  close(): void;
  /** close() plus removal of listeners and the element. */
  dispose(): void;
}
export function createLongValueEditor(doc: Document): LongValueEditor { throw new Error("stub"); }
```
Commit triggers: Apply, Ctrl+Enter or Cmd+Enter, and a `focusout` whose `relatedTarget` is outside `el`. Discard triggers: Cancel, and Escape (which calls `stopPropagation`). Plain Enter inserts a newline.

Example: `open({ value: '{"a":1}', ... })`, the user types `{"a":2}` and presses Ctrl+Enter. `onCommit('{"a":2}')` runs once, then `onClose()` runs once, and `isOpen()` is false. Apply with unchanged text calls only `onClose`.

`canvasLongSlot.ts` (new, C5):
```ts
import type { Element } from "gratify";
import type { SlotContext } from "./canvasSlots.js";
/** Label + painted preview; Press -> {kind:"openEditor"}; when ctx.open, its island is
 *  the editor placed at rect(r.x, r.bottom + 4, max(r.w, 360), 200). Commits dispatch
 *  {kind:"setParam"} then {kind:"closeEditor"} through dispatchInline. */
export function longTextSlot(ctx: SlotContext): Element { throw new Error("stub"); }
/** Disposes editors whose islandKey is not live. */
export function pruneLongValueEditors(liveKeys: ReadonlySet<string>): void { throw new Error("stub"); }
```
Example: `longTextSlot({nodeId:"f", param:{name:"expr", kind:"Expression", value:"area > 10"}, w:240, open:false})` paints `Expr` over a box reading `area > 10`, and its island facet returns null. Pressing the row returns `{kind:"openEditor", nodeId:"f", name:"expr"}`. With `open: true`, the facet returns the wrapper and the textarea holds `area > 10`. Typing `area > 20` and pressing Ctrl+Enter dispatches `{kind:"setParam", nodeId:"f", name:"expr", value:"area > 20"}` and then `{kind:"closeEditor"}`.

`slotRegistry.ts` (new, C6):
```ts
import type { Element } from "gratify";
import type { SlotContext, SlotControl } from "./canvasSlots.js";
export type SlotFactory = (ctx: SlotContext) => Element;
/** One factory per control. C6 maps longText -> fieldSlot; C7 maps it to longTextSlot. */
export const SLOT_FACTORIES: Readonly<Record<SlotControl, SlotFactory>>;
/** Clears a stale open-dropdown flag unless the control is "dropdown", then builds the row. */
export function slotElement(ctx: SlotContext): Element { throw new Error("stub"); }
/** pruneInlineControls, plus pruneLongValueEditors from C7 on. */
export function pruneSlots(liveKeys: ReadonlySet<string>): void { throw new Error("stub"); }
export function disposeSlots(): void { throw new Error("stub"); }
```

`canvasControls.ts` exports after C6. `slotElement` is removed from this file. Unchanged: `setSuggestionProvider`, `refreshColumnOptions`, `SuggestionProvider`, `pruneInlineControls`, `disposeInlineControls`.
```ts
export function toggleSlot(ctx: SlotContext): Element;
export function dropdownSlot(ctx: SlotContext): Element;
/** Compact island (label left, input right); key defaults to param.name ("field" inside a slider). */
export function numberSlot(ctx: SlotContext, key?: string): Element;
/** Caption + full-width island input (text, FilePath, DateTime, ModelRef, color). */
export function fieldSlot(ctx: SlotContext, key?: string): Element;
export function columnSlot(ctx: SlotContext): Element;
export function clearOpenDropdown(nodeId: string, name: string): void;
```
`canvasParts.ts` calls `slotElement({ nodeId: n.id, param, w: n.w - 2 * SLOT_X_PAD, open: model.openEditor?.nodeId === n.id && model.openEditor.name === param.name })`.

## Extension points
- TKT-23's rich controls: a new `SlotControl` member, a `CONTROL_HEIGHT` row, a factory module registered in `SLOT_FACTORIES`, and a rule in `slotControl`. The row, its placement, and the `setParam` path stay unchanged.
- A `control.kind: "multiline"` descriptor that forces `longText` without the length rule.
- Model-list suggestions for ModelRef fields (a datalist from `api.listModels`).
- A JSON parse warning under the textarea that never blocks the commit (PROJECT.md principle 6).
- Opening the editor above the row when the row sits near the bottom of the viewport.
- Retiring `PaneContext.requestSuggestions` and `PaneInput["inspect"].nodeId` in `packages/panes/src/pane.ts`, with an app-level `SuggestionProvider` type in their place.
- A reducer rule that makes a `setParam` with an unchanged value a no-op. Today, picking the current Enum option again adds an undo step that reverts nothing.
- Promoting a node parameter to a graph parameter in one gesture (`docs/CANDIDATE-WORK.md`).

## Chunks
Commands run from `C:\Users\cdigg\git\bim-open-toolkit\bimopenflow\web` unless marked. `APP` means `npm test -w @bimopenflow/app`. `TC` means `npm run typecheck -w @bimopenflow/app`. Fence paths are relative to `bimopenflow/web/packages/app/` unless they start at the repository root.

Order:
- C1, C2, C3, and C4 can run in parallel.
- C5 and C6 can run in parallel after that.
- Then C7, C8, and C9, in that order.

C8's fence does not overlap any earlier chunk, so it can be built at any time. It is ordered after C7 only so that no pushed commit leaves Json and Expression without an editor.

| Id | One-sentence commit | Fence (writes only) | Depends on | Test command | Resources |
|---|---|---|---|---|---|
| C1 | Move the island dispatch, row key, and island styling out of canvasControls into slotShared | `src/slotShared.ts` (new), `src/canvasControls.ts`, `src/canvasEditor.ts`, `test/canvasControls.test.ts` (import path only) | - | `APP && TC` (a refactor, so all 182 existing tests pass) | none |
| C2 | Add the slot control vocabulary (SlotControl, KIND_CONTROL, slotControl, CONTROL_HEIGHT, previewText, SlotContext) and derive row heights from it | `src/canvasSlots.ts`, `test/canvasSlots.test.ts` | - | `APP -- test/canvasSlots.test.ts test/viewModelParams.test.ts && TC` | none |
| C3 | Track the open long-value editor in the canvas model with openEditor and closeEditor intents | `src/viewModel.ts`, `src/canvasIntents.ts`, `test/canvasIntents.test.ts`, `test/autoLayout.test.ts` (adds `openEditor: null` to its literal) | - | `APP -- test/canvasIntents.test.ts test/autoLayout.test.ts test/viewModelParams.test.ts && TC` | none |
| C4 | Add the DOM long-value editor that commits once on close and discards on Escape | `src/longValueEditor.ts` (new), `test/longValueEditor.test.ts` (new) | - | `APP -- test/longValueEditor.test.ts && TC` | none |
| C5 | Add the long-text row that previews a value and opens the anchored editor under the node | `src/canvasLongSlot.ts` (new), `test/canvasLongSlot.test.ts` (new) | C1, C2, C3, C4 | `APP -- test/canvasLongSlot.test.ts && TC` | none |
| C6 | Route every parameter row through a control-keyed slot registry | `src/slotRegistry.ts` (new), `src/canvasControls.ts`, `src/canvasParts.ts`, `src/canvasEditor.ts`, `test/canvasControls.test.ts` | C1, C2, C3 | `APP && TC` (a refactor, so no test changes except the `slotElement(ctx)` call form; the only behaviour difference is that a sort-column row now also clears a stale dropdown flag) | none |
| C7 | Put Json, Expression, ModelRef, and long Text on the node card | `src/slotRegistry.ts`, `src/canvasSlots.ts` (drop `INLINE` and `isInlineKind`; `inlineParams` keeps every kind except hidden ones), `test/canvasSlots.test.ts`, `test/viewModelParams.test.ts`, `test/nodeParams.test.ts` (new: Json, Expression, ModelRef, ColumnsOf Text, range, one undo step, unchanged text dispatches nothing, every `KIND_CONTROL` key has a factory) | C5, C6 | `APP && TC` | none |
| C8 | Remove the properties panel and the pane code that only it used | delete `src/paramsPane.ts` and `test/paramsPane.test.ts`; edit `src/paneChoice.ts`, `test/paneChoice.test.ts`, `src/paneArea.ts`, `test/paneArea.test.ts`, `src/app.ts`, `src/styles.ts`, `README.md` (drop `paramsPane.ts`; describe `slotRegistry.ts`, `slotShared.ts`, `canvasLongSlot.ts`, `longValueEditor.ts`) | C7 | `npm test --workspaces --if-present && TC && git grep -n -E "paramsPane\|createParamsPane\|bof-app-params" -- .` (expect no matches), then from the repository root `node gates/web-smoke.mjs` | `packages/app/dist` (the smoke gate's production build; one runner at a time) |
| C9 | Point the parameter-editor documents at the on-node registry | repository root: `NOTES.md` (dated TKT-22 note after line 254), `docs/proposals/param-data-types.md` (dated note in §1 naming `KIND_CONTROL` and `SLOT_FACTORIES` in place of `editorFor`), `docs/proposals/live-param-suggestions.md` (dated note where it names the params pane). Never `docs/proposals/snowdon-federation.md`. | C8 | from the repository root: `git grep -n "paramsPane" -- NOTES.md docs/proposals` (every match is inside a dated TKT-22 note) | none |

Baseline gates (2026-09-26, before any change):
- `npm test --workspaces --if-present`: all pass (api-client 18, app 182 in 32 files, panes 130, state 51, viz 43).
- `npm run typecheck -w @bimopenflow/app`: clean.
- `npm test` at `bimopenflow/web`: fails with `Missing script: "test"` (open question 3).
- `node gates/web-smoke.mjs`: not run by the planner, because its production build writes `packages/app/dist`. The first builder of C8 records its result before starting.

## Build log
| Id | Commit | Result |
|---|---|---|
| C1 | aa84655 | 193 tests pass (C3 and C4 had landed), typecheck clean; fence respected (4 files). styleIsland widened to textarea per contract. |
| C2 | 154b95a | 22 tests pass, typecheck clean; fence respected (2 files). slotHeight(Json) now FIELD_SLOT_H, not 0, as the plan intends. |
| C3 | 31df786 | 20 tests pass; fence respected (4 files). Fixture uses a Text param because INLINE still gates the card until C7. |
| C5 | 0e12b6c | 6 tests pass; fence respected (2 new files). Kill criterion not hit: the island facet places the editor under the row like the inline islands. Editor keeps C4's fixed palette; theme styling deferred to debt. |
| C6 | 5c1791c | 214 tests pass, typecheck clean; fence respected (5 files). IslandSlotProps carries an explicit layout so layoutOf could go. |
| C7 | 51b3e3e | 221 tests pass, typecheck clean; fence respected (5 files). Builder stalled after finishing; supervisor verified and committed. |
| C8 | ebc91d6 | Pane deleted; all workspaces pass (api-client 18, app 220, panes 130, state 51, viz 43); smoke gate PASS before and after. One stale mention left in nodeParams.test.ts, folded into C9. |
| C9 | 6e98baf | Dated notes in NOTES.md and both proposals; no paramsPane mention left under bimopenflow/web. Three pre-existing narrative lines in the proposals still name the pane as history; accepted, since the notes above them say it is gone. |
| C4 | 86c23e4 | 11 tests pass, typecheck clean; fence respected (2 new files). Reentrancy guard added so a focusout during onClose cannot double-commit. |

Wave 1 integrated (C1 to C4): `npm run typecheck -w @bimopenflow/app` clean, `npm test -w @bimopenflow/app` 33 files, 208 tests pass; pushed. Wave 2 (C5, C6): typecheck clean, 34 files, 214 tests pass; pushed. C7 and C8 integrated with TKT-25 and TKT-27 in the same checkout: `node gates/web-smoke.mjs` PASS; pushed.

## Review findings

## Debt and extension points

## Report
