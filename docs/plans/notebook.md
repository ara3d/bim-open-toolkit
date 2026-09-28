# Analysis notebook prototype

Status: building

Ticket: TKT-80. Design and imagined sessions: [notebook-sessions.md](../proposals/notebook-sessions.md).

## Brief

- **Request (owner, 2026-09-27):** a notebook prototype, with samples that follow the processes the NRC repository (`nrc-ifc-llm`) asks for. It is a new kind of document: the transcript of a session with the agent (the Claude Code command line), with graphs, pictures, and 3D models embedded. The user can also ask for editing, saving, loading, and creating files. Build it as a separate module that reuses the existing code without changing it much; where the existing code must change to be reusable, extend it; where something must be duplicated, record how to remove the duplicate.
- **Workflow:** 2 in `PROJECT.md` (ask in plain language and get a graph you can inspect), with samples that reach workflows 3 (chart), 4 (3D), and 5 (verdicts).
- **Size:** several plans (a new module and a new persisted format). This plan is the first part: the document, its embeds, the turn loop, and samples. Scripts, Run, Editor, and Diff embeds, and the static export are later parts (Extension points).
- **Owner checkpoint:** the persisted format is new. It lives only in this package and its samples, is tagged `bimopen-notebook/0.1`, and nothing else reads it yet, so work proceeds on it and the owner reviews it with the samples.

## Acceptance criteria

1. `samples/notebooks/nrc-eight-questions.notebook.json` opens in the page with no host. It has nine turns: one per question in `samples/nrc/questions.txt`, verbatim, then a follow-up asking for a chart. Its embeds carry the expected answers in `nrc-ifc-llm/poc/results/expected_answers.json` (Q1 37,196.2 kgCO2e/yr; Q7 not available).
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
| N1 | 013a843 | 20 tests; validator reports every problem with its path; `kind` serialized first in each embed |
| N2 | f675afb | 26 tests; untouched turns stay reference-equal |
| N3 | 7f898ab | 13 tests; table and verdict panes reused as they are |
| N4 | dde5ce1 | 6 tests; the chart pane neither emits nor accepts selection (Debt) |
| N5 | 725e33d | 14 tests; the editor ignores `?analysis=` on its main page (Debt) |
| N6 | c8b0d3d | 9 tests; six app helpers reused by path; feed order repeated in `planFeed` (Debt) |
| N7 | a3f551e | 22 tests; `readAskEvents` gained an optional abort signal; embeds only when `done.built`; Q1's graph returns two columns, so N10's outlines can mark a value embed |
| N8 | 2438782 | 21 tests |
| N9 | f4b2dcb | 17 tests; page bundles; turn controls updated by class name because `TurnHandle` has no `setCanAsk` (Debt) |
| N10 | 8066b34 | 15 tests; three samples generated from outlines, every number matches `expected_answers.json`; DC-W1 8 Pass, 6 Fail |

Verified in the browser pane (2026-09-27, `notebook-web` on 5350 against `notebook-studio` on 5366, tables profile): the eight-questions sample opens and renders nine turns; Re-evaluate all reports 19 current, 0 changed, 0 unavailable; the door-check sample shows the verdict pane (Pass 8, Fail 6) and a 3D placeholder; a live request reached the Claude Code command line and came back as a turn carrying its error ("Not logged in"), and Undo removed it.

## Wave 2: reconstructed sessions

Owner's direction, 2026-09-27: the end result is judged as a fixed document, so subagents play the agent and write the replies, while every embed is still computed by the host. The outline format gains the fields in `samples/notebooks/README.md`, "Outline extensions for reconstructed sessions" (the contract for this wave). One shared host: `notebook-studio` in `.claude/launch.json`, bim profile, port 5366, store `artifacts/notebook/bim-store` (seeds the NRC graphs, the Duplex model, and Snowdon).

