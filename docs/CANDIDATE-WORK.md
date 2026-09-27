# Candidate work

The ideas scattered across this repository's documents, gathered on 2026-09-26, deduplicated, and tied to the workflows and principles in [PROJECT.md](../PROJECT.md). It exists so that new work is picked from one list against one brief, instead of rediscovered in a proposal from a month ago.

How it was made: nine readers each took one group of documents (architecture, the handoff assessment, agent proposals, UX proposals, the pre-rewrite PlatoFlow design, the NRC plans, the demo guides and skills, the wave notes, the node-vocabulary proposals) and returned users, use cases, principles, ideas, UX findings, agent-integration notes, process lessons, and stale claims, each with its source file. Five synthesis passes merged those by field. Every item below keeps its source so the reasoning can be checked. A status of *built*, *partial*, or *idea* reflects what the newest document says; the repository was last worked on 2026-09-18.

## How to define new work from this list

1. Pick an item. Name the PROJECT.md workflow it serves (W1 to W6) and take the acceptance criteria from that workflow's Done line. An item that serves no workflow is either out of scope or a reason to add a workflow to the brief; say which.
2. Check the item against the nine principles. The ones most often at stake: one edit path (does the feature add a second way to change a graph?), nothing writes until Run, honest absence, and the catalog is the documentation.
3. File it: `python ~/.claude/plugins/marketplaces/platonic/scripts/ticket.py --dir tickets new "<title>" --criterion "..." --body "Serves W<n>. ..."`. Put the ticket id on the item's line here and move it out of this list when the ticket closes.
4. Anything that changes a shared contract (`contracts/`, a wire type, a parameter kind) is a plan, not a small job.

## The first stretch, in order

The items below have tickets. Decide TKT-2 first, in one sitting with TKT-1 and TKT-4 if possible; item 3 waits on it. TKT-22, removing the properties panel, was decided on 2026-09-26 and runs alongside the list. The order puts the measurement and the one known wrong answer first, because every later item on the AI aim is judged against them, then the clean-clone start and the studio chart pane (the two things the owner will feel first), then the Run that unlocks exports and reports, then the canvas and 3D work.

| # | Ticket | Item | Serves | Why now |
|---|---|---|---|---|
| 1 | TKT-8 | Measure the Claude backend on the committed ten-question set and record the transcript | W2 | The host already prefers Claude, but every published number is gpt-5's and the questions exist only as prose; every Ask change afterwards needs this baseline. |
| 2 | TKT-18 | Fix the double count in the IFC ask (Q8 answered twice the expected carbon) | W2, W6 | Small, and a shipped MCP server giving a confident wrong number breaks principle 4 and the Claude aim directly. |
| 3 | TKT-7 | Snowdon graphs open green from a clean clone plus the private files | W1 | The seeded store is tied to one machine, so only the owner can show the real model; needs TKT-2 answered first. |
| 4 | TKT-9 | One start page and one supported first run | W1 | Professional starts at minute one: today a newcomer meets a port trap (host 5210, editor proxy 5214), two terminals, and a private path. |
| 5 | TKT-20 | A chart pane in the DuckDB studio | W3 | The studio shows tables only; without this the owner's first aim has no surface in the app. |
| 6 | TKT-13 | Sample graphs with charts across every populated Snowdon table family | W1, W3 | The samples touch storeys, spaces, doors, and roofs; the export holds walls, floors, pipes, ducts, and materials nobody has charted. Waits on TKT-2, TKT-7, TKT-20. |
| 7 | TKT-12 | Run from the editor: a Run button, the run record, sinks that execute, an evidence package | W3, W5, W6 | Charts export, reports, evidence packages, and write-back all wait on a Run the editor cannot start. |
| 8 | TKT-19 | The walkthrough's Duplex half and the paper's eight answers run in CI on every push | W6 | Cheap insurance on W2, W4, and W5 while the canvas work below changes the app; the Snowdon half stays on the owner's machine. |
| 9 | TKT-11 | Peek at any wire: hover a port for its table, row counts on wires | W2, W3 | Every workflow flows tables, so this is the highest-leverage canvas feature and the one that makes the tool fun. |
| 10 | TKT-10 | Node state badges that name the upstream cause, and a "Run to see results" hint | W2, W3 | The most repeated UX ask; the autosave and SSE mechanism it needs is built. |
| 11 | TKT-17 | Agent edits arrive selected, undoable, and as a reviewable diff | W2 | Makes Claude's work inspectable inside the editor instead of appearing after a reload. |
| 12 | TKT-15 | A coarse first frame for Snowdon under 2 s warm | W4 | 5.2 to 5.8 s of blank canvas is the roughness a reviewer feels first. |
| 13 | TKT-16 | One colour domain with a legend across panes | W4, W3 | The PoC's most common novice trap was a silently clamped manual domain; a shared legend is what makes a coloured model and its chart agree. |
| 14 | TKT-14 | A template gallery keyed to the workflow list | W1, W2 | Turns the 44 enumerated V1 workflows into the entry point, so most people never start from a blank canvas (principle 9, unconfirmed; waits on TKT-4). |

