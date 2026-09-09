# BIM Open Toolkit

An open, verifiable data layer for building information — and a node graph on top of it
that humans and AI agents edit with the same operations.

Two things live here:

- **BIM Open Schema (BOS)** and its converters: a columnar, tool-independent
  representation of federated BIM data, plus IFC loading, meshing, and byte-exact
  IFC editing.
- **BimOpenFlow**: a specified dataflow graph — an engine, a node vocabulary, a
  headless host, an MCP server, and a web editor — for building ETL pipelines, 3D
  views, charts, reports, and database queries out of that data.

The node graph is the centrepiece. Everything else is either what flows through it or
a surface that drives it.

---

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

**What makes this editable by a program as easily as by a person:**

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
  reference in [`docs/nodes.md`](docs/nodes.md) is generated from it.
- **Failure is a state, not an exception.** Evaluating returns a per-node summary — `Ok`,
  `Unready`, `EffectPending`, `Unavailable`, `Error` — so a partially wired graph is a
  legitimate intermediate state to reason about and repair.
- **Nothing happens by accident.** Pure nodes are memoized and re-evaluated freely.
  Effect nodes — anything that writes a file or an IFC property set — execute *only*
  inside an explicit Run. Re-evaluating for display can never touch your disk.

---

## Taxonomy

The repo is five layers, each depending only on the ones above it.

### 1. Specification — `spec/`, `contracts/`

The normative definition, in four independently versioned parts: `format` (the graph
document, canonical JSON, the graph hash), `semantics` (evaluation, memoization, dirty
propagation, Pure/Effect gating), `expressions` (the expression language), `runs` (the
frozen run record).

The spec is the authority; the C# engine is the *canonical implementation*, proven so by
a conformance suite that runs every vector in the spec directory. Any other
implementation passes the same vectors or is wrong.

`contracts/` is the single source for shared app-level types — HTTP endpoints, node
descriptors, shared enums. Edit `contracts/contracts.json`, run the generator, and both
the C# host and the TypeScript client are regenerated. Types are never hand-copied
across the language boundary.

### 2. Engine — `src/Ara3D.DataFlowEngine*`, `src/Ara3D.NodeGraph*`

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

Five value kinds travel on edges: Boolean, Integer, Number, Text, and **Table**. Tables
are the currency; almost everything useful is an immutable table flowing between nodes.

### 3. BIM data — `src/Ara3D.BimOpenSchema*`, `src/Ara3D.Ifc*`

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

Around it: `BimOpenSchema.IO` (Parquet, BFAST, Excel, DuckDB, and the IFC→BOS converter),
`BimOpenSchema.DuckDb` (the view/query layer, isolating the native DuckDB dependency),
and `BimOpenSchema.Harmonizer` (unit conversion and category/parameter mapping —
appending SI canonical columns so numbers from different sources are comparable).

**IFC workflows** are handled by four projects that stay deliberately separate:

- `Ara3D.IfcTypes` / `Ara3D.IfcLoader` — parsing and the entity/relation model (backed by web-ifc).
- `Ara3D.Ifc.Mesher` — tessellation, the only place the native geometry dependency lives.
- `Ara3D.Ifc.Editing` — **byte-exact** property-set editing: `IfcSourceFile` and
  `IfcEntitySpan` locate entities by byte range, `IfcPropertySetBuilder` composes new
  psets, `IfcDiff` and `IfcPatcher` splice them in. Everything you did not edit comes out
  identical, byte for byte. This is what makes write-back to a client's IFC file
  defensible.
- `Ara3D.Ifc.Mcp` — an MCP server exposing IFC models directly to an agent: entities,
  properties, relations, geometry, analytics, and a session cache.

### 4. Node packs — `src/BimOpenFlow.Nodes.*`

The vocabulary: **89 nodes across 11 packs**, each pack a separate project with its own
dependencies and its own tests. Packs never reference each other.

