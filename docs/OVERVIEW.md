# BIM Open Toolkit — Overview

An open, verifiable data layer for building information — and a node graph on top of it
that people and AI agents edit with the same four operations.

`98 nodes` · `11 node packs` · `46 C# projects` · `41 test projects` · MIT

## What it is

**BIM Open Schema** is a plain, columnar way to store building data. Instead of an object
graph locked behind a vendor API, everything is a list — entities, parameters, relations,
geometry, plus pooled strings and numbers. One table per list, one Parquet file per list,
loaded straight into DuckDB. Parameters are stored entity-attribute-value, one table per
primitive type, so two parameters can share a name and differ in type. Relations come from
a closed vocabulary — `PartOf`, `ContainedIn`, `HostedBy`, `BoundedBy` — chosen to cover
both the Revit API and IFC, so a federated model from mixed sources speaks one language.

**BimOpenFlow** is a node graph over that data. Nodes are small pure functions over tables,
and tables are the currency: of the five value kinds that travel on an edge, the one that
matters is `Table`. One vocabulary covers ETL, 3D views, charts and reports, SQL, and code
compliance — so they compose. A rule check can feed a chart. A SQL query can color a 3D
model. There is no boundary to cross, because there is only one kind of pipeline.

```
  bos.load ──┬─► table.filter ──► table.aggregate ──┬─► chart.bar        (2D report)
             │                                      └─► sink.exportCsv  (effect, run-gated)
             └─► view3d.instances ──► view3d.color ────► viewPane3D      (3D view)
```

Pure nodes are memoized and re-evaluated freely. Effect nodes — anything that writes a file
or an IFC property set — execute only inside an explicit Run, so re-evaluating for display
can never touch your disk.

## Why an agent can drive it

- **Four operations, one path.** `addNode`, `connect`, `setParam`, `removeNode` back the
  HTTP API, the MCP tools, and every mouse gesture in the editor. There is no scripting API
  drifting away from the UI, because there is no second API.
- **The catalog is the documentation.** Every node declares its ports, parameter kinds,
  enum values, and whether it is Pure or Effect. Parameters can name a live suggestion
  source — the columns of a connected table — so an agent asks what exists rather than
  guessing.
- **Failure is a state, not an exception.** Evaluating returns `Ok`, `Unready`,
  `EffectPending`, `Unavailable` or `Error` per node. A half-wired graph is a legitimate
  thing to reason about and repair.
- **Runs are the audit trail.** A run record pins the graph hash and every input by content
  hash alongside the outputs, and replays. When an agent produces a number, the number comes
  with a reproducible derivation — the difference between a suggestion and evidence.

## How it is stacked

Five layers, each depending only on the ones above it.

1. **Specification** (`spec/`, `contracts/`) — the normative definition in four versioned
   parts: format, semantics, expressions, runs. The C# engine is the canonical
   implementation, proven so by a conformance suite that runs every vector in the spec
   directory.
2. **Engine** (`Ara3D.DataFlowEngine*`, `Ara3D.NodeGraph*`) — document model, evaluator,
   expression language, run records, test kit. Contains no BIM whatsoever, and is a
   candidate to graduate to its own repo.
3. **BIM data** (`Ara3D.BimOpenSchema*`, `Ara3D.Ifc*`) — the schema and its converters, plus
   IFC parsing, meshing, and byte-exact property-set editing: entities located by byte range,
   so everything you did not edit comes out identical, byte for byte. That is what makes
   write-back to a client's file defensible.
4. **Node packs** (`BimOpenFlow.Nodes.*`) — the vocabulary. Eleven packs — BIM analysis,
   geometry, DuckDB, tables, table ops, cleaning, dates, compliance, viz, effects — each its
   own project with its own dependencies. Packs never reference each other, and every effect
   lives in one pack, which makes the purity rule enforceable by project reference alone.