| Id | One-sentence commit | Fence (writes only) | Depends on | Test |
|---|---|---|---|---|
| W1 | The sample script saves an outline's own graphs and takes tools, stale, earlier, pictures, and charts | `bimopenflow/web/packages/notebook/scripts/**` | - | regenerate the three existing samples byte-identical; a fixture outline using every new field |
| W2 | Fixes from the first look in the browser | `src/embeds/value.ts`, `src/embeds/graph.ts`, `src/ask/reply.ts`, `src/page/shellStyles.ts`, their tests | - | the package's tests |
| A1 to A9 | One reconstructed session each: S1, S5, S6, S7, S8, S9, S10, S11, S13 | `samples/notebooks/outlines/<name>.outline.json`, `samples/notebooks/graphs/<name>/**` | - (generation waits on W1) | every graph Ok on the shared host; every number in a reply read from the host |
| G | Generate every outline and check each reply's numbers against its snapshots | `samples/notebooks/*.notebook.json`, `bimopenflow/web/packages/notebook/test/samples.test.ts` | W1, A1 to A9 | `test/samples.test.ts` |

S12 (a Script embed) is left out: the Script embed is not built.

| Id | Commit | Result |
|---|---|---|
| W1 | 08a1b2a | the three existing samples regenerate identical; a five-turn fixture outline uses every new field; a broken outline reports each problem with its JSON path |
| W2 | 623cc35, fabe78e, 4f19e23, aa8843a, 0c92c8e | five fixes, 174 tests |
| A3 (S6) | ffda157 | 4 turns, seeded graphs only |
| A9 (S13) | c3a1a2b | 4 turns; the package request says no package builder exists (TKT-12) |
| A4 (S7) | 98755ba | 6 turns; 216 matched, 21 rooms with no file row, 52 file rows on unmeshed entities |
| A2 (S5) | 549d7f2 | 5 turns; 2,441 values on 224 entities; no Run called |
| A8 (S11) | 795861f | 5 turns; an earlier version and three stale turns |
| A1 (S1) | 4e6aa4a | 5 turns, five graphs |
| A6 (S9) | da9fc90 | 5 turns; no IDS node exists, so `check.required` stands in; roof fails embodied carbon |
| A7 (S10) | 68060d2 | 5 turns over the private Snowdon model; 142 doors, 290 rooms and spaces; door width has no clear-width parameter, so 6 of 10 doors are not available |
| A5 (S8) | 22e8266 | 5 turns; the zone grouping is a table, since there is no editor embed; zone EUI is reported as not available |
| G | 1c89f7b, 0704d65 | twelve notebooks; `{SNOWDON}` replaces a committed machine-local path; notebooks name repository-relative paths; the S5 graph file renamed to its analysis id; 213 tests |
| (owner request, TKT-80) | b231280 | 3D embeds mount by default: an IntersectionObserver (rootMargin 800px 0px) shows the pane once the embed scrolls near the viewport, and mounts immediately where IntersectionObserver is missing (jsdom in tests); a shown pane is never auto-disposed on scroll-away, since a notebook's few embeds stay well under the browser's ~16 live-context cap, so Hide/Show remains the only way to close and reopen one. 12 tests in `test/view3d.test.ts` (3 new), 244 total, clean type check |

## Review findings

## Debt

Duplicates and reach-ins made on purpose, each with what removes it. Filed as tickets on 2026-09-27: TKT-86 (client library: deep imports, ask reader, 3D feed order), TKT-87 (stateless evaluate: restores, placeholders, the Snowdon path, store writes), TKT-88 (chart selection and re-reads), TKT-89 (editor `?analysis=`), TKT-90 (one checker and turn builder), TKT-91 (new embed kinds, an idea).

