# Analysis notebook prototype

Status: building

Ticket: TKT-80. Design and imagined sessions: [notebook-sessions.md](../proposals/notebook-sessions.md).

## Brief

- **Request (owner, 2026-09-27):** a notebook prototype, with samples that follow the processes the NRC repository (`nrc-ifc-llm`) asks for. It is a new kind of document: the transcript of a session with the agent (the Claude Code command line), with graphs, pictures, and 3D models embedded. The user can also ask for editing, saving, loading, and creating files. Build it as a separate module that reuses the existing code without changing it much; where the existing code must change to be reusable, extend it; where something must be duplicated, record how to remove the duplicate.
- **Workflow:** 2 in `PROJECT.md` (ask in plain language and get a graph you can inspect), with samples that reach workflows 3 (chart), 4 (3D), and 5 (verdicts).
- **Size:** several plans (a new module and a new persisted format). This plan is the first part: the document, its embeds, the turn loop, and samples. Scripts, Run, Editor, and Diff embeds, and the static export are later parts (Extension points).
- **Owner checkpoint:** the persisted format is new. It lives only in this package and its samples, is tagged `bimopen-notebook/0.1`, and nothing else reads it yet, so work proceeds on it and the owner reviews it with the samples.

## Acceptance criteria

1. `samples/notebooks/nrc-eight-questions.notebook.json` opens in the page with no host. It has eight turns, one per question in `samples/nrc/questions.txt`, and its embeds carry the expected answers in `nrc-ifc-llm/poc/results/expected_answers.json` (Q1 37,196.2 kgCO2e/yr; Q7 not available).
2. Against a tables-profile host, "Re-evaluate" marks each embed backed by a node as current, changed (showing was and now), or unavailable.
3. Against the studio host, a typed request appends a turn built from the `/api/ask` events: the reply text, the tool calls, and embeds for the graph's answer nodes. A follow-up continues the same analysis.
4. Save downloads a `.notebook.json` that parses back to an equal notebook; Open loads one; the page lists the committed samples.
5. Editing and resending a request keeps the old reply as an earlier version and marks later turns stale. Delete and undo work.
6. Embeds of kind value, table (verdict tables as verdicts), chart, graph, view3d, picture, and file render from their snapshots.
7. `npm run typecheck -w @bimopenflow/notebook` and `npm test -w @bimopenflow/notebook` pass, and `node gates/web-smoke.mjs` still passes.

Kill criteria: none; this is a prototype whose purpose is to be looked at.

## Design

A new workspace package, `bimopenflow/web/packages/notebook` (`@bimopenflow/notebook`), with its own page (`notebook.html`) and Vite config, so no file of `packages/app` changes. Many of those files are in claimed tickets' fences (TKT-11, 12, 26).

- **Document** (`src/document/`): the format types, parse and serialize, and pure edits with an undo history. A notebook is a list of turns, each a request and a reply; a reply is text, tool calls, and embeds; every embed has a snapshot. Snapshots use the host's own `TableSlice` type.
- **Embeds** (`src/embeds/`): one renderer per kind behind one contract (`contract.ts`). Each draws its snapshot at once and compares with the host on `refresh()`. They mount the existing panes: `createTablePane`, `createVerdictPane`, `createChartPane`, `createViewPane3D`. The graph embed shows the host's GraphText print (`GET /api/analyses/{id}/text`) and links to the editor; the canvas editor cannot be mounted twice on a page.
- **Live** (`src/live/compare.ts`): snapshot against the host's current result, shared by every renderer.
- **Ask** (`src/ask/`): the `/api/ask` stream, and a reply built from its events plus `embedsForAnalysis`, which picks embeds for the graph's answer nodes using `choosePanes`, `firstTableOutput`, and `chartPaneOptions` from `packages/app`.
- **Page** (`src/page/`): one turn's view, the notebook view (toolbar, turns, request box, undo), and the entry point.
- **Samples** (`samples/notebooks/`): notebook files written by a script from outlines (the requests and reply texts) and a running host, so every number in a sample comes from a graph.

Retires: nothing.

## Considered and rejected

- **Option:** a notebook as a reading view of one graph (the first draft of the proposal). **Reason:** the owner's correction, 2026-09-27: a notebook is a transcript with embedded things, like a Jupyter notebook, not a view of a graph. **Would change if:** notebooks turn out to be edited more than read, and the transcript gets in the way.
- **Option:** add the page to `packages/app` (one more HTML entry). **Reason:** `app.ts`, `paneArea.ts`, `selection.ts`, and others are in claimed tickets' fences, and `app` is an application, not a library. A separate package keeps the fence disjoint. **Would change if:** the notebook becomes a tab of the studio.
- **Option:** embed the canvas editor for graph embeds. **Reason:** `createCanvasEditor` keeps page-wide singletons (`slotShared.ts`, `canvasControls.ts`, `canvasTheme.ts`) and has no read-only mode, so two cannot share a page. **Would change if:** the canvas moves to its own package with instance state (the `packages/graph` that `docs/graph-module-layering.md` names).
- **Option:** a host endpoint that evaluates a graph sent in the body without saving it, for re-evaluation. **Reason:** `Host.Api` is in TKT-12 and TKT-26's fences; the prototype re-evaluates through the analysis store (a missing analysis is restored with PUT from the embedded document). **Would change if:** notebooks start writing analyses the user never asked to keep.

## Signatures and contracts

Committed before any builder starts; builders treat them as read-only.

