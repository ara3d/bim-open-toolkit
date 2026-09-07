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