## Everything gathered, by theme

Each line: the item, its status, who or which workflow it serves, and its source.

### Editor and pane UX

- Port and wire peeking with row counts. Partial: click-to-inspect pages 1000 rows; no badge on the wire. All graph authors. `docs/proposals/bimopenflow-ux-proposal.md` §4 item 2; `docs/proposals/table-graph-layers.md` "The editor on top". TKT-11.
- Node state badges (`Ok`, `Unready`, `EffectPending`, `Unavailable`, `Error`) on the node, naming the upstream cause; schema errors shown before anything runs. Partial: `rel.*` reports misspelled columns before a run; badges wait on autosave and SSE. `docs/ARCHITECTURE.md` "Failure is a state"; `docs/proposals/live-param-suggestions.md` §5. TKT-10.
- A status vocabulary of three states (needs setup, waiting on upstream, upstream error), a "Run to see results" hint, and an empty query as needs-setup rather than an error. Idea. `docs/platoflow/README.md` item 6; `NOTES.md` sandbox UI wave. Folded into TKT-10.
- Drag from a port to a palette filtered to compatible nodes; insert a node on a wire; incompatible sockets never highlight. Idea. `bimopenflow-ux-proposal.md` §4 item 9.
- Expression editor with column-name autocomplete (reusing the `ColumnsOf` endpoint) and live what-if; English `describe(plan)` tooltips. Idea. `bimopenflow-ux-proposal.md` §4 item 9; `table-graph-layers.md` Layer 3.
- Show a node's inferred schema before it is clicked; a catalog refresh gesture when a CSV gains a column. Idea. `table-graph-migration.md` "What stays open".
- Verdict pane with rollups by rule and category, drill-through to offenders, citations, click-to-highlight in 3D, and an override with a reason written to a property set. Partial: `bimopenflow/web/packages/panes/src/verdictPane.ts` exists; drill-through unverified. W5. `bimopenflow-ux-proposal.md` §4 item 6; `docs/platoflow/platoflow-compliance-design.md` §6.
- Provenance cards answering "where did this number come from". Idea. W5. `bimopenflow-ux-proposal.md` §4 item 7.
- Shared colour-map legend across panes; `view3d.color` v2 with a manual domain and a legend table that reports the domain in use. Idea. W4. `bimopenflow-ux-proposal.md` §5 P1; `docs/proposals/core-node-sets.md` Set 4. TKT-16.
- Sinks that visibly say "will write on Run"; run history; a read-only run view; run-versus-run diff. Idea. W3, W5. `bimopenflow-ux-proposal.md` §4 item 8. TKT-12 covers the first.
- Promote a node parameter to a graph parameter in one gesture; a control strip on templates; date bounds as the report's date-range control. Idea. `bimopenflow-ux-proposal.md` §4 item 10; `docs/proposals/data-node-sets.md` `date.filter`. TKT-5 decided that parameters live on the node and the properties panel goes (TKT-22); the promotion gesture stays an idea.
- Groups and subgraphs with promoted ports, canvas annotations, a minimap. Idea; the PoC had `graph.sub` and the rewrite dropped it. `bimopenflow-ux-proposal.md` §4 item 12.
- A checklist selection node with live check boxes and counts on the card (`bos.selectType` rendered as a checklist), the PoC's most valued missing feature. Idea. `docs/platoflow/README.md` item 1; `core-node-sets.md`.
- Harvest from the deleted PoC editor: node-as-inspector layout, floating popover, per-instance resize, multi-select copy, paste, duplicate, and align, a range slider on the colour-map node. Abandoned in the rewrite; deliberate harvesting only. `docs/platoflow/README.md` item 5.
- Parameter-kind editors: Color, ColumnRef and ColumnList (58 `ColumnsOf` sites), Vector3, Angle, Rotation3, Bounds3D with capture from the viewport, gradients, palettes, intervals, text lists; an editor registry replacing the `editorFor` if-chain; a unit suffix on a parameter. Fraction, Percent, and Unit are built; the rest is idea. `docs/proposals/param-data-types.md` §1 to §4.
- Conditional parameter visibility per enum value (`table.window`). Idea. `data-node-sets.md`.
- Rename analyses in the sidebar (`untitled-N` is permanent today); name Ask-built graphs; reframe save as "snapshot this version". Idea. `live-param-suggestions.md` §5; `docs/bim-flow-mcp-demo.md` "Limits".
- Adding a catalog node as one undo step, not three; coalesce pending PUTs per analysis. Partial. `NOTES.md` Track APP; `live-param-suggestions.md` §7.
- A per-graph eager-recompute toggle under a row-count threshold; result paging for large `rel.materialize`. Idea. `table-graph-layers.md`.
- Vocabulary: people never see "workflow"; the unit is an "analysis" and "graph" is the canvas; "run" appears only when a sink or a check is involved. Idea. `docs/platoflow/platoflow-graph-semantics.md` §4 to §5. TKT-4 decides.
- Asks of the Gratify canvas library: `setDoc` external sync, generic anchor metadata, `hitAt`, listener teardown, synchronous redraw on resize, published widgets, the docking manager moved upstream. Idea. `docs/graph-module-layering.md`; `NOTES.md` Track APP.