- **Deep imports from `@bimopenflow/app`.** `src/embeds/contract.ts` imports `ResultApi` from `app/src/paneContext`, and chunks N3 to N9 import `makePaneContext`, `choosePanes`, `firstTableOutput`, `chartPaneOptions`, `watchHost`, and the 3D feed helpers (`modelRef`, `completeTable`, `liveViewRecipe`) by path. An application's internals are not a library's API. Fix: move these pure modules into a client library package (for example `packages/client`, below `app`), re-export them from `app` so its callers do not change, and switch the notebook's imports. Blocked while `app/src` files are in claimed fences (TKT-11, 12, 26).
- **The `/api/ask` stream reader.** `src/ask/events.ts` copies `readEvents` and the `AskEvent` shape from `app/src/duckdbDemo.ts`, where they are page-local. Fix: move both into the client library above, generate `AskEvent` from `contracts/contracts.json` beside the other wire types, and have `duckdbDemo.ts` import them. `duckdbDemo.ts` is in TKT-26's fence.
- **The 3D feed order.** `planFeed` in `src/embeds/view3d.ts` (about 40 lines) repeats how `feedModel` and `feedData` in `app/src/paneArea.ts` choose model, then view, boxes, or instances; those are closures inside `createPaneArea`. Fix: extract the choice as a pure function beside `completeTable` in the client library, used by both. The deep-import list above also includes `app/src/modelCatalog` and `app/src/paneArea` (`hostMessage`).
- **Charts outside shared selection.** `createChartPane` never emits a selection and ignores a selection input, so the chart embed takes no part in it. Fix: in `panes/src/chartPane.ts`, emit a selection on a bar click and highlight bars from a selection input; `panes/**` is TKT-16's fence.
- **"Open in editor" cannot open a given graph.** Only `3d.html` reads `?analysis=`; the editor's `main.ts` does not, so the graph embed's link opens the analysis list. Fix: read `analysisFromSearch` in `app/src/main.ts` as `graphDemo.ts` does.
- **A chart re-read keeps only the snapshot's row count.** `compareWithHost` reads as many rows as the snapshot holds, so a chart whose table grew redraws with the old number of bars (the total is right). Fix: charts snapshot their whole table (they are small by design), or the chart renderer reads `totalRows` rows on "changed".
- **Restoring a raw sample graph finds no model.** A graph restored with PUT keeps `{SAMPLES}` placeholders that only seeding replaces, so a 3D embed on it matches no catalog model. Fix: the stateless evaluate endpoint, or restoring through the host's seeding path. Graph embeds now store repository-relative paths (`hidePlaceholders` in `scripts/outline.ts` strips the checkout root), which resolve only when the host runs from the repository root, as `scripts/start-bim-flow.mjs` does.
- **The Snowdon default path, twice.** `snowdonPath` in `scripts/outline.ts` repeats `BimSampleSeeding.SnowdonPath` in the host (environment variable, then Documents), because the host fills `{SNOWDON}` only when it seeds. Fix: the same as the item above; the script then sends placeholders as they are.
- **The outline checker.** `outlineErrors` in the sample script repeats the path-tagged checking of `src/document/io.ts`, whose combinators are private. Fix: export `field` and `checkObject` from `io.ts` (or a small `document/check.ts`) and build both checkers on them.
- **Stale and earlier added outside `edits.ts`.** The sample script stitches `stale` and `earlier` onto the turn `appendTurn` returns. Fix: an `appendTurn` option, or build reconstructed turns with `resendTurn`.
- **Formats the sessions could not express.** No embed kind for a diff (S5), a run record (S5, S8), an editable table (S8), or a graph parameter (S7's template); no chart styling or SVG export (S6's original turn 4); no selection event in an outline (S1's click). Each was written as reply text instead. Fix: the extension points above; each becomes an embed kind when the feature behind it exists.
- **Re-evaluation writes to the analysis store.** Restoring a missing analysis uses `PUT /api/analyses/{id}`. Fix: a stateless evaluate endpoint (see Considered and rejected).

## Outcome

2026-09-27. Twelve sample notebooks under `samples/notebooks`: the three NRC notebooks from wave 1, and nine reconstructed sessions (S1, S5 to S11, S13), each labelled as reconstructed on the page. The replies were written by agents playing each session; every embed was computed by the `notebook-studio` host (bim profile) from committed graphs, 20 of them new under `samples/notebooks/graphs`.

- Re-evaluate all in the page, against the host that wrote them: every embed backed by a graph is current (56 across the nine sessions), none changed, none unavailable.
- A read-only checker compared every number in every reply with its snapshots, the host, and the files on disk. It found six wrong claims in five sessions; all were corrected in the outlines (87c44f3) and regenerated (6d76e92). The embeds had no errors.
- The review of wave 2 found five defects and seven design notes; all were fixed, one commit each (62aa3f3, f91d944, 77431eb, 99800c9, 985106f, 3ca8f33, 9a53124, fd566b8, aabbbde, 816631f, ed3bc31).
- The package has 241 tests and a clean type check.

Not met: acceptance criterion 3 (a live request answered by Claude) was shown only as far as the request reaching the Claude Code command line, which was not logged in. The owner chose reconstructed transcripts for evaluation instead. S12 (a Script embed) is not built.
