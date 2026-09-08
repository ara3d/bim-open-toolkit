# Core BIM workflow runner

This runner prepares source BOS columns into BFAST, maps the core architectural slice, persists the typed projection, and runs source-backed reports.

```powershell
dotnet build BimBuildingModel.sln --no-restore
dotnet test tests/Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests/Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests.csproj --no-build --no-restore
./tools/building-model-workflows/run-samples.ps1 -Prepare
```

`run-samples.ps1` uses the three local samples named in the script. Subsequent runs omit `-Prepare` and read the BFAST caches. Source files are unchanged.

Each result directory contains `projection.json`, `workflows.json`, schedule/takeoff CSVs, coverage, diagnostics, a source inventory, metrics, and a fresh-process `reopened` result. The runner verifies byte-identical workflow, coverage and diagnostic output after reopening.

Supported reports are room/door/storey schedules, roof/finish quantity readiness, revision comparison, and source-local portfolio coverage. The core runner has no calculate command for pricing, procurement, maintenance, carbon, egress, acoustic or other derived operational results.

## DuckDB export

`export-duckdb` turns a prepared BOS cache into a queryable DuckDB file. It creates the canonical core schema: 83 tables and 862 direct columns. Fields that are relationships, facts, or value objects are represented as JSON so the relational contract remains aligned with the core model while preserving source evidence.

```powershell
dotnet run --project tools/building-model-workflows -- export-duckdb `
  artifacts/building-model-workflows/cache/snowdon.bfast `
  artifacts/building-model-workflows/snowdon.duckdb
```

The `IBuildingProjectionWriter` interface is the export boundary. `DuckDbProjectionWriter` is one implementation; other stores can implement the same interface without changing BOS preparation or core-model mapping. The current mapping populates model snapshots, source revisions and objects, BIM objects and evidence, storeys, spaces, doors, roofs, finishes, source documents, and interpretation policies. It creates every core table so consumers can depend on the complete schema as additional mapped concepts are added.