### Onboarding and first run

- One authoritative start page and one supported first run: a table graph, the synthetic gallery, optional Snowdon routes, ports and stores made explicit, a dependency preflight, start and stop. Idea, P0. `docs/REPOSITORY-HANDOFF.md` P0. TKT-9.
- Fix the port trap (host default 5210, editor proxy 5214), the two-command two-terminal start, and `npm run demo` launching the older alpha gallery. Idea. `REPOSITORY-HANDOFF.md` "Launch instructions". TKT-9.
- A template gallery keyed to the 44 V1 workflows, each opening a working graph with its parameters exposed. Idea, P0. `bimopenflow-ux-proposal.md` §4 item 5. TKT-14.
- A guided tour under Help (the PoC had "Run walkthrough"). Abandoned. `docs/platoflow/README.md` item 4.
- A five-step handoff demonstration: seeded table graph, synthetic inspector with a missing fact, editable 3D Snowdon graph, typed door schedule with a NULL clear width, what saves versus what needs Run. Idea. `REPOSITORY-HANDOFF.md` "Suggested first handoff demonstration".
- Classify demos as public workflow, developer lab, or historical; label galleries by audience; finish or drop the 16 unregistered V2 gallery demos. Partial. `REPOSITORY-HANDOFF.md` P2.
- Decouple demos from fixed private paths (the Documents BOS path, `snowdon-cli.duckdb`); a separate `--store` for a fresh demo; a converter that refuses to overwrite. Idea. `BIMOPENFLOW.md`; `docs/bim-flow-duckdb.md` "Start". TKT-7.

### Ask box and Claude integration