5. **Surfaces** (`BimOpenFlow.Host*`, `BimOpenMcp.Flow`, `bimopenflow/web`, `viz/`) — one
   headless core; every UI is a client of it. An HTTP host generated from the contracts,
   thirteen MCP tools over the same services, the web editor, the 3D viewer workspace below,
   and the publishing path that turns a run into self-contained HTML or an evidence package
   with a SHA-256 per file.

## The 3D viewer

`viz/` is a separate npm workspace of seventeen packages: a general-purpose WebGL viewer
built on three.js, deliberately BIM-free — it knows nothing about IFC, BOS, or any other
file format. `three` is a peer dependency of every package, so the host application picks
the version and only one copy ever loads.

| Package | Role |
|---|---|
| `@ara3d/viewer-core` | Renderer: scene management, instanced drawing, materials, per-instance color, frame loop |
| `@ara3d/viewer-loaders` | Ingestion: BOS geometry and GLB loading with progress reporting |
| `@ara3d/viewer-controls` | Interaction: camera navigation, picking and selection, section planes |
| `@bim-open-toolkit/model` | Data contracts and pure operations with no runtime dependencies at all — no three.js, no browser API, no sibling package |
| `render`, `interact` | The instance table and bulk column updates, picking, clipping, overlays, capture; camera arithmetic and three navigation modes |
| `formats`, `workflows` | One `LoadedModel` entry point that reports its failures instead of raising them; ten review workflows as pure result adapters |
| `synthetic`, `testing` | Seeded generators for demonstration and test data; named scenes, a hand-wound clock, and a scene built without a browser |
| `ui-react`, `ui-gratify`, `demos`, `mcp` | UI bindings, the demo gallery, and an MCP surface over the same model layer |

The facade is three lines:

```ts
import { createViewer } from '@bim-open-toolkit/viewer';

const viewer = createViewer(canvas);
await viewer.open('/models/building.bfast');
viewer.run('view.fit', {});
```

That is a renderer on the canvas, a model loaded and drawn, navigation on the pointer, click
to select, a frame loop that draws only when something changed, and one `dispose()` that
leaves nothing behind. Coloring objects goes through the same door — `viewer.apply(styleRule(...))`
— for the same reason BimOpenFlow has four operations: one path, so there is no second API to
keep in sync.

Because the model layer is pure and the three.js object-graph logic is kept separate from
`WebGLRenderer`, the unit tests run headless under Node and never need a WebGL context.

## Where it sits

| Project | Relationship |
|---|---|
| [bim-open-schema](https://github.com/ara3d/bim-open-schema) | The schema's spec repo: five dependency-free C# files. This is its reference implementation. |
| [ara3d-sdk](https://github.com/ara3d/ara3d-sdk) | General-purpose utilities, geometry, data tables, file formats, glTF, the Bowerbird host, MCP protocol — built from source through the submodule. Everything specific to Revit, IFC, or BOS lives in this repo. |
| `submodules/gratify` | The canvas UI library the web editor's graph surface is built on. |
| web-ifc, DuckDB | The IFC parser underneath the loader, and the analytical engine on the far end. |

## What it could become

Three pieces are already positioned to split off. The engine group contains no BIM at all
and could stand alone as a specified dataflow engine, useful well outside construction. The
viewer workspace is similarly standalone and BIM-free. And because the spec is the authority, anything
that passes the conformance vectors is a valid engine — a TypeScript or Python runtime is a
port, not a rewrite.

Beyond that: more node packs, since the vocabulary is open — cost, schedule, energy,
embodied carbon. A hosted multi-user service over the analysis store. And pushing the agent
surface further. Today an agent builds a graph from a plain-language request; the next step
is agents that hold standing checks against a model as it changes and report what broke,
with the run record as proof.

---

See [README.md](../README.md) for build and run instructions,
[ARCHITECTURE.md](ARCHITECTURE.md) for the layer-by-layer design, and
[nodes.md](nodes.md) for the generated node reference.
