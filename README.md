# BIM Open Toolkit

An open data layer for building information, and a node graph on top of it that people
and AI agents edit with the same operations. It is for developers and analysts who need
to get tables, 3D views, charts, and checks out of building models without writing
against a vendor's API.

Two things live here:

- **BIM Open Schema (BOS)** and its converters: a columnar, tool-independent
  representation of federated BIM data, plus IFC loading, meshing, and byte-exact
  IFC editing.
- **BimOpenFlow**: a specified dataflow graph, with an engine, a node vocabulary, a
  headless host, an MCP server, and a web editor, for building ETL pipelines, 3D
  views, charts, reports, and database queries out of that data.

## The problem it solves

BIM data is usually locked behind per-tool APIs, and the exchange formats that exist are
shaped for geometry interchange rather than analysis. Getting a column of numbers out of
a building model normally means writing against a proprietary API, in a proprietary
process, on a proprietary machine.

BOS stores the model as plain tables that load straight into DuckDB or Parquet tools.
BimOpenFlow turns questions about those tables into a graph of small pure functions:

```
  bos.load ──┬─► table.filter ──► table.aggregate ──┬─► chart.bar        (2D report)
             │                                      └─► sink.exportCsv  (ETL out)
             └─► view3d.instances ──► view3d.color ────► viewPane3D     (3D view)
```

ETL, 3D visualization, charts, SQL queries, and BIM queries are all the same kind of
graph, so they compose. The graph is a JSON document. Editing it means calling four
operations (`addNode`, `connect`, `setParam`, `removeNode`) that back the HTTP API, the
MCP tools, and every gesture in the editor. Nodes that write to disk run only inside an
explicit Run, so evaluating a graph for display never changes a file. Every run records
the graph hash and every input by content hash, so a number comes with a reproducible
derivation.

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains the layers, the node packs, and
the design in detail. [docs/OVERVIEW.md](docs/OVERVIEW.md) is the one-page version.

## What it does not do

- It does not author or edit geometry. IFC editing is limited to property sets, written
  back byte-exactly.
- It is not a Revit plugin and has no live connection to any authoring tool. Models
  arrive as IFC or BOS files.
- BOS is not built for ad-hoc queries on its own. The intended workflow is to load it
  into DuckDB and build wide views for the question at hand.
- The host is a single-user local process. There is no multi-user service, authentication,
  or hosted deployment.

## Prerequisites

- **.NET 8 SDK.** Twenty-one projects, including the host and the IFC stack, target
  `net8.0-windows`, so the full toolkit builds and runs on Windows only. The engine
  group and the schema libraries target plain `net8.0`.
- **Node.js 18 or newer** with npm, for the web editor, the 3D viewer, and the gates.
- **Git with submodules.** The editor canvas comes from the Gratify submodule.

## Build and run

```bash
git clone --recursive https://github.com/ara3d/bim-open-toolkit
```

```bash
dotnet build BimOpenToolkit.sln
```

Check the build by running the host smoke gate. It starts the host on a random port
with temporary directories, serves the node catalog, evaluates a graph, and records a run:

```bash
node gates/host-smoke.mjs
```

Run the headless host by hand, pointing it at a directory of models:

```bash
dotnet run --project src/BimOpenFlow.Host -- --port 5214 --models ./data
```

Run the web editor against it in a second terminal, then open http://127.0.0.1:5300:

```bash
npm install --prefix bimopenflow/web
```

```bash
npm run web --prefix bimopenflow/web
```

The C# tests need fixtures that are not committed. Run `./data/get-test-data.ps1` first,
which copies them from a sibling clone as described in [data/README.md](data/README.md).
The sample analyses in `samples/` run without fixtures.

## Demos

Two local demos show complete graphs end to end. Both need the private Snowdon sample
model, and each has its own setup guide:

- **3D demo.** Colors, sections, and explodes a building model from an editable graph.
  Setup and troubleshooting are in [BIMOPENFLOW.md](BIMOPENFLOW.md).
- **DuckDB demo.** Nine SQL-backed schedule, join, and aggregation graphs over a typed
  Snowdon database. See [docs/bim-flow-duckdb.md](docs/bim-flow-duckdb.md).
- **Ask box.** The DuckDB demo's Ask box has an agent build a new graph from a
  plain-language request through the MCP tools. It needs an OpenAI key. See
  [docs/bim-flow-mcp-demo.md](docs/bim-flow-mcp-demo.md).

## Maturity

This is pre-release software under active development, assessed on 2026-09-13. Working
and covered by tests:

- The engine passes every conformance vector in `spec/dataflow-graph/`, which is what
  makes it the canonical implementation of the spec.
- 41 NUnit test projects sit beside the 46 C# source projects. Twelve source projects
  have no test project of their own, mostly IO and loader layers exercised through
  their consumers.
- Two headless gates cover what unit tests cannot: a real host process over HTTP, and a
  full typecheck, test, and production build of every web and viewer package. See
  [gates/README.md](gates/README.md).
- Every sample analysis in `samples/` evaluates green over its sample data, enforced
  by a test.

Not yet covered: the publishing chain (dashboard, report, evidence package) has unit
tests but no end-to-end gate, and the demos depend on a private model that cannot be
redistributed. [docs/REPOSITORY-HANDOFF.md](docs/REPOSITORY-HANDOFF.md) is a fuller
assessment from 2026-09-08.

## Repository map

| Where | What |
|---|---|
| `spec/dataflow-graph/` | The normative graph specification and its conformance vectors |
| `contracts/` | Shared type definitions and the C#/TypeScript generator |
| `src/` | 46 C# projects: engine, BIM data layer, node packs, host, MCP servers |
| `tests/` | 41 NUnit test projects, including the spec conformance suite |
| `bimopenflow/web/` | The web editor workspace (npm workspaces) |
| `viewer/` | The standalone 3D viewer workspace, seventeen packages |
| `samples/` | Runnable sample analyses: tables, BIM, and 3D, with sample data |
| `gates/` | Headless integration smoke checks |
| `docs/` | Architecture, design decisions, demo guides, and the generated [node reference](docs/nodes.md) |
| `vendor/` | Vendored general-purpose Ara3D.SDK NuGet packages |
| `submodules/gratify` | The Gratify canvas UI library (git submodule) |
| `data/` | Test fixtures, not committed; populate with `./data/get-test-data.ps1` |

## Related projects

- [bim-open-schema](https://github.com/ara3d/bim-open-schema) is the schema's spec repo.
  This repository is its reference implementation.
- [ara3d-sdk](https://github.com/ara3d/ara3d-sdk) holds the general-purpose libraries
  (utilities, geometry, data tables, glTF export, the MCP protocol). They are consumed
  here as vendored NuGet packages, and only BIM-specific code lives in this repository.
- web-ifc parses IFC underneath the loader. DuckDB is the analytical engine on the far end.

## License

MIT.