- Measure the Claude backend on the same request set as OpenAI, with `scripts/ask-bim-flow.mjs --file requests.txt` and `ANTHROPIC_API_KEY_FILE`. Partial. W2. `docs/bim-flow-mcp-demo.md` "Measuring it". TKT-8.
- Persist Ask conversations across host restarts; allow concurrent requests; a graph-naming tool; authentication. Idea. `bim-flow-mcp-demo.md` "Limits".
- Rewrite an ambiguous request into a question instead of guessing ("biggest" rooms when area is NULL). Idea. `bim-flow-mcp-demo.md` "Measuring it".
- Validate `duck.query` SQL at `setParam`, not at evaluate. Idea. `bim-flow-mcp-demo.md` "Limits".
- Agent edits arrive selected, undoable, and animated into view; ghost nodes, a topology diff, accept or reject. Idea, P2. `docs/graph-module-layering.md` "Why"; `bimopenflow-ux-proposal.md` §4 item 11. TKT-17.
- An `sql.ask` node: an English question to SQL stored visibly in the node, generation reachable from the inspector and from MCP, "fix with AI" on SQL errors, the prompt kept as provenance. Idea; where the model call lives is open. `core-node-sets.md` `sql.ask`; `docs/platoflow/platoflow-ifc-design.md` 5.1.
- Copilot ideas: generate a subgraph from a prompt, explain a graph, fix type errors, suggest the next node; a Classify node mapping messy type names to a taxonomy. Idea. `platoflow-ifc-design.md` 5.1, 5.3.
- A session copilot with a written mandate and a run record (mandate version, model hash, graph, verdict counts, disposition); agent definition bundles; trust levels T0 to T3. Idea, pre-rewrite. `docs/platoflow/platoflow-agent-concepts.md` §1 to §5.
- Standing checks: a background auditor re-running approved QA graphs when a model changes; a drift watcher over BOS conversions; a model-diff summariser. Idea; needs a batch runner and a trigger. `docs/OVERVIEW.md` "What it could become"; `platoflow-agent-concepts.md` §1.2.
- Guard agents against double counting through `StoreyOfEntity`; let `rel.sql` name other views; a graph-level Run so agents can execute effects. Idea. `docs/plans/nrc-handoff/track-e.md` findings 2 and 8. TKT-18, TKT-12.
- A viewer MCP bridge: one typed command set shared by the UI and MCP; the V2 `mcp` package is an empty export. Partial, stopped 2026-09-08. `docs/plans/visualization/PRODUCT-BRIEF.md` F23.
- SDK asks: a string enum converter in the MCP JSON, host and MCP sharing one process and session, a transport-free JSON-RPC handler. Idea. `NOTES.md` Track HOSTMCP.

### Analysis and charts over Snowdon and other models

- Sample graphs beyond four Snowdon entity kinds: the export holds walls, windows, floors, pipes, ducts, and materials, and the nine samples query storeys, spaces, doors, and roofs only. Idea. W1, W3. `docs/bim-flow-duckdb.md` "Workflows". TKT-13, after TKT-2.
- Three finished representative workflows (door schedule with coverage, editable 3D inspection, typed SQL to table), each with provenance, missing values shown, and save and reopen. Partial. `REPOSITORY-HANDOFF.md` P1.
- A chart pane in the DuckDB studio, which shows tables only today. Idea. W3. `docs/bim-flow-duckdb.md`. TKT-20.
- Bridge the DuckDB studio and the 3D page so a query result colours the model: the two run on different hosts and data today, so PROJECT.md puts query-driven colouring out of this stretch. Idea. W3, W4.
- Remaining chart nodes: `view3d.colormap`, legends, pie, scatter. Idea. W3. `core-node-sets.md` Set 4; `progress-notes/wave-view3d-viz.md` non-goals.
- Node packs for cost, schedule, energy, and embodied carbon; what-if through the expression language; massing nodes. Idea. `docs/OVERVIEW.md`.
- A batch runner applying one graph to many models; the model as a graph parameter (project versus library analysis); a library graph that reports absence instead of half-working. Idea. `platoflow-graph-semantics.md` §1, §4.
- Several models in one graph with a model id on values. Abandoned in the PoC. `docs/platoflow/README.md` item 3.
- The compliance track: a `RuleCheck` node grown from the door-clearance rules, a rule intermediate representation, "open this rule as a graph", golden-corpus approval, a facts plane, a rule-authoring surface. Idea. W5 eventually. `platoflow-compliance-design.md` §2 to §8.
- The prepared multi-building query platform over 467 BOS files: prepared open in seconds, a data atlas of the corpus, optional spatial backends. Partial. `docs/proposals/bim-query-platform/PLAN.md`. TKT-21 asks whether it is in this stretch.
- Expression and table gaps: a numeric cast (`toNumber` landed 2026-09-18), `rel.rename`, variadic `table.concat`, a first-class Date column, multi-column cast and replace, pinned `table.profile` columns. Idea. `track-e.md` finding 5; `data-node-sets.md` open questions.

### Node vocabulary

