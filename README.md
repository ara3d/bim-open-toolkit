# BIM Open Toolkit

The open implementation layer around [BIM Open Schema (BOS)](https://github.com/ara3d/bim-open-schema):
converters (IFC→BOS), query and analytics (DuckDB, GLB/glTF export), byte-exact
IFC property-set editing, MCP servers for AI-assisted BIM workflows, and the
PlatoFlow node-graph editor. The `bim-open-schema` repo remains the spec; this
repo is the reference implementation.

## Layout

| Where | What |
|---|---|
| `src/` | C# libraries: BOS, IFC loading/meshing/editing, the IFC MCP server |
| `vendor/` | Local copies of the general-purpose Ara3D.SDK NuGet packages (see `vendor/README.md`) |
| `tests/` | NUnit test suites |
| `data/` | Test fixtures — **not committed**; populate with `./data/get-test-data.ps1` |
| `platoflow/` | PlatoFlow node-graph editor (PoC reference + design docs for the rewrite) |
| `submodules/gratify` | The gratify UI library (git submodule) |

## Build

```bash
git clone --recursive https://github.com/ara3d/bim-open-toolkit
dotnet build BimOpenToolkit.sln
```

Tests need fixtures: run `./data/get-test-data.ps1` first (copies the IFC Test Kit
from a sibling `nrc-ifc-llm` clone).

PlatoFlow web: `cd platoflow/web && npm install && npm run dev`.

## Provenance and boundary

Only BIM/IFC-specific code lives here; general-purpose libraries (utilities,
geometry, data tables, glTF export, the MCP protocol) remain in
[ara3d-sdk](https://github.com/ara3d/ara3d-sdk) and are consumed as NuGet
packages vendored under `vendor/`. Projects here were copied from
`ara3d/ara3d-sdk` (each project README carries the source path and commit SHA);
full history remains in the origin repos. See [PLAN.md](PLAN.md) for the
population plan and the open-core boundary.

License: MIT.
