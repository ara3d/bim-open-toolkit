# BimOpenFlow — proposed project structure

> Proposal (Claude + Christopher Diggins, 2026-08-30). The from-scratch
> replacement for the PlatoFlow PoC (`platoflow/` remains reference material
> until deleted). Product name **BimOpenFlow** is provisional; every other name
> below is intended as final unless noted. Design inputs:
> `platoflow/docs/platoflow-design-principles.md` (P0 agent velocity, P1 one
> headless core) and `platoflow-graph-semantics.md` (analysis / graph / run
> vocabulary).

## Layering rules

1. Dependencies point downward only: spec ← engine ← node packs ← app.
   No BIM reference in or below `Ara3D.DataFlowEngine`; no pack-to-pack
   references between node packs.
2. The spec is the authority. The C# engine is the *canonical implementation*,
   proven by the conformance suite; any other implementation (e.g. a future TS
   preview evaluator) passes the same vectors or is wrong.
3. Shared types are generated from one source (`contracts/`), never hand-copied
   into TS and C#.
4. General-purpose projects (engine group, viewer) take only vendored SDK
   packages as dependencies and are candidates to graduate to `ara3d-sdk` /
   their own repos once stable. BIM-specific projects stay here permanently.

---

## Specification and contracts

### DataFlow Graph Specification
**Location:** `spec/dataflow-graph/`
The normative definition, partitioned into four separately versioned documents
so spec+implementation pairs can evolve in parallel: `format.md` (the graph
document: structure + values layers), `semantics.md` (evaluation: dirtiness,
memoization, standing evaluation), `expressions.md` (the expression language),
and `runs.md` (the run record). Each part owns its JSON Schemas and its
directory of conformance vectors (input graph + inputs → expected outputs),
consumed by the conformance test project. No code and no dependencies;
versioned with explicit migration notes.
**Depends on:** nothing.

### Contracts
**Location:** `contracts/`
Single source of truth for app-level shared types: host HTTP API, pane
contract, node-catalog descriptors, and shared enums (the parameter-type enum
that fix-on-entry item 1 found hand-copied three times). JSON Schema / IDL
sources with a small codegen step emitting C# into the host and TypeScript into
`web/packages/api-client`.
**Depends on:** DataFlow Graph Specification (references its schemas).

---

## Engine group (C#, BIM-free)

### Ara3D.DataFlowEngine.Abstractions
**Location:** `src/Ara3D.DataFlowEngine.Abstractions/`
The node SDK: node and port interfaces, the value/table types that flow along
edges, capability declarations (pure vs. effectful, Run-gated), and the node
registry. Deliberately tiny and stable — it is the contract every node pack
compiles against, so churn here is churn everywhere.
**Depends on:** Ara3D.Utils, Ara3D.Collections, Ara3D.DataTable (vendored SDK).

### Ara3D.NodeGraph
**Location:** `src/Ara3D.NodeGraph/`
The graph *document* object model and the NodeGraph API: load/save/validate
per the spec, plus transactional editing operations (add/remove/connect,
undo/redo, structural validation against a node catalog). Knows nothing about
evaluation — it is what editors, agents, and the MCP surface manipulate.
**Depends on:** Ara3D.DataFlowEngine.Abstractions; Ara3D.Utils (vendored SDK).

### Ara3D.DataFlowEngine
**Location:** `src/Ara3D.DataFlowEngine/`
The canonical evaluator: dependency scheduling, memoization, dirty propagation,
and standing evaluation sessions that observers (panes, sinks) subscribe to.
Executes any registered node vocabulary over a NodeGraph document; contains no
I/O and no BIM.
**Depends on:** Ara3D.DataFlowEngine.Abstractions, Ara3D.NodeGraph;
Ara3D.DataTable (vendored SDK).

### Ara3D.DataFlowEngine.Expressions
**Location:** `src/Ara3D.DataFlowEngine.Expressions/`
The expression language used by derive/filter/what-if nodes: parser, type
checker, and evaluator over the table/value types. Pure and dependency-light
with a large test surface — ideal for an agent to own end-to-end.
**Depends on:** Ara3D.DataFlowEngine.Abstractions.