- `bos.selectType` and `bos.selectLevel` (containment depth undecided), a `bos.parameters` pivot, retiring `bos.query` for `sql.query`, migrating `bim.containment` and `bim.nearest` onto `spatial.*`, oriented-box extents in `view3d.measures`, polygon booleans, a nullable-scalar column convention, mesh-to-mesh clash. Idea or partial. `core-node-sets.md` Set 3 and open questions 5 to 7; `docs/proposals/spatial-node-set.md`.
- Engine injects parameter defaults; a Support-level `Project(table, indices, rowOrder)`; graduating `Ara3D.DuckDb`; a resolved-points DuckDB view; an `IRelationExecutor` seam. Idea or partial. `NOTES.md` BimAnalysis wave; `docs/plans/flow-demos/PLAN.md`.
- Port the remaining `table.*` and `duck.*` kinds to relations; `sources.json` with names and connection strings; a freeze rule for registry sources inside a Run; a size-bounded materialisation cache; raise the 16-table inline store bound. Partial. `table-graph-migration.md` "Status on 2026-09-18". TKT-7 needs the sources part.
- Graph document migration tooling (saved graphs pin kind and version; the registry is empty). Partial. `NOTES.md` Tracks SPEC and MIG.

### 3D viewer

- A coarse preview for Snowdon ahead of the full load, render preparation ahead of time, worker decoding, interruptible loading. Idea. W4. `docs/bim-flow-startup.md` "Remaining opportunities"; `docs/bim-flow-3d.md` "Limits". TKT-15.
- One canonical viewer composition through `createViewer` across the gallery, feature pages, slice and occlusion labs, and the BIM pane. Idea, P1. `REPOSITORY-HANDOFF.md` P1.
- Per-instance colour buffers before about 20,000 instances (2 s per recolour at 300,000), ranged `markColorsChanged`, per-instance visibility and picking data, picking that respects hidden instances, draw-order popping. Idea. `NOTES.md`; `progress-notes/wave-view3d-viz.md` Track E.
- Capped sections, geometry-derived storeys, triangle-level decimation, voxel occupancy, opening cuts for doors, a light rig for z-up. Idea. `docs/bim-flow-3d.md`; `wave-view3d-viz.md`.
- Push a model into the 3D pane from the app; an editor-to-pane channel so Bounds3D can be captured; showcase reset and reapply from graph preview. Idea. `wave-view3d-viz.md`; `param-data-types.md` §5.
- The V2 viewer work that stopped mid-chunk on 2026-09-08: the 21-demo gallery, feature demos, React bindings, benchmark reports, occlusion-lab bug, missing overlays. Partial. `docs/plans/visualization/V2-STATUS.md`.
- Shrink BFAST for network transfer (11 to 12 times the BOS size); a production model endpoint for remote hosting. Idea. `docs/bim-flow-3d.md` "Run locally".

### Publishing, reports, evidence

- One reproducible run-to-report-to-evidence example whose hashes verify; a single publishing launcher. Idea. W5. `REPOSITORY-HANDOFF.md` P1. TKT-12.
- The named run is the only signed thing: input content hashes in `sink.report`, signed evidence packages, a publishing gate. Idea. W5. `platoflow-graph-semantics.md` §4; `NOTES.md` Track PUBS.
- Live SSE-driven dashboards beside frozen exports. Partial; a TODO in `BimOpenFlow.Dashboards`. `docs/bimopenflow-structure.md` "Dashboards".
- A permit-style HTML or PDF report grouped by provision with citations and an override log. Idea. `platoflow-compliance-design.md` §6 item 3.
- Pin a node's table into the file; a named presentation state (camera, display) for meetings. Idea. `platoflow-graph-semantics.md` §3, §5.
- Typed measures in `sink.writePsets` (every value is IFCTEXT today); GLB and BOS export sinks. Idea. `NOTES.md` Track EFF.

### Data and IFC

- BuildingModel open decisions (space alias sets, project name, layer direction) and whether its records move into the `bim-open-schema` spec. Idea. `artifacts/wave/IMPROVE.md`; `docs/plans/BUILDING-MODEL-STATUS.md`.
- Fix-on-entry debts still open: a schema version marker in `.bos`, `IfcDuck.CreateViews` into `BimOpenSchema.IO`, geometry-free `net8.0` conversion, a Parquet.Net pin, folded duplicate DuckDB views, a `WriteTable` overload taking a schema. Idea. `PLAN.md` §5; `docs/plans/nrc-handoff/track-a.md` finding 4.
- Content-hash caching with a progress channel for the 43-second silent converter start; log lines for the background NRC build; a slug fallback for non-ASCII model names. Idea. `docs/plans/nrc-handoff/track-verify.md`; `track-3d.md` finding 3.
- `docs/gallery.md` should name `snowdon-bim.bfast` as the property-aware fixture. Built, document stale. `REPOSITORY-HANDOFF.md` "V2 gallery".

