# Architecture

How the repository is layered, what each project does, and why the graph is shaped
the way it is. For the short version read [OVERVIEW.md](OVERVIEW.md); for build and
run instructions read the [README](../README.md).

## The idea

A pipeline is a graph of small, pure functions over tables.

```
  bos.load ──┬─► table.filter ──► table.aggregate ──┬─► chart.bar        (2D report)
             │                                      └─► sink.exportCsv  (ETL out)
             └─► view3d.instances ──► view3d.color ────► viewPane3D     (3D view)
```

Five kinds of work, one vocabulary:

| Kind of pipeline | How it is expressed |
|---|---|
| **ETL** | file/database sources → clean, join, reshape → export nodes (CSV, Parquet, XLSX, SQLite, DuckDB, JSON) |
| **3D visualization** | `view3d.instances` → color / isolate / explode / decimate / voxelize → the 3D pane |
| **2D reports and charts** | table nodes → `chart.bar`, `chart.line`, `view.table` → HTML report or dashboard |
| **Database queries** | `duck.query`, `sql.query`, `sqlite.query` — SQL is a node, not a separate tool |
| **BIM queries** | `bim.rooms`, `bim.containment`, `bim.nearest`, `bim.navGraph`, `check.rule`, … |

They compose because they are the same thing. A BIM query feeds a chart; a SQL query
feeds a 3D coloring; a compliance check feeds a report. There is no boundary to cross.

What makes this editable by a program as easily as by a person:

- **A graph is a JSON document with four layers.** `structure` (nodes and edges),
  `values` (parameters as canonical strings), `layout` (positions), `session`
  (presentation). `structure + values` alone determine the result — an agent that never
  touches layout still produces a graph a human can open.
- **Edits are small named operations.** `addNode`, `connect`, `setParam`, `removeNode` —
  the same operations behind the HTTP API, the MCP tools, and every mouse gesture in the
  editor. There is no "agent path" and "human path" to keep in sync.
- **The node catalog is self-describing.** Every node declares its ports, parameter kinds,
  allowed enum values, and whether it is Pure or Effect. An agent reads the catalog and
  knows the whole vocabulary; the editor draws its UI from the same declaration; the
  reference in [nodes.md](nodes.md) is generated from it. [nodes.catalog.json](nodes.catalog.json)
  is the studio's catalog answer, every pack included; the generic host's answer is committed
  in bim-open-flow as `bimopenflow/web/packages/graph/test/nodes.catalog.json`, so the editor's
  tests size node cards without a host.
- **Failure is a state, not an exception.** Evaluating returns a per-node summary — `Ok`,
  `Unready`, `EffectPending`, `Unavailable`, `Error` — so a partially wired graph is a
  legitimate intermediate state to reason about and repair.
- **Nothing happens by accident.** Pure nodes are memoized and re-evaluated freely.
  Effect nodes — anything that writes a file or an IFC property set — execute *only*
  inside an explicit Run. Re-evaluating for display can never touch your disk.

## Layers

The repo is five layers, each depending only on the ones above it.

### 1. Specification — `deps/ara3d-dataflow/spec/`, `deps/bim-open-flow/contracts/`

The normative definition, in four independently versioned parts: `format` (the graph
document, canonical JSON, the graph hash), `semantics` (evaluation, memoization, dirty
propagation, Pure/Effect gating), `expressions` (the expression language), `runs` (the
frozen run record).

The spec is the authority; the C# engine is the *canonical implementation*, proven so by
a conformance suite that runs every vector in the spec directory. Any other
implementation passes the same vectors or is wrong.

`contracts/` (in bim-open-flow, at `deps/bim-open-flow/contracts/`) is the single source for shared app-level types — HTTP endpoints, node
descriptors, shared enums. Edit its `contracts.json`, run the generator, and both
the C# host and the TypeScript client are regenerated. Types are never hand-copied
across the language boundary.

### 2. Engine — `deps/ara3d-dataflow/src/Ara3D.DataFlowEngine*`, `deps/ara3d-dataflow/src/Ara3D.NodeGraph*`

Contains no BIM whatsoever, and is a candidate to graduate to its own repo.

| Project | Role |
|---|---|
| `DataFlowEngine.Abstractions` | The node SDK: ports, value kinds, capability declarations, the registry. Tiny and stable — every node pack compiles against it. |
| `NodeGraph` | The document object model: load, save, validate, and transactional editing. Knows nothing about evaluation. |
| `DataFlowEngine` | The evaluator: scheduling, memoization, dirty propagation, standing sessions that observers subscribe to. |
| `DataFlowEngine.Expressions` | Parser, type checker, evaluator for the expression language used by derive/filter nodes. |
| `DataFlowEngine.Runs` | Freezing an evaluation into a run record (graph hash + input hashes + outputs), and replaying it. |
| `NodeGraph.Migrations` | Version-to-version document upgrades, kept out of the document model. |
| `DataFlowEngine.TestKit` | Fluent graph builders, probe nodes, evaluation assertions — shipped as a real package, not test internals. |

