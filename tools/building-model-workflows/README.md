# Building-model workflow runner

This runner prepares source BOS columns into BFAST once, projects architectural records, and runs the design-proving workflow suite. Open `BimBuildingModel.sln` to browse the source reader, domain mapping, calculations, persistence and tests in Visual Studio.

## Prepare and run the supplied corpus

From the repository root:

```powershell
dotnet build BimBuildingModel.sln
dotnet test tests/Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests/Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests.csproj --no-build
./tools/building-model-workflows/run-samples.ps1 -Prepare
```

The script uses exactly these files:

- `C:/data/nxt-bld/all-medium.bos`
- `C:/Users/cdigg/Documents/BIM Open Schema/Snowdon Towers Sample Architectural.bos`
- `C:/Users/cdigg/Documents/BIM Open Schema/BIM_Projekt_Golden_Nugget-Architektur_und_Ingenieurbau.bos`

Run the script again without `-Prepare` for repeated workflow tests. That path reads BFAST and never opens the original BOS or decodes Parquet. Source files are retained unchanged. Generated caches and results live under ignored `artifacts/building-model-workflows`; no sample contents are checked into Git.

Preparation stores decoded typed column buffers, including geometry, with source and column SHA256 hashes and available manifest metadata. Core queries skip geometry buffers. This is a source evidence cache, distinct from the existing render-only BFAST layout and the older serializer that omits geometry/manifest.

The script explicitly selects Revit internal numeric storage for Snowdon and Golden Nugget. Their cached source profiles contain Revit document/parameter evidence; the repository's `Ara3D.BimOpenSchema.Harmonizer/UnitConversion.cs` documents internal feet-based storage independent of display labels. This is a declared interpretation policy, retained in the projection. The IFC-derived stress file uses unknown storage policy until unit provenance is established. A descriptor's unit label alone does not authorize numeric conversion. No missing dimensional fact is replaced by zero.

## Outputs

Each sample directory contains:

| File | Meaning |
|---|---|
| `projection.json` | Versioned typed BuildingModel projection, with explicit fact tags, snapshot keys, source evidence and interpretation policies. The original source columns remain in BFAST. |
| `workflows.json`, individual CSVs | Schedules/takeoff contributions and workflow readiness. All ten workflow IDs are accounted for. |
| `coverage.json` | Per-field full denominators split into known, missing, invalid, conflicting and inapplicable observations. |
| `diagnostics.json` | Mapping and validation findings. |
| `source-inventory.json` | Source entity/document/property counts, categories and grouped source-decoding issues. Documents are not treated as buildings. |
| `metrics.json` | Load, mapping, opening plus first query, and process peak memory measurements. |
| `reopened/` | Fresh-process results from reopening the domain projection. The script checks byte-identical workflow, coverage and diagnostic output. |

`portfolio/` compares source-local coverage without summing unrelated/overlapping source scopes into purported physical building totals.

## Individual commands

```powershell
$cli = 'tools/building-model-workflows/BuildingModel.Workflows.Cli.csproj'
dotnet run --no-build --project $cli -- prepare 'input.bos' 'cache.bfast'
dotnet run --no-build --project $cli -- run 'cache.bfast' 'artifacts/my-workflows' --revit-internal
dotnet run --no-build --project $cli -- reopen 'artifacts/my-workflows/projection.json' 'artifacts/my-workflows/reopened'
dotnet run --no-build --project $cli -- compare 'before.json' 'after.json' 'artifacts/comparison'
dotnet run --no-build --project $cli -- calculate estimate 'estimate-request.json' 'artifacts/estimate-result.json'
```

Only use `--declared-units` when stored numeric values are known to use the descriptors' units. Omitting either numeric-policy option preserves unknown storage interpretation. Only supply `--complete-scope` to `compare` when both revisions cover the same complete comparison scope. Unrelated supplied files are not a revision pair.

`calculate` also accepts `reconcile`, `trace`, `coordinate`, `maintain` and `carbon`. Requests match the public typed request records in the Operations directory. `ProjectionStore.Options()` provides the JSON encoding: global keys are strings, snapshot keys are `{ "snapshot": "...", "local": "..." }`, and facts have an explicit `known` or `missing` state, evidence and assurance/reason. Calculations validate the supplied scope and return typed results; they never manufacture external records from architectural geometry.

The checked-in [estimate request](examples/estimate-request.json) is a synthetic runnable example: two units at CAD 100 with 10% waste must produce CAD 220. It is deliberately separate from all three BOS reports.

## What the workflow suite proves

Architectural mapping creates actual `Storey`, `Space`, `Door` and `Roof` records; it does not invent physical buildings from document names or finish faces from wall area. Revision comparison, quantity accounting, estimates, receipt reconciliation, network traversal, spatial candidates, maintenance and material carbon have reusable C# APIs and independent NUnit fixtures.

The six operations workflows require explicit supplemental records. Architectural source files alone do not establish rates, delivery events, service topology, maintenance history or environmental factors. Their real-file reports therefore state required inputs rather than passing controlled-fixture data off as building observations. See the public request/result records in `src/Ara3D.BimOpenSchema.BuildingModel.Workflows/Operations` and their examples in the corresponding test directory.

Fixture correctness, actual source mapping, and corpus performance are separate results. BFAST avoids repeated Parquet preparation; it does not make the existing generic DataModel loader allocation-free. Report measured memory/opening results before claiming the ten-second/16 GiB target. The initial domain projection is JSON, selected for an inspectable round-trip contract; its scalability is measured rather than assumed.