### Platform and hosting

- A hosted multi-user service with authentication; optimistic concurrency and a hash sidecar in the store; cache eviction for memo, geometry, and orphaned `.bos`. Idea; out of the brief's scope today. `docs/OVERVIEW.md`; `NOTES.md` Tracks STO, ENG, GEO, CAT.
- Graduate the viewer as the engine was (`ara3d-dataflow`); a TypeScript or Python engine port passing the conformance vectors. Idea. `docs/OVERVIEW.md` "What it could become".
- Publish Gratify to npm; LFS or a package for `web-ifc-library.dll` and the 49 MB perf model; code-split the 973 kB three.js chunk; clean `bin/obj` blobs out of history. Idea. `PLAN.md` §6; `NOTES.md` Track APP, DUCK.

### Developer experience

- Truthful status and CI: remove `continue-on-error`, add the viz and editor typecheck and the V2 suite to the gates, a headless editor smoke (SQL, write-back, MCP intents, Ask), a publishing gate. Idea. `REPOSITORY-HANDOFF.md` P0; `gates/README.md` TODO. TKT-19 covers the walkthrough.
- Package and retire deliberately: a dependency-ordered V2 build, an installed-package smoke, sibling dependencies, archive of the PoC. Idea. `REPOSITORY-HANDOFF.md` P2.
- Test hygiene: hoist the mini IFC fixture (copied six times), `.gitattributes` for `samples/nrc`, remove the `CsvGraphTests` workaround. Partial. `docs/plans/nrc-handoff-wave.md` "Design notes deferred".

## What the documents argue against

Recorded so nobody proposes them again without a new reason; PROJECT.md's Scope: Out carries the short form.

- A second scripting API, agent-as-code as the user surface, or a no-code agent builder before the representation settles. `docs/ARCHITECTURE.md` "Agentic workflows"; `platoflow-agent-concepts.md` §3.1.
- Autonomous agents, an agent that negotiates between disciplines, or one that grades buildings. `platoflow-agent-concepts.md` §1, §4.
- General node-graph instrument features (semantic zoom, fisheye, subway maps, 3D canvases, workspaces), scalar wires, new wire types, near-duplicate parameter kinds: none of the 56 enumerated workflows needs them, and a new wire type touches the spec, the engine, every surface, and the conformance vectors. `bimopenflow-ux-proposal.md` §1, §6; `param-data-types.md` §2.
- Growing Gratify's node-editor example into a shared library, Gratify importing BIM code, wrapping `@ara3d/viewer-controls`, porting the 23 alpha demos. `docs/graph-module-layering.md`; `README.md` decisions of 2026-09-08.
- C# records or SQL DDL as the master schema, one denormalised table, one database per profession. `docs/proposals/bim-query-platform/contract/README.md`.
- D3 inside `@bimopenflow/viz`, type-aware lint on every package, aliases for command names, performance gates, picking a new port when 5214 is busy. `NOTES.md` chart nodes wave; `BIMOPENFLOW.md`.

## Stale claims, resolved

Statements the readers found that a newer document or the code overrides. The brief follows the right-hand side.

- Node and pack counts (98 across 11, 67, "four packs"): `docs/nodes.md` is generated and is the only count worth quoting.
- The spec at `spec/`, the viewer at `viewer/`: the spec is under `submodules/ara3d-dataflow/spec/`, the viewer workspace is `viz/` (README).
- The PlatoFlow PoC as a live component: deleted 2026-09-15; MCP and Ask live in BimOpenFlow.
- "No Run implementation", "no `bfast.*` reader", "no numeric cast": all landed 2026-09-18 (`track-e.md`, `track-t.md`).
- The NRC handoff "not built yet": the same day's integration record and `docs/nrc-walkthrough.md` show 13 graphs and the figures delivered.
- Relations "live on a branch": on main, with `rel.fromTable` added.
- Ten parameter kinds, sources as absolute paths only: more kinds since (Fraction and Percent added; `contracts.json` is the list); `rel.*` nodes carry a schema.
- The verdict pane "not built": `verdictPane.ts` exists; partial.
- The query platform's caches unbuilt, `DataModel` superseded: `BuildingModel` and `.Source` are built (2026-09-17); `DataModel` is still in use.
- "The agent sees names and types but not values": `describeDatabase` reports NULL counts, distinct counts, sample values, and ranges.
- The Snowdon export's table count: two documents dated 2026-09-18 disagree (48 of 83 with walls and windows; 11 without). TKT-2.
- Claude as the measured backend: measurements used gpt-5; the Claude backend is unmeasured. TKT-8.
- Tooling "ready to lift" (patch-gate hook, ratchet, impacted-test tool): belongs to sibling prototype repositories, not to this one; several exist now as platonic-coder skills.