Six value kinds travel on edges: Boolean, Integer, Number, Text, **Table**, and **Relation**
(a lazy query the `rel.*` nodes build and DuckDB runs). Tables are the currency; almost everything useful is an immutable table flowing between nodes.

### 3. BIM data — `deps/bim-open-data/`, `plugins/`

The libraries in this section live in their own repository, [bim-open-data](https://github.com/ara3d/bim-open-data), with their tests, the IFC MCP server, the BOS Browser, and the IFC type generator. The toolkit pins it in `deps.json`; `node deps.mjs` puts it at `deps/bim-open-data`, and the toolkit's projects reference `$(DepsRoot)bim-open-data/src/...`. Only the Revit add-ins under `plugins/` stay here.

**BIM Open Schema** is the model. The problem it solves: BIM data is locked behind
per-tool APIs, and the exchange formats that exist are shaped for geometry interchange,
not for analysis. Getting a column of numbers out of a building model normally means
writing against a proprietary API, in a proprietary process, on a proprietary machine.

BOS is the other shape. Its design principles:

- **Columnar, not object-graph.** Entities, parameters, relations, geometry, and shared
  string/number pools are lists — one table per list, one Parquet file per list.
  Optimized for compact storage and fast load into analytical tools, explicitly *not*
  for ad-hoc queries: the intended workflow is to ingest into DuckDB and build wide,
  denormalized views for the question at hand.
- **Serialization-independent.** The schema is an object model. JSON, Parquet, BFAST,
  SQLite, or in-memory C# are all just encodings of it.
- **Interned everything.** Strings, numbers, and points live in pools; entities and
  parameters hold typed indices into them (`StringIndex`, `EntityIndex`, …), so the
  index types make wrong joins a compile error rather than a silent bug.
- **EAV parameters.** One entity-attribute-value table per primitive type, with a
  descriptor carrying name, units, group, and type. Two parameters may share a name and
  differ in type without colliding.
- **Relations are a closed, named set.** `PartOf`, `ContainedIn`, `HostedBy`, `BoundedBy`,
  `Serves`, `Voids`, `Fills`, … — chosen to cover both the Revit API and IFC, so a
  federated model from mixed sources has one relation vocabulary.
- **Federated by construction.** A `Document` index on every entity; multiple source
  files in one dataset.

The specification is the `bim-open-schema` repository (`deps/bim-open-schema`): five C# files with no package
references. Around it, in bim-open-data's `src/data/`: `BimOpenSchema.ObjectModel` (builders, accessors, and
a navigable object graph), `BimOpenSchema.IO` (Parquet, BFAST, Excel, DuckDB),
`Ara3D.Ifc.Bos` (the IFC→BOS converter), `BimOpenSchema.DuckDb` (the view/query layer,
isolating the native DuckDB dependency), and `BimOpenSchema.Harmonizer` (unit conversion
and category/parameter mapping — appending SI canonical columns so numbers from different
sources are comparable). Producers and viewers sit beside them: the Revit 2025 exporter
add-in under `plugins/` and the BOS Browser under bim-open-data's `apps/`.

**IFC workflows** are handled by four projects that stay deliberately separate:

- `Ara3D.IfcTypes` / `Ara3D.IfcLoader` — parsing and the entity/relation model (backed by web-ifc).
- `Ara3D.Ifc.Mesher` — tessellation, the only place the native geometry dependency lives.
- `Ara3D.Ifc.Editing` — **byte-exact** property-set editing: `IfcSourceFile` and
  `IfcEntitySpan` locate entities by byte range, `IfcPropertySetBuilder` composes new
  psets, `IfcDiff` and `IfcPatcher` splice them in. Everything you did not edit comes out
  identical, byte for byte. This is what makes write-back to a client's IFC file
  defensible.
- `BimOpenMcp.Ifc` — an MCP server exposing IFC models directly to an agent: entities,
  properties, relations, geometry, analytics, and a session cache.

### 4. Node packs — `src/flow/BimOpenFlow.Nodes.*` and `deps/bim-open-flow/src/flow/BimOpenFlow.Nodes.*`

The vocabulary: **124 nodes across 13 packs**, each pack a separate project with its own
dependencies and its own tests. Packs never reference each other. The counts below come
from the generated [node reference](nodes.md). `Bos`, `BimAnalysis`, and `Geometry` are this
repository's; the other packs (and the support library `Nodes.Support`) are
`ara3d/bim-open-flow`'s, taken from `deps/bim-open-flow` since the repository split's
phase 5 ([repository-split.md](plans/repository-split.md)).