| Pack | Nodes | What it covers |
|---|---|---|
| `Bos` | 6 | Loading `.bos`, and the core transforms: filter, derive, aggregate, sort |
| `BimAnalysis` | 12 | Elements, rooms, levels, bounds, parameter coverage, discipline, containment, nearest, nav graph, hops |
| `Geometry` | 11 | 3D instances, color, isolate, hide, opacity, explode, arrange, decimate, bounding boxes, voxelize, camera |
| `DuckDb` | 8 | DuckDB and SQL over files: read, query, CSV/Parquet/JSON sources |
| `Tables` | 11 | XLSX, SQLite, joins, set operations, projection, inline tables, ranges, calendars |
| `TableOps` | 14 | Cast, concat, distinct, drop, limit, pivot/unpivot, profile, rename, sample, schema, split, transpose, window |
| `Cleaning` | 6 | Fill/drop nulls, dedupe, replace, text transform and extract |
| `Dates` | 6 | Parse, part, truncate, diff, offset, filter |
| `Compliance` | 4 | Rule checks, required-value checks, rollups, unions — the evidence-bearing vocabulary |
| `Viz` | 3 | Bar chart, line chart, table view |
| `Effects` | 8 | Every Run-gated sink in one place: six export formats, IFC pset write-back, report emission |

Isolating all effects in one pack makes the purity rule enforceable by project reference
alone. File-reading nodes are still pure: their cache key is a hash of the file's
*content*, so an unchanged file is never re-read and an edited one is picked up
automatically.

### 5. Surfaces — `src/BimOpenFlow.Host*`, `src/BimOpenFlow.Mcp`, `bimopenflow/web`, `viewer/`

One headless core; every UI is a client of it.

- **`Host.Catalog`** — model discovery and IFC→BOS conversion with caching.
- **`Host.Store`** — the analysis library on disk: versioned graph documents, run archival.
- **`Host.Api`** — the HTTP surface, generated from `contracts/`, holding no business
  logic. Fourteen endpoints including a server-sent-event stream of evaluation updates.
- **`Host`** — the composition root and the deployable process.
- **`Mcp`** — thirteen MCP tools over *the same* services: `listModels`, `listAnalyses`,
  `getAnalysis`, `saveAnalysis`, `getNodeCatalog`, `addNode`, `connect`, `setParam`,
  `removeNode`, `evaluate`, `getResult`, `listRuns`, `createRun`.
- **`bimopenflow/web`** — the editor: `app` (canvas, sidebar, shell), `panes` (table,
  chart, 3D, inspector, verdict), `viz` (SVG charts), `state`, and generated
  `contracts` / `api-client` packages. The canvas is built on the Gratify submodule's
  primitives; graph-specific behaviour stays here, deliberately, rather than upstream.
- **`viewer/`** — the standalone 3D viewer packages (core, controls, loaders).
- **`Publishing` / `Reports` / `Dashboards` / `Evidence`** — turning a run into an
  artifact: self-contained HTML with inlined data, verdict tables, dashboards, and
  evidence packages whose manifest is canonical JSON with a SHA-256 per member file.

---

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
dependencies, one test project per source project, and a written fence discipline
([`CONTRACTS.md`](CONTRACTS.md)) recording which track writes where. Small modules are not
only a design preference here; they are what lets several agents work at once without
colliding.

---

## Repo map

| Where | What |
|---|---|
| `spec/dataflow-graph/` | The normative graph specification and its conformance vectors |
| `contracts/` | Shared type definitions and the C#/TypeScript generator |
| `src/` | 39 C# projects: engine, BIM data layer, node packs, host, MCP servers |
| `tests/` | 37 NUnit suites, one per source project, plus the conformance suite |
| `bimopenflow/web/` | The web editor workspace (npm workspaces) |
| `viewer/` | Standalone 3D viewer packages |
| `samples/` | Runnable sample analyses: tables, BIM, and 3D, with sample data |
| `docs/` | Architecture decisions and the generated node reference |
| `vendor/` | Vendored general-purpose Ara3D.SDK NuGet packages |
| `submodules/gratify` | The Gratify canvas UI library (git submodule) |
| `data/` | Test fixtures — **not committed**; populate with `./data/get-test-data.ps1` |

## Build and run

```bash
git clone --recursive https://github.com/ara3d/bim-open-toolkit
dotnet build BimOpenToolkit.sln
```