## Lessons for the coding process

The wave notes, contracts, and handoff record how this repository was built by parallel agents. These lessons belong to the tooling in the platonic-coder repository, where the recurring ones are tickets; they are listed here so the source stays traceable.

- Commit by path must include `git add <paths>`, and `--amend` must be banned; a hook, not a rule. Two commits landed without their new files, and an amend took four of another track's staged files. `NOTES.md` data-node-sets wave; `progress-notes/wave-view3d-viz.md` Track A.
- Fences are per session; a cross-session fence and a branch lock are missing. Peer sessions edited fenced files mid-wave, and one switched the shared checkout to another branch. `NOTES.md` chart wave; `docs/plans/visualization/V2-STATUS.md` "Branch warning".
- Worktrees kept being used despite the ban; the gate should detect them. Three waves ran in `.claude/worktrees/table-graph-layers`. `docs/plans/nrc-handoff-wave.md` "Checkout". (platonic-coder TKT-13.)
- Status prose goes stale in hours: plans get appended dated decisions, status lives in its own file, counts are generated. `docs/plans/visualization/README.md` decision 2026-09-07.
- Fences forbid touching shared files, so helpers get duplicated (a table helper three times, repository-root discovery five, a mini IFC six); the supervisor needs a dedupe step and a fast path for shared-file defects. `NOTES.md` Tracks RUNS, CMP, EFF.
- Tracks cannot message a running supervisor; briefs must ask for everything up front, and requests queue as follow-up chunks. `nrc-handoff-wave.md` amendment 7.
- Freeze contracts and exact expected values before dispatch; generate shared enums from one owner. Frozen node specs landed five tracks green with no fence violations; a hand-copied enum diverged silently. `NOTES.md` BimAnalysis wave; `param-data-types.md` §1.
- Expensive gates must not share the machine with compiling tracks; scope gates per project and path. Typecheck went from 5 s alone to 75 s under eight tracks. `docs/plans/visualization/TOOLING-LEDGER.md`.
- Verify contents, not exit codes; measure the step you blame. An empty solution built green; a review blamed the wrong 50 s. `NOTES.md` "SDK-boundary restructure"; `artifacts/wave/IMPROVE.md` I4.
- Fresh-context review earns its cost: it caught an infinite loop, a NaN, and four assertions that could never match. `NOTES.md` chart wave; `artifacts/wave/REVIEW.md` D2.
- Cap process output: checkpoints under 80 lines, fixtures only after the contract lands. A fifth of one day's output was process text and unusable fixtures. `docs/plans/visualization/REVIEW-2026-09-08.md`.
- Ports and dev servers need a machine-wide allocator; a running host holds its binaries so a second cannot rebuild. `docs/bim-flow-3d.md`; `V2-STATUS.md`.
- Never `git add -f`; fix the ignore rule (`*.bos` matched a directory and swept build output into history). `NOTES.md` Track DUCK.
- Capture friction with hooks, never by asking agents to log; a stuck report and a stop after three identical failures. `docs/proposals/agent-archetypes.md` "The friction ledger"; `docs/proposals/agent-workflows.md` §3.

## Sources

`README.md`, `BIMOPENFLOW.md`, `PLAN.md`, `NOTES.md`, `CONTRACTS.md`, `progress-notes/`, `docs/ARCHITECTURE.md`, `docs/OVERVIEW.md`, `docs/DEMOS.md`, `docs/REPOSITORY-HANDOFF.md`, `docs/REPOSITORY-INVENTORY.md`, `docs/bimopenflow-structure.md`, `docs/graph-module-layering.md`, `docs/bim-flow-*.md`, `docs/nrc-walkthrough.md`, `docs/aec-world-model-terminology.md`, `docs/plans/**`, `docs/proposals/**`, `docs/platoflow/**`, `artifacts/wave/*.md`, `artifacts/nrc-*/`, `samples/*/README.md`, `.claude/skills/**`, and the git log to `edbf264` (2026-09-18).