| Pack | Nodes | What it covers |
|---|---|---|
| `Bos` | 2 | Loading `.bos`, and querying it |
| `BimAnalysis` | 12 | Elements, rooms, levels, bounds, parameter coverage, discipline, containment, nearest, nav graph, hops |
| `Geometry` | 21 | 3D instances, color, isolate, hide, opacity, explode, arrange, decimate, bounding boxes, voxelize, camera |
| `DuckDb` | 9 | DuckDB and SQL over files: read, query, CSV/Parquet/JSON sources |
| `Tables` | 13 | XLSX, SQLite, BFAST, joins, set operations, projection, inline tables, ranges, calendars |
| `TableOps` | 18 | Filter, derive, aggregate, sort, cast, concat, distinct, drop, limit, pivot/unpivot, profile, rename, sample, schema, split, transpose, window |
| `Cleaning` | 6 | Fill/drop nulls, dedupe, replace, text transform and extract |
| `Dates` | 6 | Parse, part, truncate, diff, offset, filter |
| `Compliance` | 4 | Rule checks, required-value checks, rollups, unions — the evidence-bearing vocabulary |
| `Viz` | 5 | Bar chart, line chart, table view, colour map, note |
| `Spatial` | 8 | Bounding-box and polygon candidates: intersects, within, nearest, contains, footprint |
| `Relations` | 12 | The `rel.*` pack: lazy plans over CSV and DuckDB tables, one SQL statement per chain |
| `Effects` | 8 | Every Run-gated sink in one place: six export formats, IFC pset write-back, report emission |

Isolating all effects in one pack makes the purity rule enforceable by project reference
alone. File-reading nodes are still pure: their cache key is a hash of the file's
*content*, so an unchanged file is never re-read and an edited one is picked up
automatically.

### 5. Surfaces — `deps/bim-open-flow` (host, MCP, editor), `src/studio`, `bimopenflow/web`, `deps/bim-open-viewer/`

One headless core; every UI is a client of it. The host libraries, the MCP server, the Ask
loop, the outputs, and the editor's eight generic web packages are bim-open-flow's
(`deps/bim-open-flow/src/...` and `deps/bim-open-flow/bimopenflow/web/packages/...`); this
repository composes them in the studio and adds the 3D pane, the notebook, and the pages.

- **`Host.Catalog`** — model discovery and IFC→BOS conversion with caching.
- **`Host.Store`** — the analysis library on disk: versioned graph documents, run archival.
- **`Host.Api`** — the HTTP surface, generated from `contracts/`, holding no business
  logic. Fourteen endpoints including a server-sent-event stream of evaluation updates.
- **`Host`** — the generic host process (`bimopenflow-host`). It names no BIM pack: a
  front end composes it with `HostProfile`s (node packs, seeded samples, background jobs),
  and on its own it offers only the `tables` profile.