- `src/document/format.ts`: `Notebook`, `Turn`, `Request`, `Reply`, `ToolCall`, `NodeRef`, `TableSnapshot`, and the `Embed` union.
- `src/embeds/contract.ts`: `NotebookApi`, `Freshness`, `EmbedContext`, `EmbedHandle`, `EmbedRenderer`, `EmbedRegistry`.
- `src/embeds/selection.ts` (built): `SelectionBus`, `createSelectionBus`.
- `src/live/compare.ts` (built): `snapshotOf`, `sameSnapshot`, `describeSnapshot`, `compareWithHost`, `SNAPSHOT_ROWS`.
- `src/embeds/registry.ts` (built): `defaultRenderers`, `renderEmbed`.
- Stubs that throw until their chunk lands: `src/document/io.ts`, `src/document/edits.ts`, every `src/embeds/<kind>.ts`, `src/ask/events.ts`, `src/ask/reply.ts`, `src/page/turnView.ts`, `src/page/notebookView.ts`, `src/page/main.ts`.
- `vite.config.ts` serves `samples/notebooks` read-only at `/__notebooks/` (a JSON list at `/__notebooks/`, one file at `/__notebooks/<name>`).

## Extension points

- Script, Editor, Run, Diff, and Verdicts-with-citation embeds (sessions S4, S5, S8, S9, S12).
- A static HTML export with every snapshot inlined (S11, S13).
- Shared selection published to the host's `/api/session`, so the agent reads it (principle 7; waits on TKT-26).
- A still image of each 3D view taken when it is shown.

## Chunks

Contracts: this plan's first commit. Baseline gates: notebook typecheck clean, 8 tests pass.

Test command for every chunk, from `bimopenflow/web/packages/notebook`: `npx vitest run <its test files>` and `npx tsc --noEmit -p .` (errors in other chunks' files are theirs).

| Id | One-sentence commit | Fence (writes only) | Depends on | Test | Resources |
|---|---|---|---|---|---|
| N1 | Read, validate, and write notebook files | `src/document/io.ts`, `test/io.test.ts` | - | `test/io.test.ts` | none |
| N2 | Pure notebook edits with an undo history | `src/document/edits.ts`, `test/edits.test.ts` | - | `test/edits.test.ts` | none |
| N3 | Value and table embeds, with verdict tables as verdicts | `src/embeds/value.ts`, `src/embeds/table.ts`, `test/valueTable.test.ts` | - | `test/valueTable.test.ts` | none |
| N4 | Chart embed on the chart pane | `src/embeds/chart.ts`, `test/chart.test.ts` | - | `test/chart.test.ts` | none |
| N5 | Graph, picture, and file embeds | `src/embeds/graph.ts`, `src/embeds/picture.ts`, `src/embeds/file.ts`, `test/graphPictureFile.test.ts` | - | `test/graphPictureFile.test.ts` | none |
| N6 | 3D embed on the view pane | `src/embeds/view3d.ts`, `test/view3d.test.ts` | - | `test/view3d.test.ts` | none |
| N7 | Ask stream and replies built from it | `src/ask/events.ts`, `src/ask/reply.ts`, `test/askEvents.test.ts`, `test/askReply.test.ts` | - | both test files | none |
| N8 | Turn view with freshness badges | `src/page/turnView.ts`, `src/page/styles.ts`, `test/turnView.test.ts` | - | `test/turnView.test.ts` | none |
| N9 | Notebook view, toolbar, request box, and page entry | `src/page/notebookView.ts`, `src/page/main.ts`, `src/page/files.ts`, `src/page/shellStyles.ts`, `test/notebookView.test.ts` | N1, N2 | `test/notebookView.test.ts` | none |
| N10 | NRC sample notebooks written from a running host | `samples/notebooks/**`, `scripts/**` (in the package), `test/samples.test.ts` | N1, N7 | `test/samples.test.ts` | host ports 5362 (tables) and 5364 (bim), own store and cache under `artifacts/notebook-samples/` |

Supervisor-owned: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `notebook.html`, `README.md`, `src/index.ts`, the contracts above, `bimopenflow/web/package-lock.json`, and `.claude/launch.json`.

## Build log

| Id | Commit | Result |
|---|---|---|

## Review findings

## Debt

Duplicates and reach-ins made on purpose, each with what removes it:

- **Deep imports from `@bimopenflow/app`.** `src/embeds/contract.ts` imports `ResultApi` from `app/src/paneContext`, and chunks N3 to N9 import `makePaneContext`, `choosePanes`, `firstTableOutput`, `chartPaneOptions`, `watchHost`, and the 3D feed helpers (`modelRef`, `completeTable`, `liveViewRecipe`) by path. An application's internals are not a library's API. Fix: move these pure modules into a client library package (for example `packages/client`, below `app`), re-export them from `app` so its callers do not change, and switch the notebook's imports. Blocked while `app/src` files are in claimed fences (TKT-11, 12, 26).
- **The `/api/ask` stream reader.** `src/ask/events.ts` copies `readEvents` and the `AskEvent` shape from `app/src/duckdbDemo.ts`, where they are page-local. Fix: move both into the client library above, generate `AskEvent` from `contracts/contracts.json` beside the other wire types, and have `duckdbDemo.ts` import them. `duckdbDemo.ts` is in TKT-26's fence.
- **Re-evaluation writes to the analysis store.** Restoring a missing analysis uses `PUT /api/analyses/{id}`. Fix: a stateless evaluate endpoint (see Considered and rejected).

## Outcome
