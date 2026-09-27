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

`export-duckdb` turns a prepared BOS cache into a queryable DuckDB file. It creates all 83 core tables with typed SQL columns. Known facts become scalar values; missing facts become SQL NULL. Companion `_assurance`, `_reason`, `_explanation`, and `_evidence` columns preserve provenance. Measurements use canonical units (metres, square metres, and so on); durations use INTERVAL. Composite records flatten into prefixed columns such as `element_name` and `element_object_id`. Keys are VARCHAR; collections use native DuckDB lists (and structs for composite list items). Link sets retain `_completeness` and `_evidence` columns. No columns store JSON. This replaces the previous 862-column JSON layout; regenerate existing databases to migrate.

```powershell
dotnet run --project tools/building-model-workflows -- export-duckdb `
  artifacts/building-model-workflows/cache/snowdon.bfast `
  artifacts/building-model-workflows/snowdon.duckdb
```

The `IBuildingProjectionWriter` interface is the export boundary. `DuckDbProjectionWriter` is one implementation; other stores can implement the same interface without changing BOS preparation or core-model mapping. Since wave R5 the mapping populates 48 of the 83 tables for Snowdon: model snapshots, source documents, revisions and objects, BIM objects and evidence, interpretation policies, projects, storeys, spaces, zones, walls, windows, doors, floors, ceilings, roofs, openings, facade panels, stairs, stair flights, landings, ramps, railings, furniture, structural members, foundations, structural connections, reinforcement groups, terrain surfaces, paved areas, landscape assets, duct and pipe segments and fittings, air terminals, sanitary fixtures, lighting fixtures, electrical devices, circuits, cable segments and containment, service systems and their memberships, materials, and product and assembly definitions. It creates every core table so consumers can depend on the complete schema as additional mapped concepts are added. The DuckDB demo (`docs/bim-flow-duckdb.md`) reads `artifacts/building-model-workflows/snowdon-cli.duckdb`, so write the demo's database to that path.

For example, query `SELECT element_name, nominal_width FROM door WHERE nominal_width > 0.8`. Exports without an established numeric storage policy retain unknown measurements as NULL; use `--revit-internal` only for source values known to use Revit internal units.

## Federation: `federate-union`

`federate-union <out-dir> (<file.ifc>... | --example)` converts one or more IFC files with
`Ara3D.BimOpenSchema.Federation`'s `BosUnion` — one file at a time, disposing each `IfcFile`
before the next — and unions the results into a single, geometry-free document. `--example`
skips the IFC files and unions `FederationExample`'s five built-in documents instead, so the
verb can be exercised without private data.

It writes three files to `<out-dir>`:

- `union.bos`, a geometry-free parquet zip of the union;
- `union.duckdb`, a raw DuckDB database loaded from the union's BOS tables (`EntityText`,
  `ParameterText`, `RelationText`, `StoreyOfEntity`, and so on);
- `union-summary.json`, `{ documents: DocumentSummary[], seconds: number, peakWorkingSetBytes: number }`,
  one `DocumentSummary` per input document with its entity count and the length unit declared
  on its `IFCPROJECT` entity (`Ifc:LengthUnit` / `Ifc:LengthUnitToMetre`; null when the source
  file declared none).

The same JSON is also printed to stdout, and the verb exits 0 on success.

```powershell
dotnet run --project tools/building-model-workflows -- federate-union artifacts/federate-example --example
dotnet run --project tools/building-model-workflows -- federate-union artifacts/federate-duplex data/duplex.ifc
```

This is a thin wrapper: matching documents across a union (storeys, grid axes, spaces to
rooms) is not this verb's job. It lives in a SQL match graph and the federated DuckDB views
built on top of `union.duckdb` (see `docs/plans/snowdon-federation-build.md`).