- **`src/studio/BimOpenFlow.Studio`** — the BIM composition root (`bimopenflow-studio`).
  It composes the `bim` profile (the Bos, BimAnalysis, and Geometry packs over the generic
  ones), adds the NRC samples and their preparation jobs to `tables`, serves `/api/ask`,
  and has two more verbs: `mcp` (the flow MCP server over the studio's profiles) and
  `nodedocs` (writes [nodes.md](nodes.md) and [nodes.catalog.json](nodes.catalog.json)).
- **`Mcp`** — thirteen MCP tools over *the same* services: `listModels`, `listAnalyses`,
  `getAnalysis`, `saveAnalysis`, `getNodeCatalog`, `addNode`, `connect`, `setParam`,
  `removeNode`, `evaluate`, `getResult`, `listRuns`, `createRun`.
- **The editor** — bim-open-flow's packages, linked into `bimopenflow/web` by `file:`
  dependencies and resolved to their source by `flow.config.ts` (Vite) and
  `deps.tsconfig.json` (tsc): `graph` (the canvas as a component: nodes,
  wires, inline controls, peeks, node styles, theme; mountable several times on a
  page, each mount with its own state, and read-only on request), `app` (the studio
  shell around it: sidebar, topbar, panes area, palette, step list, problems strip,
  start page), `panes` (table, chart, inspector, verdict), `viz` (SVG charts),
  `client`, `state`, and generated `contracts` / `api-client` packages. This repository's
  workspace holds `pane-3d` (the 3D pane), `studio-web` (the studio's pages), and
  `bim-open-notebook`. The canvas is built on
  the primitives of Gratify (`deps/gratify`); graph-specific behaviour stays in
  bim-open-flow, deliberately, rather than upstream (see
  [graph-module-layering.md](graph-module-layering.md)). `bim-open-notebook` is a
  separate page and package in the same workspace: a session transcript with live
  embeds, mounting `graph` read-only in every graph cell and reusing `panes` for
  the rest.
- **`deps/bim-open-viewer/`** — the standalone 3D viewer workspace of seventeen packages, described in
  [OVERVIEW.md](OVERVIEW.md#the-3d-viewer).
- **`Publishing` / `Reports` / `Dashboards` / `Evidence`** — turning a run into an
  artifact: self-contained HTML with inlined data, verdict tables, dashboards, and
  evidence packages whose manifest is canonical JSON with a SHA-256 per member file.

### Enforced boundaries

`tests/BimOpenToolkit.Layering.Tests` turns the layering into failing tests:

- **Folders point down.** `flow` may reference `data`; `mcp` adds `flow`; `studio` may
  reference all three; `plugins` and `tools` sit on `data`. A reference into
  `deps/bim-open-flow/src/<group>` counts as that group, so nothing in `src/flow` or
  `tests/flow` references `src/studio` (`LayeringTests`).
- **Packs stay independent.** The BIM packs reference no pack but `Nodes.Support`, never the
  host or the run outputs (`FlowLayeringTests`); bim-open-flow's own layering test holds the
  same rules for its packs, and that only `Nodes.Effects` sees run records and `Relations`
  never sees DuckDB.
- **The generic tool has no BIM in it.** bim-open-flow's layering test fails if any of its
  projects references `Nodes.Bos`, `Nodes.BimAnalysis`, `Nodes.Geometry`, or
  `Ara3D.Ifc.Mesher`, if a web package depends on or imports `@bim-open-viewer/*`,
  `@bimopenflow/pane-3d`, the notebook, or `studio-web`, or if `NodeDocs`'s notes name a
  kind no generic pack registers; the BIM packs' notes are `BimNodeNotes` in the studio.
- **The notebook keeps the 3D pane out of its embeds**: its `test/layering.test.ts` keeps
  `@bim-open-viewer/*` and `@bimopenflow/pane-3d` out of `src/embeds`, where a page registers
  the 3D embed instead, and `WebSeamTests` fails if that file disappears. The viewer never
  depends on `@bimopenflow/*` (`LayeringTests`).

## Agentic workflows

The graph was designed on the assumption that most edits would be made by a program.

**One set of operations.** An agent adds a node with the same call the editor uses. There
is no scripting API drifting away from the UI, because there is no second API.

**The catalog is the documentation.** `getNodeCatalog` returns every node kind with its
ports, parameter kinds, enum values, and capability. Parameters can declare a live
suggestion source — the columns of a connected table, the tables in a named file — so an
agent asks what column names exist rather than guessing. Suggestions are advisory; any
string is accepted, and validation stays an evaluation-time concern.

**Read-back is cheap and paged.** `evaluate` returns a state per node; `getResult`
returns any node's output as a paged table slice. The loop is edit → evaluate → read →
repair, with a real value at every step, not a log to parse.

**Effects are gated, so exploration is safe.** An agent can wire, evaluate, and inspect
freely. Nothing is written until someone calls `createRun`.

**Runs are the audit trail.** A run record pins the graph hash and every input by content
hash alongside the outputs, and can be replayed. When an agent produces a number, the
number comes with a reproducible derivation — which is the difference between a
suggestion and evidence.

**The repo is laid out for parallel agents.** Many small projects with explicit
dependencies, a test project beside most source projects, and a written fence discipline
([CONTRACTS.md](../CONTRACTS.md)) recording which track writes where. Small modules are not
only a design preference here; they are what lets several agents work at once without
colliding.

A worked example of an agent building a graph from a plain-language request is in
[bim-flow-mcp-demo.md](bim-flow-mcp-demo.md).

## Boundary and provenance

[bim-open-schema](https://github.com/ara3d/bim-open-schema)
is the specification as code and nothing else. [ara3d-sdk](https://github.com/ara3d/ara3d-sdk)
is the general-purpose layer — utilities, geometry, data tables, file formats, glTF
export, the Bowerbird plug-in host, the MCP protocol — built here from source through
`deps/ara3d-sdk` and `Directory.Build.targets`. [bim-open-data](https://github.com/ara3d/bim-open-data)
holds the BOS reference implementation, IFC, the IFC MCP server, and the BOS Browser.
This repository holds the graphs over them, the Revit add-ins, and the Studio BIM tools.
All three come through `deps.json`, as do the engine ([ara3d-dataflow](https://github.com/ara3d/ara3d-dataflow),
at `deps/ara3d-dataflow`) and the viewer, which take only SDK dependencies.

The original project-structure proposal from 2026-08-30, with the dependency sketch and
build-order rationale, is kept in [bimopenflow-structure.md](bimopenflow-structure.md).