### Ara3D.DataFlowEngine.Runs
**Location:** `src/Ara3D.DataFlowEngine.Runs/`
The definition-vs-run split made concrete: freezing an evaluation into a run
record (graph hash + input hashes + outputs + timestamp), replay, and signing.
Runs are the only artifact archived or submitted as evidence, and the input to
both generators below.
**Depends on:** Ara3D.DataFlowEngine, Ara3D.NodeGraph.

### Ara3D.NodeGraph.Migrations
**Location:** `src/Ara3D.NodeGraph.Migrations/`
Version-to-version graph document upgrades, driven by the spec's migration
notes. Kept out of `Ara3D.NodeGraph` so handling old formats never complicates
the current document model, and so migration work can proceed in its own fence.
**Depends on:** Ara3D.NodeGraph.

### Ara3D.DataFlowEngine.TestKit
**Location:** `src/Ara3D.DataFlowEngine.TestKit/`
Test infrastructure for everyone building on the engine: fluent graph
builders, fake/probe nodes, and evaluation assertions. This is what makes
every other agent's tests cheap to write, and what third-party node-pack
authors test against; shipped as a real package, not test-project internals.
**Depends on:** Ara3D.DataFlowEngine, Ara3D.NodeGraph.

---

## BIM data layer (C#)

