# BIM Open Toolkit: repository assessment and handoff guide

**Snapshot: September 8, 2026.** Inspected on `main`, starting at `fb8cb8e` (04:16 EDT). This is an assessment of the checkout, including work in progress, not a release declaration. [Verification and freshness](#verification-and-freshness) explains the evidence and limits. The [companion inventory](REPOSITORY-INVENTORY.md) lists every C# source project, viewer package, editor package, and sample graph with source links and commit dates.

## Read this first

This repository is becoming an **open workbench for reproducible BIM analysis**, backed by reusable data, graph, and visualization libraries. There is substantial working code. The main handoff problem is that its entry points and documentation mix several generations, levels of maturity, and kinds of evidence.

A newcomer should be given three starting points:

1. **BimOpenFlow** to understand the product experience: edit a graph, inspect an intermediate table or 3D result, and retain the analysis.
2. **The V2 viewer and gallery** to develop reusable visualization capabilities. The gallery currently exposes five demos, out of 21 planned.
3. **The core BuildingModel workflow runner** to understand how source data becomes typed, queryable facts with evidence and explicit missing values.

Keep the older visualization alpha available as a behavior reference. Treat PlatoFlow as a historical prototype. Neither is the default starting point for new product work.

The immediate priority should be **one repeatable newcomer journey on a clean machine**, followed by completing a small number of integrated workflows. More parallel feature development would currently add to the reconciliation burden.

### Navigation

- [What I think you are trying to achieve](#what-i-think-you-are-trying-to-achieve)
- [The architecture in plain language](#the-architecture-in-plain-language)
- [What can be opened](#what-can-be-opened)
- [The galleries and their actual contents](#the-galleries-and-their-actual-contents)
- [Graphs, workflows, charts, and reports](#graphs-workflows-charts-and-reports)
- [Data models and prepared files](#data-models-and-prepared-files)
- [Libraries and integration boundaries](#libraries-and-integration-boundaries)
- [Launch instructions](#launch-instructions)
- [Dependencies and portability](#dependencies-and-portability)
- [Assessment and cleanup plan](#assessment-and-cleanup-plan)
- [Verification and freshness](#verification-and-freshness)
- [Complete package and sample inventory](REPOSITORY-INVENTORY.md)

## What I think you are trying to achieve

The [root README](../README.md) explicitly describes an open data layer with a graph that humans and agents edit through the same operations. The [visualization brief](plans/visualization/PRODUCT-BRIEF.md), [query-platform proposal](proposals/bim-query-platform/PLAN.md), and [core model boundary](../src/Ara3D.BimOpenSchema.BuildingModel/README.md) give this a more specific meaning.

**Strongly supported interpretation:** a building export should become something people can query, explain, visualize, and reuse without learning the original authoring application's API. An answer should retain the identity of the objects it concerns and the source evidence behind it. A missing measurement should remain missing. A visual presentation should not change the meaning of the underlying model.

**My hypothesis:** the intended experience is a visual analytical workbench where a person or agent can construct an analysis, inspect every step, locate the result in a building, and hand someone else a repeatable graph or a self-contained result. The graph is the record of the work; the table, viewer, chart, and report are different ways of understanding it.

**A second hypothesis:** the toolkit is also meant to be a collection of useful independent products: a generic graph engine, a reusable web viewer, BIM source converters, and typed query libraries. That fits the documented possibility of extracting the generic engine and viewer into their own repositories. It creates a real tension: packaging excellent individual libraries and delivering one easy application are separate jobs.

**A third hypothesis, less certain:** the many galleries are partly an attempt to make the library's capabilities tangible to future users, developers, and collaborators. The code now needs a curated demonstration narrative as much as it needs additional features. A gallery of technical controls and a gallery of business questions serve different audiences; they should be labeled accordingly.

One possible public description:

> BIM Open Toolkit turns building-model exports into traceable data and repeatable analyses. People and AI agents use the same graph operations to explore tables, inspect results in 3D, and produce reports that preserve their evidence and limitations.

For a developer audience, add: “The data layer, graph engine, and viewer can also be used independently.” For a BIM practitioner, demonstrate a door schedule with missing widths and source links before explaining packages. The [terminology note](aec-world-model-terminology.md) is useful background: “world model” may suggest learned simulation, complete BIM semantics, or a live digital twin, none of which should be inferred from this checkout.

Unsettled product choices remain visible: the primary audience, the first supported real workflow, the supported source/export variants, and whether the first deliverable is an application, an SDK, or both. This report proposes an order for resolving those choices; it does not claim the repository has settled them.

## The architecture in plain language

```text
IFC / BOS building exports
  ├─ source readers and conversion ── BOS tables / immutable source snapshot
  │                                    └─ mapped BuildingModel facts and evidence
  │                                         └─ typed DuckDB / schedules / projections
  └─ geometry preparation ── browser BFAST ── viewer formats / render / interaction

Tables, files, SQL, and model references
  └─ BimOpenFlow graph + C# evaluator
       ├─ table and chart panes
       ├─ 3D recipe or instance-table output ── V2 visualization packages
       └─ explicit recorded Run ── reports / dashboards / evidence packages

Human web editor and graph MCP server drive the graph services.
Viewer command features have a separate, unfinished V2 MCP bridge.
```

These paths exist to different degrees. They are not one fully qualified product pipeline. In particular, the browser's synthetic workflow adapters are not an implementation of every domain service suggested by the business demos.

Three meanings of **graph** need to be kept separate:

| Term | Meaning here | Where to look |
|---|---|---|
| Dataflow graph | Executable analysis: nodes, edges, parameters, layout, session state | [Specification](../spec/dataflow-graph/README.md), [NodeGraph](../src/Ara3D.NodeGraph/README.md), BimOpenFlow |
| Building relationship graph | Containment, connectivity, correspondence, and other relationships among model objects | [DataModel](../src/Ara3D.BimOpenSchema.DataModel/README.md), BuildingModel |
| Chart | A bar/line chart or another visual presentation of table results | [Web viz package](../bimopenflow/web/packages/viz/README.md), [Viz nodes](../src/BimOpenFlow.Nodes.Viz/) |

## What can be opened

Links below work only while the appropriate local server is running. Ports come from current configuration, not older plan text. All setup recipes are in [Launch instructions](#launch-instructions).

| Surface | Purpose and intended audience | Freshness and status | Dependencies and next work |
|---|---|---|---|
| **BimOpenFlow editor** — [5300](http://127.0.0.1:5300/) | Current graph authoring shell: node catalog, canvas, parameters, previews, analyses and Runs | Active through Sep 8; substantive app with tests. Shared editor files contain local changes in this snapshot | .NET host + editor npm workspace + Gratify + viewer dependencies. Stabilize onboarding, sample selection and build/release coverage |
| **Snowdon graph demo** — [3d.html](http://127.0.0.1:5300/3d.html) | Editable graph beside its live 3D result; strongest existing demonstration of graphs and visualization meeting | [Sep 8 integration record](bim-flow-3d.md) reports 18 browser scenarios after palette work. Not independently replayed for this report | BIM-profile host and Snowdon BOS; empty or explicitly populated store. Qualify the shared editor after current DuckDB edits |
| **3D showcase** — [showcase.html](http://127.0.0.1:5300/showcase.html) | Button-based visual recipes plus local model file picker; useful for isolating viewer behavior from graph authoring | Same current integration as the graph demo | Prepared browser BFAST via fixture endpoint, or supplied BOS/BFAST. Keep clearly labeled as a showcase |
| **DuckDB workflow studio** — [5308/duckdb.html](http://127.0.0.1:5308/duckdb.html) | Nine editable analytical graphs with result-table previews over a typed Snowdon database | Sep 8 **working-tree feature**: launcher, page, docs, graphs and source-node code include untracked files. A live page exists locally; a clean clone of HEAD will not reproduce this feature | Separate host on 5218, compatible typed database, editor dependencies. Review, verify and commit the bounded feature before handoff |
| **V2 gallery** — [5190/gallery.html](http://localhost:5190/gallery.html) | Current showcase of composable review capabilities, with Gratify controls and inspectors | Five registered demos; [Sep 8 smoke record](../viewer/packages/demos/docs/gallery-smoke.md) says five drew. Partial delivery of a 21-demo plan | Viewer workspace; built alpha core; real fixture for default Snowdon routes. Complete composition and selected missing workflows |
| **Visualization alpha gallery** — [5173](http://127.0.0.1:5173/) | Earlier public-API feature laboratory and reference for behavior | 23 routes; prioritized Sep 7 alpha, with [recorded browser evidence and limits](../viewer/packages/visualization/docs/FINDINGS.md). It remains the target of `npm run demo` | Viewer build; optional Snowdon BOS/BFAST and door projection. Preserve until parity-based retirement |
| **Alpha review sandbox** — [review.html](http://127.0.0.1:5173/review.html) | Older combined selection/edit/save sandbox with two synthetic models and a 10,000-object exercise | Present alongside alpha gallery; separate from the React door-review route | Same alpha server; generated fixture. Historical integration example, not another product |
| **V2 end-to-end slice** — [5176/slice.html](http://127.0.0.1:5176/slice.html) | Small synthetic building; missing/disputed door fire ratings shown in red; exposes composition cost | Implemented Sep 8 with [page and test documentation](../viewer/packages/demos/docs/slice.md) | No private BIM data. Good first visual smoke; consolidate duplicated host code later |
| **Ambient occlusion lab** — [5177](http://127.0.0.1:5177/ambient-occlusion.html) | Compare contact shading on synthetic fixtures | Implemented Sep 8; focused pixel-test evidence in [docs](../viewer/packages/demos/docs/ambient-occlusion.md) | Own renderer/GTAO adapter. Hidden/transparent geometry currently occludes incorrectly; perspective-only. Experimental rendering lab |
| **Standalone feature pages** — [show-by](http://127.0.0.1:5181/feature-demos/show-by.html), [separate](http://127.0.0.1:5181/feature-demos/separate.html), [hud-fps](http://127.0.0.1:5181/feature-demos/hud-fps.html) | Isolate by spatial/category groups, spread levels/rooms, inspect timing | Files are present and committed now; original tracks stopped mid-chunk. No complete acceptance record found. Minimap and gumball pages are absent | Shared synthetic host and V2 features. Finish and browser-verify before promoting; [plan](plans/visualization/FEATURE-DEMOS-PLAN.md) remains open |
| **Feature host smoke** — [host-smoke](http://127.0.0.1:5181/feature-demos/host-smoke.html) | Developer-only check of the shared feature-page host | Shared-host verification documented; not a user workflow | Same feature-page server; useful diagnostic |
| **Studio Graph / PlatoFlow PoC** — [5215](http://127.0.0.1:5215/) | Original browser-evaluated graph prototype, including model/SQL/write-back experiments | README explicitly says throwaway; developed Aug 9–20, latest subtree migration Aug 30 | Legacy viewer, separate PoC host on 5214, fixtures. Preserve design findings; archive entry points after parity review |
| **PoC editor harness / viewer harness** — [editor](http://127.0.0.1:5215/editor.html), [viewer](http://127.0.0.1:5215/viewer.html) | Isolated experiments for the old editor and old 3D integration | Historical harnesses, not BimOpenFlow pages | Same PoC server. They explain some apparent duplication |
| **Fixture server** | Local developer service listing/serving prepared files with byte ranges and hashes | Implemented Sep 8, documented focused tests. It is infrastructure, not a gallery | Port 5175; currently reaches a sibling checkout for `tsx`. Gallery also has its own fixture middleware |

## The galleries and their actual contents

### V2 gallery: five visible demos and sixteen unfinished registrations

The [discovery code](../viewer/packages/demos/src/gallery/discovery.ts) imports `src/demos/*/index.ts`. A directory with helpers but no `index.ts` is not a visible demo. Current registrations are **capture, environment, explode-and-grid, point-and-read, portfolio**.

The [gallery guide](../viewer/packages/demos/docs/gallery.md) lags a source-data change: it describes geometry-only `snowdon.bfast`. The [current fixture definition](../viewer/packages/demos/src/demos/_shared/snowdon.ts) requests **`snowdon-bim.bfast`**, which includes original BOS tables. Use the latter for property-aware demos. Most demos default to Snowdon; **portfolio defaults to the synthetic estate**, with a different, source-backed Snowdon rollup as an alternative.

| Planned demo | What it would explain | Current state / remaining work |
|---|---|---|
| [point-and-read](http://localhost:5190/gallery.html?demo=point-and-read) | Object identity, source document, recorded properties and explicit gaps | Registered, current README and tests. Real properties now populate the inspector; raw BOS properties remain distinct from normalized observations |
| colour-by | Which data column explains a building | Partial source: colouring/classes helpers, no registration. Finish controls, inspector and rendered verification |
| ghost-and-isolate | Work with a subset while retaining context | No registered/source demo in the current demo tree; sets/appearance library capabilities exist |
| storey-navigator | Navigate by actual storeys and inspect their contents | No demo; retain unresolved/multiple source storey semantics |
| section-studio | Plane/box section inspection | No active demo; unfinished local draft parked under ignored `viewer/artifacts/gallery-wip/d2/` |
| [explode-and-grid](http://localhost:5190/gallery.html?demo=explode-and-grid) | Separate spatial/category groups to inspect them | Registered. Current code reports the source grouping basis; avoid implying every source placement has a trustworthy storey |
| [environment](http://localhost:5190/gallery.html?demo=environment) | Lighting/background/grid presets | Registered; four presets, state-derived inspector, reset |
| saved-views | Return to the same composed review state | No demo; storage and scene-state libraries exist. Integrated feature restoration remains a handoff gate |
| [capture](http://localhost:5190/gallery.html?demo=capture) | Produce an image of the view | Registered; model-canvas PNG at named sizes. UI panels/labels on separate canvases are not in the export |
| load-a-file | Open one's own model and understand diagnostics | No gallery demo; loaders and file picker in the 3D showcase exist |
| ten-thousand | Bulk changes and performance measurement | Partial scene/panels/bulk helpers, no registration. Qualify actual frame behavior separately from CPU updates |
| door-schedule | Missing fire ratings or widths, linked to objects | No active registered demo; unfinished local draft parked under `gallery-wip/d3/`. Pure workflow adapter and alpha/graph/data examples exist |
| revision-comparison | Explain and locate changes between issues | No demo. Require explicit correspondence and unresolved cases |
| takeoff | Quantities and whether their basis supports a total | No demo. Distinguish supplied quantities from derived geometry quantities |
| pricing-alternatives | Compare scenarios and unpriced scope | No demo. Synthetic/external price input is required; not supplied by core BIM mapping |
| delivery-timeline | Explain recorded delivery/installation state over time | No demo. Event input belongs to an external application |
| valve-isolation | Trace affected services and unverified connections | No demo. Synthetic adapter exists; source topology and a real service remain separate work |
| access-coordination | Inspect service envelopes and overlap candidates | No demo. Bounding-box overlap must remain a candidate, not a confirmed clash |
| asset-handover | Inspect asset records, history and notes | No demo. External lifecycle records and durable note behavior needed |
| material-carbon | Compare supplied quantities/factors with unresolved scope | Partial carbon/heat helpers, no registration. External factors/units and scope need explicit validation |
| [portfolio](http://localhost:5190/gallery.html?demo=portfolio) | Estate outliers, document attribution and drill-through | Registered. Synthetic estate exercises gaps/conflicts; Snowdon alternative totals recorded floor-area figures per source document in recorded units, not an estate benchmark |

That is **5 registered + 3 partial directories + 13 without an active demo directory = 21 planned**. Some unfinished work exists only in ignored artifacts on this machine. A clone does not contain it. No “cleanup” should delete those artifacts before their owners have recovered useful work.

### Alpha gallery: a broader feature reference

All links below use port 5173. Add `&model=small` for the deterministic fixture where appropriate. The alpha [status](../viewer/packages/visualization/docs/STATUS.md) describes limitations per original feature ID; a route is not proof of complete acceptance.

| Area | Routes and what they show |
|---|---|
| Identity and inspection | [selection](http://127.0.0.1:5173/?feature=selection): sets and linked table; [doors](http://127.0.0.1:5173/?feature=doors): source-backed door schedule; [react-review](http://127.0.0.1:5173/?feature=react-review): React door-review application |
| Appearance and edits | [appearance](http://127.0.0.1:5173/?feature=appearance): color/ghosting; [edits](http://127.0.0.1:5173/?feature=edits): transaction undo; [replacement](http://127.0.0.1:5173/?feature=replacement): replace one representation |
| Navigation and spatial views | [camera](http://127.0.0.1:5173/?feature=camera), [projection](http://127.0.0.1:5173/?feature=projection), [navigation](http://127.0.0.1:5173/?feature=navigation): navigation, fixed views, guides; [clipping](http://127.0.0.1:5173/?feature=clipping): planes/boxes; [layouts](http://127.0.0.1:5173/?feature=layouts): explode/grid; [comparison](http://127.0.0.1:5173/?feature=comparison): two views |
| Presentation | [environment](http://127.0.0.1:5173/?feature=environment): background/lights; [annotations](http://127.0.0.1:5173/?feature=annotations): world notes; [capture](http://127.0.0.1:5173/?feature=capture): PNG; [animation](http://127.0.0.1:5173/?feature=animation): time-driven movement |
| State and integration | [persistence](http://127.0.0.1:5173/?feature=persistence): saved view; [storage](http://127.0.0.1:5173/?feature=storage): local saved documents; [gratify](http://127.0.0.1:5173/?feature=gratify): UI adapter; [assistant](http://127.0.0.1:5173/?feature=assistant): bounded local commands, not a live MCP connection |
| Loading and measurement | [formats](http://127.0.0.1:5173/?feature=formats): format subsets; [loading-checks](http://127.0.0.1:5173/?feature=loading-checks): failure/cancel cases; [performance](http://127.0.0.1:5173/?feature=performance): measured bulk updates |

The React example here is real alpha code. It must not be mistaken for the **V2 `ui-react` package**, whose public entry point still exports nothing.

## Graphs, workflows, charts, and reports

### Executable BimOpenFlow samples

The [inventory](REPOSITORY-INVENTORY.md#sample-graphs) links every sample file. Samples are graph documents, not independent servers.

| Set | Contents | How it becomes usable / limits |
|---|---|---|
| [Table analyses](../samples/analyses/README.md), six | Customer revenue, category mix, SQLite/CSV parity, XLSX enrichment, DuckDB warehouse, split/recombined orders | `--profile tables` seeds an empty store and prepares sample data. Best first graph experience without private models |
| [BIM analyses](../samples/bim-analyses/README.md), eight | Discipline mix, levels, rooms, dimensions, navigation hops, containment, parameter coverage, nearest door | BIM profile generates a small `sample.bos`; useful synthetic analytical coverage |
| [3D instance analyses](../samples/view3d-analyses/README.md), six | Category colors, ghosting, category explosion, massing boxes, voxel density, decimated overview | Require `data/duplex.ifc`. Current `BimSampleSeeding` seeds them despite the stale README saying otherwise. Bounds/instance approximations do not establish full mesh occupancy or simulation capability |
| [Snowdon graph](../samples/snowdon-analyses/snowdon-toolkit.json), one | Eleven-node composed 3D recipe with category, section, plan, ghost and environment branches | Optional Snowdon path and BIM profile; local model loading in the pane avoids huge instance transfers for common presentation actions |
| [DuckDB workflows](../samples/duckdb-analyses/workflows.json), nine in one catalog | Doors, door types, rooms, rooms by storey, missing widths, roof coverage, width evidence, source provenance, typed columns | Working-tree addition; prepared typed database required. Source counts and NULLs are deliberate, not UI placeholders |
| [PoC demos](../platoflow/demo/), 21 JSON files | Older carbon/cost/SQL/selection/write-back and other experiments | A different graph model and evaluator. Some are mirrored under `platoflow/web/public/demo/`; review synchronization before archiving. Do not import blindly into BimOpenFlow |

The C# graph engine separates **evaluation** from **explicit Runs**. Evaluation computes inspectable node state; Run-gated effect nodes export files or perform write-back. Graph edits can still autosave documents in the analysis store. See [engine](../src/Ara3D.DataFlowEngine/README.md), [effects](../src/BimOpenFlow.Nodes.Effects/README.md), and [graph specification](../spec/dataflow-graph/README.md).

### Browser workflow adapters are a different layer

[`@bim-open-toolkit/workflows`](../viewer/packages/workflows/README.md) contains ten pure adapters: door schedule, revision comparison, takeoff, pricing alternatives, delivery timeline, valve isolation, access coordination, asset handover, material carbon, and portfolio drill-through. They turn supplied tables into result tables, exceptions, color rules, sets, overlays, and command recipes.

They do not read IFC, derive reliable quantities from geometry, infer network topology, or supply real procurement/maintenance/carbon data. Synthetic cases deliberately demonstrate incomplete or conflicting input. The door-projection bridge is the clearest existing connection to the source-backed core workflow path. Completing a demo for another adapter is different from delivering a real-data domain service.

### Charts and output artifacts

| Component | What it is | Current next step |
|---|---|---|
| [Web `viz`](../bimopenflow/web/packages/viz/README.md) | SVG bar/line charts and tabular presentation; usable in panes and embedded output | Keep rendering and wire contracts aligned; no separate chart application to launch |
| [Publishing](../src/BimOpenFlow.Publishing/README.md) | Deterministic HTML assembly, styling, escaping, embedded tables/assets | Package/document the emission path |
| [Reports](../src/BimOpenFlow.Reports/README.md) | Static HTML from a recorded Run, with provenance, verdict summaries and output hashes | Add a user-facing end-to-end run-to-report example |
| [Dashboards](../src/BimOpenFlow.Dashboards/README.md) | Self-contained interactive HTML over frozen Run tables | Live SSE dashboard is still documented TODO |
| [Evidence](../src/BimOpenFlow.Evidence/README.md) | ZIP containing graph, Run, report, inputs and hashed manifest; verification API | Signing remains TODO; [gate notes](../gates/README.md) explicitly lack a publishing CLI integration gate |

These are libraries that produce files. They are not four additional web apps. Once generated, reports/dashboard HTML can be opened independently of the host; producing them currently requires code or the relevant graph effect, not a unified documented publishing launcher.

## Data models and prepared files

This is the most important terminology cleanup after the demo catalog.

| Name | Actual purpose | Status and dependency |
|---|---|---|
| **BIM Open Schema / BOS** | Interchange-oriented columnar source model: entities, descriptors, parameters, relationships, geometry, shared value pools | Existing implementation in [BimOpenSchema](../src/Ara3D.BimOpenSchema/README.md), with IO and harmonization. Raw indices/storage conventions are not the intended end-user query API |
| **DataModel** | Immutable, indexed source snapshot for querying properties, relationships, spatial bounds and schedules | [Implemented prototype/reference](../src/Ara3D.BimOpenSchema.DataModel/README.md). Still consumed by source preparation and mapping; do not delete just because an older proposal says “superseded” |
| **BuildingModel** | Typed domain contract: places, architecture, systems, materials, geometry references, provenance; `Fact<T>` and `LinkSet<T>` retain uncertainty/coverage | [Current core](../src/Ara3D.BimOpenSchema.BuildingModel/README.md). Broad record vocabulary, narrower actual BOS mapping. Lifecycle/commercial/analysis-result records are deliberately outside the core |
| **BuildingModel.Workflows** | Maps source snapshots into the core and produces source-backed schedules, coverage, quantity readiness, comparisons and portfolio coverage | [CLI and docs](../tools/building-model-workflows/README.md). Architectural slice is useful; room/roof numerical interpretation and broader mappings remain incomplete |
| **Query-platform contract proposal** | Broader semantic design, JSON schemas/catalogs, workflow examples, generated C# review types | [Review material](proposals/bim-query-platform/contract/README.md), not a deployed database/service. Some later core/cache work now exists, making the proposal's “not implemented” wording stale for those bounded pieces |
| **TypeScript viewer `model`** | Browser identity, geometry/table contracts, facts, styles, slices, commands and scenes | A separate language/runtime contract. Shares concepts with C# BuildingModel, not automatically the same serialized schema |

### BFAST is a container, not one interchangeable model format

| Artifact | Producer / consumer | What matters for handoff |
|---|---|---|
| Browser geometry BFAST | [JS converter](../viewer/packages/loaders/scripts/bos-to-bfast.mjs) → viewer loaders/formats | Legacy geometry-only files omit analytical source tables. Current converter preserves original Parquet entries under `BOS/`. Gallery expects the combined `snowdon-bim.bfast` |
| .NET source cache BFAST | [`SourceCache.Prepare`](../src/Ara3D.BimOpenSchema.BuildingModel.Source/README.md) → `SourceCache.Load` and core workflow runner | Decoded typed source columns, source hash/manifest/cache version; geometry optional on read. Version-one CLR type identifiers make it runtime-sensitive. It is not the browser render-table format |
| Workflow projection JSON | Core workflow runner → reopening, adapters and selected demos | A persisted typed mapped subset with evidence, not raw BOS and not browser geometry |
| Core typed DuckDB | [BuildingModel.DuckDb](../src/Ara3D.BimOpenSchema.BuildingModel.DuckDb/README.md) → SQL consumers / DuckDB studio | 83 core tables; typed scalars, lists and flattened composites with evidence companions. Empty schema tables are intentional. Old JSON-column exports need regeneration |

Use names that identify the producer and version, not just `.bfast`. Keep one fixture manifest with input hash, producer command/revision, numeric interpretation policy, output hash and consumers.

The source-backed reports preserve unknown numeric storage policy. For the supplied Snowdon DuckDB demonstration, all 142 clear-width values remain unavailable; that is an honest data result. A display-unit label is not sufficient proof of stored units. Do not “repair” this by substituting nominal width, parsing names, or converting unknown values to zero. [Source policy and export instructions](../tools/building-model-workflows/README.md) explain explicit policy choices.

## Libraries and integration boundaries

The complete [inventory](REPOSITORY-INVENTORY.md) lists **45 C# source projects, 17 viewer workspace packages, and six editor workspace packages**, plus the IFC shared-source folder. The root README's counts of 39 projects, 37 suites, and the viewer README's four-package description have drifted; there are 40 C# test project files under `tests/` in this snapshot.

| Family | Responsibilities and status | Main dependencies / next action |
|---|---|---|
| Generic C# graph core | Abstractions, document model, evaluator, expressions, Runs, migrations and TestKit | Ara3D SDK packages; no BIM domain requirement. Retain spec/conformance authority and publish only after package-consumer verification |
| IFC/source libraries | IFC parsing/types, meshing, byte-preserving editing, BOS IO/DuckDB/harmonization | Several target Windows/.NET 8 and native web-ifc. `IfcTypes` is imported shared source, not a standalone project |
| Node packs | Bos, BimAnalysis, Geometry, DuckDb, Tables, TableOps, Cleaning, Dates, Compliance, Viz, Effects; Support is shared implementation infrastructure | Catalog is the authoritative node vocabulary. README node totals predate new recipe/source nodes; generate counts from the actual catalog |
| Host and contracts | Catalog discovers/converts models; Store persists analyses/Runs; API exposes services; Host composes them; generated Contracts cross the C#/TS boundary | Explicit profiles, directories and ports. Reconcile generated API docs and startup examples |
| Alpha browser packages | `core` renders; `controls` navigates/picks; `loaders` reads BOS/BFAST; `visualization` composes alpha behavior | Three.js/Gratify. V2 still depends on core and loaders: “rewrite” does not mean they are unused |
| V2 foundation | `model`, `formats`, `render`, `interact`, `synthetic`, `testing` | Mostly substantive, locally tested implementations. Formats is BFAST-first; interact supersedes older controls for V2; rendering still reaches alpha core |
| V2 composition/features | `viewer` composes sessions/views; `features` owns state, commands and rendering hooks; `workflows` produces domain-result adapters | Library work has progressed beyond older “skeleton” reports. Gallery, feature pages, slice and BIM pane still contain separate renderer/navigation glue |
| V2 UI/integration | `ui-gratify` has panel/inspector implementation; `ui-react` public export is empty; `mcp` public export is empty despite internal draft bridge files | Finish React and actual MCP transport/demo. A compiling empty package is not a delivered adapter |
| Editor web packages | `app` shell/canvas, `state` mutation/store path, `api-client`, `contracts`, `panes`, `viz` | Vite resolves V2 packages to source; Three is deduplicated. Verify built/package behavior separately from source-aliased development |

### MCP means four different things here

1. **IFC MCP:** [C# server](../src/Ara3D.Ifc.Mcp/README.md) for direct IFC entity/property/SQL/geometry queries; executable implementation, with inherited stale path examples.
2. **BimOpenFlow MCP:** [C# server source](../src/BimOpenFlow.Mcp/Program.cs) over graph services; stdio default or HTTP. It is not the unfinished browser bridge. It does not run the Host executable's sample-seeding startup path; seed a shared store through the host first if needed.
3. **Visualization alpha assistant demo:** bounded commands inside the page. It demonstrates a tool boundary, not an external assistant connection.
4. **V2 viewer MCP:** [package](../viewer/packages/mcp/) with internal tool/dispatch/protocol/client/host work but empty public export, no completed server/walkthrough. Still unfinished. The [Platonic MCP wrapper](../tools/README.md) is another developer tool, unrelated to BIM-user functionality.

## Launch instructions

Commands below are for PowerShell. Start from the repository root unless a command changes directory. Use a separate terminal for each foreground server; stop those servers with Ctrl+C. Local browser URLs are development conveniences, not deployment instructions.

### Prerequisites

- Windows is the most practical complete-stack target: several host/IFC projects are `net8.0-windows` and carry a native x64 library.
- Install an SDK capable of the target/build setup. Most projects target .NET 8; DataModel documentation uses the .NET 10 SDK and `.slnx`. This machine has SDKs 9.0.307 and 10.0.400.
- Use a Node version accepted by the installed Vite: its manifest requires `^20.19.0 || >=22.12.0`; this machine uses 22.13.1. The older “Node 18+” instructions are insufficient for the current viewer workspace.
- Initialize [Gratify](../.gitmodules), install each required npm workspace, and make the pinned NuGet sources available. These are separate installations, not one root npm project.

```powershell
git submodule update --init --recursive
npm --prefix viewer ci
npm --prefix bimopenflow/web ci
npm --prefix viewer run build
```

This viewer build builds Gratify and the **four alpha packages only**. It is not a V2 distribution build. Development servers resolve most V2 imports to source. A complete dependency-ordered `build:v2` remains absent from the root scripts.

### 1. Start with table graphs, without private models

Terminal A, repository root:

```powershell
dotnet run --project src/BimOpenFlow.Host -- --profile tables --port 5214 --models ./data --cache ./artifacts/handoff/tables-cache --store ./artifacts/handoff/tables-store
```

Terminal B, repository root:

```powershell
npm --prefix bimopenflow/web run dev -w @bimopenflow/app
```

Open [the editor](http://127.0.0.1:5300/) and choose a seeded analysis such as customer revenue. Inspect successive nodes and change a parameter. Existing nonempty stores are preserved, so use a separate path for a fresh demonstration.

**Port trap:** the host's [actual default](../src/BimOpenFlow.Host/HostConfig.cs) is **5210**, while the editor proxy defaults to **5214**. Pass `--port 5214` explicitly. To use another backend, set `$env:BOF_HOST='http://127.0.0.1:PORT'` before starting Vite.

### 2. Open the live Snowdon graph

Use a separate store and set the source path before starting the BIM host:

```powershell
$env:BIMOPENFLOW_SNOWDON = 'C:/path/Snowdon Towers Sample Architectural.bos'
dotnet run --project src/BimOpenFlow.Host -- --profile bim --port 5214 --models ./data --cache ./artifacts/handoff/bim-cache --store ./artifacts/handoff/bim-store
```

Start the same editor command, then open [3d.html](http://127.0.0.1:5300/3d.html). Stop the tables host first if it owns 5214. The source path also becomes a catalog root. No matching source means no Snowdon sample seeding; an existing store is not automatically reseeded. See [integration guide](bim-flow-3d.md) for importing into an existing store.

For [showcase.html](http://127.0.0.1:5300/showcase.html), either choose a local BOS/BFAST file or prepare its fixture:

```powershell
New-Item -ItemType Directory -Force artifacts/bim-flow
node viewer/packages/loaders/scripts/bos-to-bfast.mjs 'C:/path/Snowdon.bos' artifacts/bim-flow/snowdon.bfast
```

The converter refuses to overwrite an existing output. Alternatively set `BOF_SNOWDON_BFAST` before starting Vite. This path is independent of the graph host's model-catalog path.

### 3. Open V2 gallery or a synthetic page

```powershell
Set-Location viewer
npm run gallery
```

Open [the index](http://localhost:5190/gallery.html). For a first demo without private files, open [synthetic point-and-read](http://localhost:5190/gallery.html?demo=point-and-read&fixture=building) or [portfolio](http://localhost:5190/gallery.html?demo=portfolio).

For real data, place the **browser combined** `snowdon-bim.bfast` in the gallery's configured fixture directory, or set `$env:V2_FIXTURES_DIRS='C:/path/prepared-viewer-models'` before starting. It accepts a semicolon-separated directory list. Default directory: `viewer/packages/visualization/artifacts/bfast/`. The gallery has its own fixture endpoint; it does not require the standalone 5175 server for these routes.

From `viewer/`, each alternative below launches its own server:

```powershell
npm run demo:slice
# http://127.0.0.1:5176/slice.html

npx vite --config packages/demos/vite.ao.config.mjs
# http://127.0.0.1:5177/ambient-occlusion.html

npx vite --config packages/demos/vite.feature-demos.config.mjs
# http://127.0.0.1:5181/feature-demos/host-smoke.html
```

All standalone feature pages use the same server when launched this way. The plan's 5181/5182/5183 assignments were per-worker ports, not a requirement for three simultaneous servers.

### 4. Open the alpha reference

From `viewer/`:

```powershell
npm run demo
```

Open [selection with a small fixture](http://127.0.0.1:5173/?feature=selection&model=small). For real Snowdon set `SNOWDON_BOS_PATH` or `SNOWDON_BFAST_PATH` before startup. The alpha's door-review route additionally expects a prepared workflow projection at the endpoint configured in [its Vite config](../viewer/packages/visualization/examples/vite.config.mjs). Do not assume every alpha route is self-contained just because the small geometry fixture works.

### 5. Prepare typed data, then open the DuckDB studio

First satisfy the [Platonic.CSharp dependency setup](../tools/bim-data-model/README.md). These commands use the **.NET source cache**, not the browser BFAST:

```powershell
dotnet restore BimBuildingModel.sln
dotnet build BimBuildingModel.sln --no-restore
dotnet run --project tools/building-model-workflows -- prepare 'C:/path/Snowdon.bos' artifacts/handoff/source-cache.bfast
dotnet run --project tools/building-model-workflows -- run artifacts/handoff/source-cache.bfast artifacts/handoff/source-reports
dotnet run --project tools/building-model-workflows -- export-duckdb artifacts/handoff/source-cache.bfast artifacts/handoff/core.duckdb
./scripts/start-bim-flow-duckdb.ps1 -Database artifacts/handoff/core.duckdb
```

Open [the studio](http://127.0.0.1:5308/duckdb.html). The launcher builds with `--no-restore`, so restore `src/BimOpenFlow.Host` first if it has not already been built/restored by the earlier graph instructions. It uses host 5218 and web 5308, records logs/PIDs under `artifacts/bim-flow-duckdb`, and preserves existing demo-store edits. A different `-Database` is for initial preparation; existing graph source paths are retained. Use its documented fresh-store or migration procedure deliberately.

`run` emits projection, workflows, schedules, coverage, diagnostics and inventory files. `reopen`, `compare`, and `portfolio` are also available in the [CLI](../tools/building-model-workflows/Program.cs). The convenience [run-samples.ps1](../tools/building-model-workflows/run-samples.ps1) names local samples; it is not a portable public-fixture downloader.

Stop only the launcher-reported host and web PIDs when finished. Do not kill every Node/.NET process: other demos may be running. This studio's new files must first be committed or otherwise delivered to the recipient.

### 6. Developer services and the historical PoC

| Purpose | Command from repository root | Notes |
|---|---|---|
| IFC MCP | `dotnet run --project src/Ara3D.Ifc.Mcp -- --http 8766` | HTTP at `http://127.0.0.1:8766/mcp`; omit `--http` for stdio |
| Graph MCP | `dotnet run --project src/BimOpenFlow.Mcp -- --http 8767 --profile tables --store ./artifacts/handoff/tables-store` | Separate process over graph services; use the intended existing store; omit HTTP arguments for stdio |
| Fixture service | `npm --prefix viewer run serve:fixtures -w @bim-open-toolkit/demos` | Default 5175; currently requires sibling `platonic-ts` runtime; set `V2_FIXTURES_DIRS` |
| Node reference generator | `dotnet run --project src/BimOpenFlow.NodeDocs` | Developer generator; inspect arguments/output before regenerating committed docs |
| PoC host | `dotnet run --project platoflow/host -- 5214` | Conflicts with the editor's usual backend port. May prepare local source/derived files |
| PoC web | `npm --prefix platoflow/web ci`, then `npm --prefix platoflow/web run dev` | Port 5215; legacy pages and dependencies; Gratify resolves to the current submodule source |

PoC READMEs still show `ara3d-sdk/wip/...` paths. Current C# project references and the Vite Gratify alias point into this repo. The commands above correct the inherited entry-point examples; **PoC launch was not validated in this audit**.

## Dependencies and portability

| Dependency | Current relationship | Handoff consequence |
|---|---|---|
| [Vendored Ara3D SDK](../vendor/) | Local NuGet feed; SDK version `1.6.2-local` in [central props](../Directory.Build.props) | Package bytes must travel with the repo; do not substitute an identically named public version without verification |
| [Gratify submodule](../submodules/gratify/) | Shared canvas UI; consumed through source aliases and build output | Clone recursively and document upstream revision. It is used by old and new surfaces |
| Three.js | Current viewer/editor use 0.185-range declarations; PoC uses 0.169 with `@ara3d/ara3d-webgl` | Another reason to isolate the PoC. Source aliases/hoisting are not proof that published packages have complete dependency declarations |
| `Platonic.CSharp` sibling | Supplies Core/Analyzers packages for newer data/model work | `PlatonicRoot` override or a pinned feed is required on another machine; analyzers are intentionally mandatory |
| `platonic-ts` sibling | Tool wrappers and fixture-server TypeScript launcher | Move runtime/tool dependencies into a reproducible local setup or document a pinned external prerequisite |
| NRC IFC test kit | [get-test-data.ps1](../data/get-test-data.ps1) copies a sibling `nrc-ifc-llm/IFC-Test-Kit` | It does not download public data. Some tests/demos cannot run on a clone alone |
| Snowdon and other private sources | Outside version control; used by multiple producers and fixture endpoints | Provide an approved fixture provisioning process plus synthetic defaults. A local artifact is not a distributable sample |
| Native web-ifc / DuckDB | IFC DLL is copied by the loader project; DuckDB.NET supplies native database functionality | Verify native architecture/OS prerequisites, not just managed compilation |
| Browser/WebGL | Browser tests use installed Chromium channels through Playwright Core | A skipped browser test is not passing browser acceptance; GPU vs software rendering evidence must be labeled |

All major local dependencies checked for this audit were present on this machine, including the three npm installs, Gratify source/dist, both Platonic siblings, NRC fixture source, duplex IFC, combined Snowdon BFAST and typed Snowdon database. That explains why local demos may work even when a clean clone would not.

## Assessment and cleanup plan

### What is strong

The source/evidence discipline is unusually consistent across the newer work. Object identity, missing values, source units and unresolved relationships have first-class representations. The graph engine has an explicit specification and conformance suite. Effects and repeatable Runs have a defined boundary. There are real source-backed tables, a real model rendered through the new stack, and recorded interaction tests for the editable 3D graph. These are valuable foundations to preserve.

### What makes handoff difficult

1. **There is no authoritative start page.** “Demo” launches the older gallery; the newer one uses a different command, filename, fixture name and port. Several appealing planned demos are not registered.
2. **Status prose is often stale within hours.** The Sep 8 review/summary says nothing renders yet; later source, gallery screenshots and integration evidence supersede that. Gallery checkpoints still say thumbnails do not exist, but five are committed. Some referenced checkpoints were never written.
3. **The repository carries unfinished work in three different states:** committed but incomplete modules, explicit draft folders, and ignored local artifacts. Ordinary Git inspection only captures part of the recovery problem.
4. **There are multiple composition implementations.** The V2 viewer exists, but the gallery still composes `createSession`, `featureHost`, render/core and its own camera/adapters. Feature pages, slice, AO lab and BIM pane also own glue. This makes persistence, opacity, picking and cleanup parity harder to establish.
5. **Successful development builds conceal distribution gaps.** V2 source aliases work while dependency-ordered package builds are missing. Empty React/MCP public exports can pass compilation. Hoisted dependencies can hide missing package declarations.
6. **The CI badge cannot currently qualify the main product.** [CI](../.github/workflows/build.yml) builds the main .NET solution, allows test failure with `continue-on-error: true`, excludes fixture tests, and builds the old PoC web app. It does not run the current editor/viewer integration matrix. [web-smoke.mjs](../gates/web-smoke.mjs) also falls short of its “every package typechecks” description: it lists selected tests and the app build, excluding the V2 suite and an explicit all-package typecheck.
7. **Workflow ambition exceeds mapped source coverage.** Core record vocabulary, synthetic demonstrations, real source mapping and production-ready calculations must have separate status. Rendering a building does not establish trustworthy takeoff, carbon, clearance or compliance answers.

This looks like **rapid convergence with accumulated integration debt**, rather than a collection of unrelated abandoned projects. The debt is now large enough that another burst of features will not, by itself, make the repo easier to use.

### Proposed order of work

These are proposed cleanup increments, not authorized implementation changes. Each should finish with a reviewable result before the next depends on it. Assign named people to the roles; do not carry forward stale per-agent assignments as current ownership.

| Priority / increment | Work | Suggested owner | Done when |
|---|---|---|---|
| **P0 — preserve and choose a baseline** | Reconcile current DuckDB/editor changes; inventory ignored parked drafts; record owners and intended dispositions; choose a handoff commit | Maintainer/integrator | Recipient can reproduce all included work from that commit plus documented fixtures; no required source exists only on the author's disk |
| **P0 — one supported first run** | Publish a start page with table graph, synthetic gallery and optional Snowdon routes; explicit ports/stores; dependency preflight; startup/stop commands | Developer-experience owner | A second person opens a table graph and synthetic viewer from a clean checkout without private data or author assistance |
| **P0 — truthful status and CI** | Replace rolling “working” tables with current evidence links; add current viewer/editor typecheck, focused tests and production build; make failures meaningful; keep private fixture qualification separate | Maintainer + test owner | Every advertised entry point has revision, prerequisites, last check and known limitations; a broken main path fails its gate |
| **P1 — one canonical viewer composition** | Compare gallery/feature-page/BIM-pane needs with `createViewer`; close missing public hooks; migrate one host at a time with behavior checks | Viewer maintainer | Selection, camera, appearance, clipping, capture and cleanup work through the supported API in both a small demo and the graph pane |
| **P1 — finish three representative workflows** | Curate door schedule/coverage, editable 3D inspection, and typed SQL-to-table; include provenance, missing-value examples and save/reopen | Domain + app owners | Another person can explain each answer, locate its source, change a parameter, reopen the work and reproduce the result |
| **P1 — complete persistence and an output handoff** | Qualify combined saved scenes; add one graph Run → report/evidence example with reproducible commands | App + engine owners | Saved state restores the promised feature combination; generated artifact is readable independently and its evidence verifies |
| **P2 — classify and consolidate demos** | Keep public workflow demos, developer feature labs and historical references in separate labeled indexes; decide which of the remaining 16 gallery registrations justify completion | Product/demo owner | Every page has purpose, fixture basis, source link and reset behavior; no public card promises an unfinished scenario |
| **P2 — package and retire deliberately** | Add V2 build order and installed-package consumer smoke; fix external tool/runtime dependencies; qualify React/MCP; document alpha parity before retirement; archive PoC | Library maintainers | Supported packages work outside source aliases; historical surfaces remain findable but cannot be mistaken for recommended starting points |

Do not start by moving every directory or renaming all packages. First make the current boundary understandable and reproducible. Do not delete alpha core/loaders during “V2 cleanup”; they are active dependencies. Preserve the original visualization brief and historical plans, and record any requirement deferral explicitly. Maps, tracing and mesh-derived voxels remain visible deferred requirements, not completed features.

### Suggested first handoff demonstration

1. Open a seeded table graph; explain source → transform → result and show an intermediate table.
2. Open the synthetic object inspector; point out a deliberately missing or conflicting fact.
3. With approved Snowdon data, open the editable 3D graph; change a section/color parameter and show the corresponding graph state.
4. Open the typed door schedule; explain why an unknown clear width remains NULL and follow its evidence.
5. Show what can already be saved and what still needs the Run/report integration step. Present the outstanding work as a short backlog.

This demonstrates a coherent product direction without asking the recipient to infer it from dozens of technical pages.

## Verification and freshness

### What this audit actually checked

- Read the root architecture, package/project manifests, source entry points, sample seeders, launch configs, relevant plans, checkpoints and verification records.
- Enumerated current gallery registrations and standalone HTML entry points; distinguished missing, partial, draft and working-tree code.
- Used Git history for freshness, rather than file-copy timestamps. Package dates in the inventory mean **latest commit touching that directory**, possibly documentation, not last successful test or release.
- Ran `npm run typecheck` from `viewer/`: **passed** against the inspected working tree.
- Ran `npm test -w @bim-open-toolkit/demos -- test/gallery test/demos` from `viewer/`: **184 tests passed in 15 files**. This focused suite did not run the separate browser labs or the full V2 suite.
- Read-only HTTP probes returned 200 for the alpha page (5173), current 3D graph page (5300), DuckDB page (5308), new gallery (`localhost:5190`) and catalog endpoints on 5214/5218. IPv4 `127.0.0.1:5190` initially timed out; `localhost:5190` responded. Use the configured address, not a guessed binding.
- Confirmed local prerequisites/artifacts exist. Did not reinstall dependencies, replace fixtures, alter analyses, launch replacement servers, or rerun full .NET/browser/performance/release suites.

An HTTP page response proves that an entry page is served, not that its JavaScript renders correctly. Existing Sep 7–8 browser results are cited as **recorded evidence**, not newly reproduced results. Running processes may predate working-tree edits. This shared checkout already contained editor/DuckDB changes and was not frozen for this audit; fresh verification must name the final handoff revision.

Both report files passed local-link validation: **342 file/section links resolved**. The visualization baseline checker also passed, confirming the four protected archives and all 27 original feature priorities. No implementation or existing planning files were changed for this report.

### Evidence worth using next

| Evidence / command | Scope and limitation |
|---|---|
| [Alpha findings](../viewer/packages/visualization/docs/FINDINGS.md) and `npm run demo:browser` | Alpha behavior; distinguish it from V2 acceptance |
| [V2 status](plans/visualization/V2-STATUS.md), package checkpoints | Detailed development evidence, but older progress statements need reconciliation with source |
| [Gallery smoke record](../viewer/packages/demos/docs/gallery-smoke.md) and `npm run gallery:smoke` | Five default demo routes drew. Script also rewrites thumbnails/report; not a full interaction matrix or performance qualification |
| [3D graph integration](bim-flow-3d.md), `scripts/check-bim-flow-graph.mjs` | Real graph interactions/pixels. Use an isolated store; checks edit and restore an analysis |
| [DuckDB guide](bim-flow-duckdb.md), `scripts/check-bim-flow-duckdb.mjs` | Nine workflows, recomputation, schema choices and unchanged DB hash. Snowdon-specific assertions; working-tree feature |
| [Core workflow validation](../tools/building-model-workflows/VALIDATION.md) | Source-backed architectural reports and deterministic reopening; no broad domain/compliance claim |
| `npm run test:v2`, package tests, [gates](../gates/README.md) | Useful code checks; inspect actual coverage and browser skips rather than trusting the gate's name |
| [Immutable baseline checker](plans/visualization/check-baselines.mjs) | Protects original visualization source/history when planning changes; does not judge semantic completeness |

The durable handoff status should use four separate columns: **implemented**, **locally verified**, **combined verification**, and **release-qualified**. A feature can be useful well before it reaches the last column.
