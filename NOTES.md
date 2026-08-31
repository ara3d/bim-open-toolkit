# Notes — findings that must feed back into the design

Agents: append findings here (contract friction, surprises, perf numbers).

## Contract changes
(record any edits to supervisor-owned files here)

## Findings

### Track A (tiers 0-1)
- PLAN.md §1 is wrong that Plato.Generated/Plato.Intrinsics are "not referenced by anything moving": Ara3D.Geometry imports both as shared-source projects (.projitems), and PropKit/DataTable/Models depend on Geometry. Supervisor vendored both into src/ (compile-into-consumer only, no extra assemblies).
- The 11 tier 0-1 projects have zero PackageReferences — no central-version gaps.

### Track B (tier 2)
- Ara3D.Ifc.Editing needed eight files, not six: IfcGuid.cs and IfcStepText.cs are required helpers. Namespace kept as Ara3D.Ifc.Tests (rename is a follow-up). net8.0-windows/x64, forced by Ara3D.IfcLoader's native web-ifc dll (fix-on-entry item 6 would relax this).
- web-ifc-library.dll (native) now lives inside src/Ara3D.IfcLoader (was in sdk vendor/); consider LFS or a nuget-packaged native asset later.
- Microsoft.Data.Sqlite was hardcoded in origin; now centralized as Ara3DMicrosoftDataSqliteVersion.
- Ara3D.Ifc.Mesher carries PROGRESS.md + 17 WIP progress-notes docs — pruning candidates.

### Track D (PlatoFlow)
- Acceptance met from this repo + submodule alone: npm install/build/check clean; vitest 997/997; intgate-smoke 13/13 with host converting repo data/duplex.ifc.
- edgate-smoke "picker opens over clicked row" fails identically in the origin repo — pre-existing upstream defect, not a copy regression.
- Host still source-links src/Ara3D.Ifc.Mcp/IfcDuck.cs — repoint when fix-on-entry item 2 moves CreateViews into BimOpenSchema.IO.
- Default demo model is now duplex.ifc; Snowdon/rac_basic models load via PLATOFLOW_EXTRA_DATA env var (not shipped).

### Supervisor / SDK-boundary restructure (2026-08-30, evening)
- Reversed the tier 0-1 vendoring per user direction: general-purpose SDK projects (Utils, Memory, Collections, Logging, F8, PropKit, Geometry, DataTable, Models, IO.BFAST, IO.StepParser, IO.GltfExporter, IO.SharpGLTF, Ara3D.MCP, Plato.*) removed from src/ and consumed as NuGet packages from a local vendor/ feed (nuget.config), packed from ara3d-sdk @ 82df7322.
- Vendored packs are versioned 1.6.2-local, NOT 1.6.1: nuget.org's 1.6.1 has older content (no SimpleHttpServer in Utils) and the global package cache resolves by id/version, so a same-version vendor pack silently loses. Never vendor a version nuget.org also serves.
- tests/Ara3D.MCP.Tests removed (its subject stays in the SDK). Test count 175 -> 126, all green. Full sln builds 0 errors.
- Earlier wave close-out claimed "BimOpenToolkit.sln builds 0 errors" but the committed sln was EMPTY - the shproj crash during `dotnet sln add` rolled back the whole batch, and building/testing an empty sln trivially succeeds. The per-project test runs were the real gate. Sln now actually contains the 13 projects; lesson: verify sln contents, not just exit codes.

### Supervisor / wave close-out (2026-08-30)
- Full gate green: BimOpenToolkit.sln builds with 0 errors; 175/175 tests pass across 6 suites; platoflow web builds and its gates pass.
- .shproj shared projects (IfcTypes, Plato.*) are not in the .sln (dotnet CLI can't add them); they compile into consumers via .projitems, so builds are unaffected. Add via VS if IDE browsing is wanted.
- Test data is never committed; data/get-test-data.ps1 copies the IFC Test Kit from ../nrc-ifc-llm and sample models from ../studio/ara3d-sdk/data.
- Postponed per user: Revit exporter (tier 6), Phases 5/7, most §5 fix-on-entry items (1, 2, 4-8).

### Track C (tiers 3-4)
- BLOCKER: tests/Ara3D.BimOpenSchema.Tests references `..\..\src\Ara3D.IO.SharpGLTF\Ara3D.IO.SharpGLTF.csproj` (used by GltfMaterialFactory.cs / GltfDemo.cs). Ara3D.IO.SharpGLTF is not in any track's fence and is missing from src/ — build fails with CS0246 until it is copied (source: ara3d-sdk/src/Ara3D.IO.SharpGLTF).
- data/get-test-data.ps1 clobbers data/README.md: `Copy-Item IFC-Test-Kit\* data\` overwrites the repo's data/README.md with the test kit's README. Restored via git checkout; script should exclude README.md.
- get-test-data.ps1 fetches only the IFC Test Kit. Harmonizer/Mcp/BimOpenSchema tests additionally need (from ara3d-sdk/data): AC20-FZK-Haus.ifc, AC20-Institute-Var-2.ifc, model_0.ifc, schependomlaan.ifc, rac_basic_sample_project-2025.bos. Copied locally (gitignored) to verify; script should be extended.
- Ara3D.Ifc.Editing shipped IfcStepText.cs and IfcGuid.cs in addition to the six promoted files; deleted the test-side copies/links to avoid CS0436 duplicates.