### Ara3D.BimOpenSchema.DuckDb
**Location:** `src/Ara3D.BimOpenSchema.DuckDb/`
The DuckDB view/query layer over BOS (`CreateViews`: EntityText, ParameterText,
RelationText — today buried in the PoC's MCP project; fix-on-entry item 2).
A dedicated project so the DuckDB native dependency is isolated here instead of
riding along with `Ara3D.BimOpenSchema.IO` into every consumer.
**Depends on:** Ara3D.BimOpenSchema, Ara3D.BimOpenSchema.IO; DuckDB.NET.

---

## BIM node packs (C#)

### BimOpenFlow.Nodes.Bos
**Location:** `src/BimOpenFlow.Nodes.Bos/`
Source and query nodes over BIM Open Schema: model/parameter sources,
select/derive/aggregate via DuckDB, and unit-aware columns via the Harmonizer.
The workhorse vocabulary for takeoffs, audits, and analytics.
**Depends on:** Ara3D.DataFlowEngine.Abstractions,
Ara3D.DataFlowEngine.Expressions; Ara3D.BimOpenSchema,
Ara3D.BimOpenSchema.DuckDb, Ara3D.BimOpenSchema.Harmonizer.

### BimOpenFlow.Nodes.Geometry
**Location:** `src/BimOpenFlow.Nodes.Geometry/`
Nodes that produce or transform 3D content for the viewer: mesh extraction,
coloring, isolation/explosion, massing, camera/view tables. The only pack that
touches meshing, keeping the geometry dependency (and its windows/x64 native
constraint) out of everything else.
**Depends on:** Ara3D.DataFlowEngine.Abstractions; Ara3D.Ifc.Mesher,
Ara3D.IfcLoader; Ara3D.Geometry, Ara3D.Models (vendored SDK).

### BimOpenFlow.Nodes.Compliance
**Location:** `src/BimOpenFlow.Nodes.Compliance/`
Verdict nodes: rule checks, pass/fail/needs-review rollups, and the check
metadata the compliance track hands to officials. Kept separate so the
evidence-bearing vocabulary has a small, auditable surface.
**Depends on:** Ara3D.DataFlowEngine.Abstractions,
Ara3D.DataFlowEngine.Expressions.

### BimOpenFlow.Nodes.Effects
**Location:** `src/BimOpenFlow.Nodes.Effects/`
All Run-gated sinks in one place: byte-exact pset write-back (via
Ara3D.Ifc.Editing), file exports (GLB, CSV, BOS), and report/dashboard
emission triggers. Isolating effects makes the purity rule enforceable by
project reference alone.
**Depends on:** Ara3D.DataFlowEngine.Abstractions, Ara3D.DataFlowEngine.Runs;
Ara3D.Ifc.Editing; Ara3D.IO.GltfExporter (vendored SDK).

---

## Application (C#)

The host is split four ways up front — it is the likeliest fence-contention
hotspot, and these seams let four agents work it concurrently.

### BimOpenFlow.Host.Catalog
**Location:** `src/BimOpenFlow.Host.Catalog/`
Model discovery and the conversion pipeline: watching/registering model files,
IFC → BOS conversion with caching, and model metadata. Owns all knowledge of
where models live and how they become BOS.
**Depends on:** Ara3D.IfcLoader, Ara3D.BimOpenSchema.IO;
Ara3D.Utils (vendored SDK).

### BimOpenFlow.Host.Store
**Location:** `src/BimOpenFlow.Host.Store/`
Persistence for graph documents and run records: the analysis library on disk,
versioned saves, and run archival. No HTTP and no evaluation — storage
semantics only.
**Depends on:** Ara3D.NodeGraph, Ara3D.DataFlowEngine.Runs.

### BimOpenFlow.Host.Api
**Location:** `src/BimOpenFlow.Host.Api/`
The HTTP surface, generated-contract-first: endpoint handlers, the
standing-evaluation subscription channel, and request/response mapping. Holds
no business logic — every handler delegates to Catalog, Store, or the engine.
**Depends on:** contracts (generated C#); BimOpenFlow.Host.Catalog,
BimOpenFlow.Host.Store; Ara3D.DataFlowEngine.

### BimOpenFlow.Host
**Location:** `src/BimOpenFlow.Host/`
The composition root and deployable: wires Catalog, Store, Api, the engine,
and the node packs together into the headless host process. This is P1's "one
headless core" as an executable — the web app is strictly a client of it.
Deliberately thin; if logic accumulates here, it belongs in one of the three
modules above.
**Depends on:** BimOpenFlow.Host.Api, BimOpenFlow.Host.Catalog,
BimOpenFlow.Host.Store; Ara3D.DataFlowEngine (+ Runs, Expressions); all four
node packs.

### BimOpenFlow.Mcp
**Location:** `src/BimOpenFlow.Mcp/`
The agent surface: an MCP server exposing graph authoring (via the NodeGraph
API), evaluation, and run retrieval. A thin adapter over the host — it holds
no logic of its own, so agents and humans manipulate graphs through the same
operations.
**Depends on:** Ara3D.MCP (vendored SDK); Ara3D.NodeGraph; BimOpenFlow.Host
(or its API client).

### BimOpenFlow.Publishing
**Location:** `src/BimOpenFlow.Publishing/`
The shared document-emission layer under both generators: HTML templating,
asset embedding (the `viz` bundle, fonts, images as data URIs), theming, and
self-contained-file assembly. Exists so Dashboards and Reports stay thin and
visually consistent instead of growing two copies of the same plumbing.
**Depends on:** Ara3D.DataTable (vendored SDK); contracts; the `viz` JS bundle
(build artifact, not a project reference).

### BimOpenFlow.Dashboards
**Location:** `src/BimOpenFlow.Dashboards/`
The dashboard generator: turns a graph's output tables and views into a
self-contained interactive HTML dashboard (charts, tables, embedded 3D
snapshots) by binding run/session data to the `viz` components via Publishing.
Live dashboards observe a running host; exported ones embed frozen run data.
**Depends on:** BimOpenFlow.Publishing; Ara3D.DataFlowEngine.Runs.

### BimOpenFlow.Reports
**Location:** `src/BimOpenFlow.Reports/`
The report generator: renders a run record into a static, archivable document
(HTML, printable to PDF) — the audit deliverable with verdicts, provenance
hashes, and evidence tables. Static by construction: a report never requires a
running host to read.
**Depends on:** BimOpenFlow.Publishing; Ara3D.DataFlowEngine.Runs.

### BimOpenFlow.Evidence
**Location:** `src/BimOpenFlow.Evidence/`
The compliance hand-off package (the semantics doc's open question 4 made
concrete): one archive holding the graph, pinned input snapshots or content
hashes, the run record, and the rendered report — the thing actually given to
an official. Separate from Reports because the archive format carries its own
versioning and signing rules; it is a legal artifact, not a rendering concern.
**Depends on:** Ara3D.DataFlowEngine.Runs, Ara3D.NodeGraph;
BimOpenFlow.Reports.

---

## Web (TypeScript, `bimopenflow/web/` npm workspace)

### @bimopenflow/app
**Location:** `bimopenflow/web/packages/app/`
The editor application shell: canvas editing on gratify, node catalog browsing,
pane docking, and session/run controls. Owns the `layout` and `session` layers
of a graph file; never evaluates anything itself.
**Depends on:** gratify (submodule); @bimopenflow/state, @bimopenflow/panes,
@bimopenflow/api-client.

### @bimopenflow/state
**Location:** `bimopenflow/web/packages/state/`
The client-side store and reducer: graph document mirror, selection, undo
integration with the NodeGraph API, and subscription plumbing for evaluation
updates. UI-framework-free so it is testable headless with vitest.
**Depends on:** @bimopenflow/api-client.

### @bimopenflow/panes
**Location:** `bimopenflow/web/packages/panes/`
The pane implementations — table, chart, 3D view, inspector, verdict list —
each an isolated module behind the single pane contract (data in, events out).
The most naturally parallel surface in the system: one agent per pane, zero
overlap.
**Depends on:** @bimopenflow/viz, @ara3d/viewer-core/-loaders/-controls (3D
pane only), contracts (generated TS).

### @bimopenflow/viz
**Location:** `bimopenflow/web/packages/viz/`
Chart and table rendering components shared by the editor panes and the
dashboard generator, bundled as a self-contained artifact the C# generators can
embed. Keeping it separate is what lets dashboards look identical to the live
app.
**Depends on:** contracts (generated TS). No app/state dependency.

### @bimopenflow/api-client
**Location:** `bimopenflow/web/packages/api-client/`
The typed client for the host HTTP API, generated from `contracts/` — never
hand-edited. Includes the subscription client for standing-evaluation updates.
**Depends on:** contracts (generated TS).

---

## Viewer (TypeScript, general-purpose, `viewer/` npm workspace)

The new WebGL viewer replacing `@ara3d/ara3d-webgl`, designed against the §5
item 7 lessons: `three` as a peer dependency, float numeric parameters,
per-instance color API, and loader progress reporting. BIM-free, split into
three packages with clean interfaces so agents can work them concurrently;
the workspace is a candidate to move to its own repo once stable.

### @ara3d/viewer-core
**Location:** `viewer/packages/core/`
The renderer: scene management, instanced drawing, materials, per-instance
color, and the frame loop. No file formats and no input handling — it draws
what it is handed.
**Depends on:** three (peer).

### @ara3d/viewer-loaders
**Location:** `viewer/packages/loaders/`
Ingestion: BOS geometry and GLB loading into viewer-core's scene structures,
with incremental/progress reporting as a first-class API. All format knowledge
lives here.
**Depends on:** @ara3d/viewer-core; three (peer).

### @ara3d/viewer-controls
**Location:** `viewer/packages/controls/`
Interaction: camera models and navigation, picking/selection, and section
planes / overlay hooks (overlay may split out later if it grows). Emits
selection events; owns no scene content.
**Depends on:** @ara3d/viewer-core; three (peer).

---

## Tests and gates

### Ara3D.DataFlowEngine.Conformance
**Location:** `tests/Ara3D.DataFlowEngine.Conformance/`
Runs every vector in `spec/dataflow-graph/conformance/` against the canonical
engine. This suite is the definition of "canonical" — it gates all engine
changes and doubles as the acceptance test for any future second
implementation.
**Depends on:** Ara3D.DataFlowEngine (+ Runs), Ara3D.NodeGraph; the spec
vectors as content.

### Unit test projects
**Location:** `tests/<ProjectName>.Tests/` (one per C# project above);
`vitest` co-located per web package.
Standard per-project suites; each lives inside its project's fence so parallel
agents gate their own work without touching a shared suite.
**Depends on:** their subject project only.

### Headless gates
**Location:** `gates/`
End-to-end smoke scripts (host up, convert, evaluate, dashboard/report
emission, editor smoke via headless browser) — the supervisor-run integration
gate, successor to the PoC's `tools/*.mjs`.
**Depends on:** BimOpenFlow.Host, @bimopenflow/app (running builds).

---

## Dependency sketch

```mermaid
graph BT
  spec[spec/dataflow-graph]
  contracts[contracts/]
  ABS[Ara3D.DataFlowEngine.Abstractions]
  NG[Ara3D.NodeGraph]
  ENG[Ara3D.DataFlowEngine]
  EXP[.Expressions]
  RUNS[.Runs]
  TK[.TestKit]
  MIG[NodeGraph.Migrations]
  DUCK[Ara3D.BimOpenSchema.DuckDb]
  BOS[Nodes.Bos]
  GEO[Nodes.Geometry]
  CMP[Nodes.Compliance]
  EFF[Nodes.Effects]
  HOST["BimOpenFlow.Host (root + Api/Catalog/Store)"]
  MCP[BimOpenFlow.Mcp]
  PUB[BimOpenFlow.Publishing]
  DASH[BimOpenFlow.Dashboards]
  REP[BimOpenFlow.Reports]
  EVID[BimOpenFlow.Evidence]
  VIEW["@ara3d/viewer-* (core, loaders, controls)"]
  WEB["@bimopenflow/* (app, state, panes, viz, api-client)"]

  NG --> ABS
  ENG --> ABS
  ENG --> NG
  EXP --> ABS
  RUNS --> ENG
  TK --> ENG
  MIG --> NG
  BOS --> ABS
  BOS --> EXP
  BOS --> DUCK
  GEO --> ABS
  CMP --> ABS
  CMP --> EXP
  EFF --> ABS
  EFF --> RUNS
  HOST --> ENG
  HOST --> RUNS
  HOST --> BOS
  HOST --> GEO
  HOST --> CMP
  HOST --> EFF
  MCP --> NG
  MCP --> HOST
  PUB --> RUNS
  DASH --> PUB
  REP --> PUB
  EVID --> REP
  EVID --> RUNS
  WEB --> VIEW
  NG -. implements .-> spec
  ENG -. implements .-> spec
  HOST -. serves .-> contracts
  WEB -. generated from .-> contracts
```

## Build-order / wave implications

Wave 0 (serial, supervisor): spec first drafts + contracts + Abstractions —
the frozen surfaces everything fans out from. Wave 1 (parallel): NodeGraph,
Expressions, DuckDb layer, viewer-core, viz — no mutual dependencies. Wave 2:
engine + conformance + TestKit, then Runs; viewer-loaders/-controls alongside.
Wave 3 (parallel): the four node packs, Migrations, api-client, state. Wave 4:
Host.Catalog/Store/Api in parallel, then the Host root; panes and app
alongside. Wave 5 (parallel): Mcp, Publishing → Dashboards/Reports, Evidence,
gates.

## Deferred breakdowns

Real seams, deliberately not split yet — the trigger to revisit any of them is
fence contention: two agents in a wave repeatedly requesting changes to the
same file.

- **Expression internals** (parser / type checker / evaluator) — folders inside
  `Ara3D.DataFlowEngine.Expressions`, not projects.
- **Per-chart-type viz packages** — one `@bimopenflow/viz` package with fenced
  folders per widget is enough until something external consumes a single chart.
- **Engine internals** (scheduler vs. memoization/cache) — splitting these
  would freeze a contract exactly where refactoring freedom matters most.
- **Viewer overlay/annotation** — starts inside `@ara3d/viewer-controls`;
  splits out if section planes / annotations grow their own audience.
- **Docking/layout manager in the web app** — a genuine module, but its right
  home is gratify; move it upstream when it stabilizes rather than splitting it
  here.
- **Run signing/attestation crypto** — inside `Ara3D.DataFlowEngine.Runs`
  until a second consumer (Evidence hardening, external verification tool)
  appears.
