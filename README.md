# BIM Open Toolkit

The open implementation layer around [BIM Open Schema (BOS)](https://github.com/ara3d/bim-open-schema):
converters (IFC→BOS), query and analytics (DuckDB, GLB/glTF export), byte-exact
IFC property-set editing, MCP servers for AI-assisted BIM workflows, and the
PlatoFlow node-graph editor. The `bim-open-schema` repo remains the spec; this
repo is the reference implementation.

## Layout

| Where | What |
|---|---|
| `src/` | C# libraries: utilities, geometry, BOS, IFC loading/meshing/editing, MCP servers |
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

## Provenance

Projects were copied from `ara3d/ara3d-sdk` (each project README carries the
source path and commit SHA). Full history remains in the origin repos. See
[PLAN.md](PLAN.md) for the population plan and the open-core boundary.

License: MIT.