Run the headless host:

```bash
dotnet run --project src/BimOpenFlow.Host -- --port 5214 --models ./data
```

Run the web editor against it:

```bash
npm run web --prefix bimopenflow/web
```

Tests need fixtures: run `./data/get-test-data.ps1` first. The sample analyses in
`samples/` run without them.

## Running the demos

Two local demos show BimOpenFlow graphs end to end: a **3D demo** that colors, sections
and explodes a building model, and a **DuckDB demo** that runs SQL-backed schedules,
joins and aggregations. Both need Node.js, npm, the .NET 8 SDK, and the private
Snowdon sample model. Every command below runs from the repository root, and each
service keeps its own terminal until you press Ctrl+C.

One-time setup for both demos:

```bash
git submodule update --init --recursive
npm install --prefix viewer
npm run build --prefix viewer
npm install --prefix bimopenflow/web
```

### 3D demo

The host reads `%USERPROFILE%\Documents\BIM Open Schema\Snowdon Towers Sample Architectural.bos`.
Set `BIMOPENFLOW_SNOWDON` to a full path to use another copy.

Start the host in one terminal (port 5214):

```bash
npm run host --prefix bimopenflow/web
```

Start the editor in a second terminal (port 5300):

```bash
npm run web --prefix bimopenflow/web
```

Open http://127.0.0.1:5300/3d.html. Select graph nodes to preview category colors,
ghosting, sections and explosion on the right; edit node controls to update the view.
Graph edits autosave. Use **Fit graph** or the viewer's **Fit** button to reframe.

Snowdon is seeded only into an empty store. Delete `artifacts/bim-flow/store` to reseed.
If port 5214 is refused, an earlier host is still running: stop it rather than picking
another port, because a second `dotnet run` cannot rebuild over the binaries the running
host holds open. See [BIMOPENFLOW.md](BIMOPENFLOW.md) for the full notes.

### DuckDB demo

The demo reads `artifacts/building-model-workflows/snowdon-cli.duckdb`. Once, prepare the
nine sample graphs and build a separate host under `artifacts/bim-flow-duckdb/host`:

```bash
npm run duckdb:prepare --prefix bimopenflow/web
```

```bash
npm run duckdb:build --prefix bimopenflow/web
```

Start the host in one terminal (port 5218):

```bash
npm run duckdb:host --prefix bimopenflow/web
```

Start the page in a second terminal (port 5308):

```bash
npm run duckdb:web --prefix bimopenflow/web
```

Open http://127.0.0.1:5308/duckdb.html. The flow picker in the top bar switches between
the sample graphs (door and room schedules, rooms by storey, missing door widths,
provenance, and more). Click a node to inspect that stage's table; parameter edits save
to the demo store and recompute; **Download** exports the current graph.

Preparing again preserves existing edits. Rerun `duckdb:build` after changing C# nodes.
Because this host builds into its own output directory, it does not collide with the 3D
demo's host, and the two demos can run at the same time. To point the demo at another
compatible database, run `node scripts/prepare-bim-flow-duckdb.mjs <database> <store>`.
See [docs/bim-flow-duckdb.md](docs/bim-flow-duckdb.md) for the workflow catalog and the
verification script.

An agent can build these graphs from a plain-language request through the `bimopenflow-duckdb`
MCP server registered in `.mcp.json`; see [docs/bim-flow-mcp-demo.md](docs/bim-flow-mcp-demo.md)
for the setup, the request, the tool sequence, and a scripted replay (`duckdb:mcp-demo`).

## Boundary and provenance

Only BIM/IFC-specific code lives here. General-purpose libraries — utilities, geometry,
data tables, glTF export, the MCP protocol — remain in
[ara3d-sdk](https://github.com/ara3d/ara3d-sdk) and are consumed as vendored NuGet
packages. Projects copied from there carry their source path and commit SHA in their
README. The engine group and the viewer take only vendored SDK dependencies and are
candidates to graduate to their own repos once stable; the BIM-specific projects stay
here permanently.

[bim-open-schema](https://github.com/ara3d/bim-open-schema) remains the schema's spec
repo; this is its reference implementation.

License: MIT.
