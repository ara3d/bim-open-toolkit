# IFC mesher layout: finish the move from Ara 3D Studio

Started 2026-10-11. The pure-C# IFC mesher (`Ara3D.Ifc.Mesher`, in `deps/bim-open-data`) was copied out of the studio repository's `ara3d-sdk/wip/Ara3D.Ifc.Mesher` on 2026-08-30 and has been edited in bim-open-data since (Earcut, dropped-face diagnostics). The copy kept the shape of the experiment it came from: an `Approach1` namespace with no other approach, a 1,131-line `Brep.cs`, session logs under `src/`, a test project that mixes unit tests with a web-ifc comparison harness, and a Windows-only target it does not need. This plan brings it in line with the layout the rest of bim-open-data follows and removes what is left of the old project in the studio.

Owner's instruction (2026-10-11): make every improvement; remove all remnants of the old project; treat the old tickets and progress notes as theories from development, not as facts.

Workflows served (PROJECT.md): 2, through the IFC MCP server's `ifc_mesh`, `ifc_bounds`, `ifc_volume` and `ifc_meshing_diagnostics` tools, which measure this mesher's output; and 3, through `BimOpenFlow.Nodes.Geometry`, which meshes the model the 3D pane draws. Neither Done line moves directly. What moves is the ability to improve the mesher: a committed, dated measurement to judge changes by (principle 4, runs are the evidence), and files small enough for several agents to work on at once (platonic principle 3).

Paths are relative to `deps/bim-open-data` unless they start with `deps/`, `tickets/`, `docs/`, or `studio/`.

## Acceptance criteria

- No `Approach1` remains in bim-open-data, in the toolkit's live documents, open tickets, and code, or in the studio's live documents and open tracker items. Dated build logs under `docs/plans/`, done tickets, and closed tracker records keep the word as history.
- `Ara3D.Ifc.Mesher` targets `net8.0`, references no project that loads native code, and builds on its own.
- No source file in the mesher is over 400 lines; `Brep.cs` and `CurveEvaluator.cs` are split by subject.
- `src/data/Ara3D.Ifc.Mesher` holds no `PROGRESS.md` or `progress-notes/`; its README says what the library does, how it is laid out, and how it is measured, and names no path that does not exist.
- `tests/data/Ara3D.Ifc.Mesher.Tests` holds the tests that need no model files and runs in the default gate; `tests/data/Ara3D.IfcMeshingComparison` holds the comparison against web-ifc; no test file is named after a work package.
- `bench/ifc-mesher/RESULTS.md` and `scorecard.json` are committed from a run made during this work, dated, with one row per model file.
- The toolkit pins the resulting bim-open-data commit, `BimOpenFlow.Nodes.Geometry` builds, TKT-65, TKT-188, TKT-189 and TKT-190 name the mesher by its new name and fence the right paths, and `docs/ARCHITECTURE.md` no longer says the mesher holds the native geometry dependency.
- In the studio: `ara3d-030` is closed with a pointer here, `docs/ifc-mesher-transform-mesh-diagnosis-plan.md` and the three archived mesher documents are gone, the root `IfcGeometryPipeline.cs` scaffold is gone, and the `ara3d-sdk` submodule points at a commit without `wip/Ara3D.Ifc.Mesher` if the studio still builds there.

Out of scope: any change to what the mesher produces. Every chunk here is a refactor or a layout change, checked by the existing tests giving the same results before and after. TKT-188 (roof clipping), TKT-190 (curve density), and whatever the fresh scorecard shows are the mesher's behaviour, and stay tickets.

## Design

**Name.** The namespace is `Ara3D.Ifc.Mesher`, flat. The entry point is a static class, `IfcMesher`, because behaviour lives in static methods here (csharp-style) and the one interface, `IIfcMesher`, had one implementation; the two-implementation seam that does exist, this mesher against web-ifc, is the comparison project's `IMeshingBackend`, which stays.

```csharp
namespace Ara3D.Ifc.Mesher;

public static class IfcMesher
{
    public const string Name = "Ara3D.Ifc.Mesher";
    public static IfcMeshingResult Build(IfcEntityResolver resolver);
    public static IfcMeshingResult Build(StepDocument document);
    public static IfcMeshingResult Build(FilePath ifcPath);
}
```

A caller holding an `IfcFile` passes `file.EntityResolver`. `IfcMeshingResult.MesherName` becomes `IfcMesher.Name`; the MCP server's `ifc_meshing_diagnostics` reports it, so its test changes with it.

**Portable.** The mesher reads STEP through `Ara3D.IO.StepParser` and the entity model (`IfcEntity`, `IfcEntityResolver`, the generated `Ara3D.IfcTypes`). Those live in `Ara3D.IfcLoader`, which is `net8.0-windows` because `IfcFile` wraps the web-ifc DLL. A new project, `src/data/Ara3D.Ifc.Entities` (`net8.0`), takes the entity model and the schema detection (`IfcFile.SchemaOf` moves there; `IfcFile.SchemaOf` stays as a forwarder). `Ara3D.IfcLoader` references it, so every current consumer compiles unchanged. The moved types keep the `Ara3D.IfcLoader` namespace: renaming it would touch ten projects and two repositories for no change in behaviour (extension point below). The mesher then references `Ara3D.Ifc.Entities` and targets `net8.0`.

**Files.** `Brep.cs` splits into `Brep.cs` (the public builders), `FaceSetBuilder.cs` (face triangulation and welding), `FaceBounds.cs` (loops and edges to 3D rings), `SurfaceMap.cs` (the planar map and the face-plane arithmetic), `CylinderMap.cs`, `RevolutionMap.cs`, and `BSplineSurfaceMap.cs`. `CurveEvaluator.cs` splits into `CurveEvaluator.cs` (dispatch and ring cleaning), `PolyCurves.cs`, `Conics.cs`, `TrimmedCurves.cs`, `CompositeCurves.cs`, and `BSplineCurves.cs`. `GeometryCreationBacklog` becomes `GeometryCoverage`: it is the table of which IFC geometry entities the mesher handles, read by the coverage gate and the capability report, not a backlog.

**Tests.** `tests/data/Ara3D.Ifc.Mesher.Tests` takes every test that builds its input from a micro IFC string (`MicroIfc`) and needs no file, with `MicroIfc`, `MeshTestAssert`, and `GeometryCoverageAttribute`. The comparison project keeps the tests that read model files, the web-ifc oracle, the comparer, and the reports. Files named `WpW5Tests` and the like are renamed after what they check, once read. The harness's `TestFiles` stops looking for a "studio root": it reads the repository's `data/` through `RepoPaths`, the project-local `data/ifc`, and `ARA3D_IFC_TEST_DIRS`.

**Bench.** `bench/ifc-mesher/` follows `bench/ifc-bench/`: a README saying what is measured and how to run it, `RESULTS.md` with the date and one row per file, and `scorecard.json` written by the parity test. The test writes there instead of the git-ignored `tests/.../data/reports/`.

**Knowledge.** `PROGRESS.md` and the 17 progress notes are deleted, not moved. Their numbers predate Earcut (TKT-179) and their diagnoses were working theories. The record of the mesher's quality is the fresh scorecard; the record of its gaps is the tickets, reworded so each criterion rests on a measurement someone can rerun.

## Considered and rejected

- **Option:** keep `IIfcMesher` and an instance class. **Reason:** one implementation; the comparison seam already exists as `IMeshingBackend`. **Would change if:** a second mesher is built in this repository.
- **Option:** rename the moved loader types' namespace to `Ara3D.Ifc.Entities`. **Reason:** ten projects in two repositories change for no behaviour; the compiler finds every reference whenever it is done. **Would change if:** the namespace confuses a reader in practice; then do it as its own commit.
- **Option:** rewrite the comparison harness as a console tool under `tools/`. **Reason:** NUnit is how it is driven today and the bench is run by hand; a console tool would be a second runner for the same code. **Would change if:** the bench joins CI.
- **Option:** carry the progress notes into `docs/` as history. **Reason:** the owner asked that they not be treated as facts; a fresh run replaces their numbers, and the tickets hold their open items. **Would change if:** a specific note is needed to understand a specific line of code; then that line gets a comment with the reason, not a link.
- **Option:** split the harness tests by moving whole files. **Reason:** nine files mix micro-IFC tests with file-reading tests; moving them whole puts file-reading tests in the fast project. **Would change if:** the split takes longer than two chunks; then move whole files and tag the file-reading tests `RequiresTestData`.

## Chunks

Checks per chunk: `dotnet build BimOpenData.sln -c Release`; `dotnet test tests/data/Ara3D.IfcMeshingComparison -c Release --no-build` with `ARA3D_IFC_TEST_DIRS` set to the owner's corpus folder (a clone of `ara3d/IFC-toolkit` `test-files` holds every public model the tests name); `dotnet test tests/mcp/BimOpenMcp.Ifc.Tests -c Release --no-build` where the MCP server changes. A refactor chunk passes with the same counts as the baseline.

| Id | One-sentence commit | Fence | Test |
|---|---|---|---|
| L1 | Flatten `Approach1` into `Ara3D.Ifc.Mesher`, replace `IIfcMesher` and `Approach1Mesher` with the static `IfcMesher`, and rename `GeometryCreationBacklog` to `GeometryCoverage` | `src/data/Ara3D.Ifc.Mesher/**`, `tests/data/Ara3D.IfcMeshingComparison/**`, `src/mcp/BimOpenMcp.Ifc/{IfcSession,IfcGeometry,IfcGeometryTools}.cs`, `tests/mcp/BimOpenMcp.Ifc.Tests/{IfcGeometryToolTests,GlbSourceComparisonTests}.cs` | build; comparison and MCP tests at baseline counts |
| L2 | Delete `PROGRESS.md` and `progress-notes/`, and rewrite the mesher and harness READMEs for the paths that exist | `src/data/Ara3D.Ifc.Mesher/{README.md,PROGRESS.md,progress-notes/**}`, `tests/data/Ara3D.IfcMeshingComparison/{README.md,RunGeometryGate.bat}` | the READMEs name only existing paths |
| L3 | Split `Brep.cs` by subject | `src/data/Ara3D.Ifc.Mesher/{Brep,FaceSetBuilder,FaceBounds,SurfaceMap,CylinderMap,RevolutionMap,BSplineSurfaceMap}.cs` | comparison tests at baseline counts |
| L4 | Split `CurveEvaluator.cs` by subject | `src/data/Ara3D.Ifc.Mesher/{CurveEvaluator,PolyCurves,Conics,TrimmedCurves,CompositeCurves,BSplineCurves}.cs` | comparison tests at baseline counts |
| L5 | Move the IFC entity model into portable `Ara3D.Ifc.Entities`, and make the mesher `net8.0` | `src/data/Ara3D.Ifc.Entities/**`, `src/data/Ara3D.IfcLoader/**`, `src/data/Ara3D.Ifc.Mesher/Ara3D.Ifc.Mesher.csproj`, `BimOpenData.sln`, `README.md` (project table) | full solution build; CI-filter test run; the mesher project builds alone |
| L6 | `TestFiles` reads the repository `data/`, the project `data/ifc`, and `ARA3D_IFC_TEST_DIRS`, with no studio root | `tests/data/Ara3D.IfcMeshingComparison/Harness/TestFiles.cs` | comparison tests at baseline counts |
| L7 | New `Ara3D.Ifc.Mesher.Tests` takes the micro-IFC tests; the comparison project's remaining files are named after what they check | `tests/data/Ara3D.Ifc.Mesher.Tests/**`, `tests/data/Ara3D.IfcMeshingComparison/Tests/**`, `BimOpenData.sln`, `tests/data/README.md` | both projects' test totals sum to the baseline |
| L8 | `bench/ifc-mesher/` with the parity scorecard written there, and a dated RESULTS.md from a run | `bench/ifc-mesher/**`, `tests/data/Ara3D.IfcMeshingComparison/Tests/Comparison/ScorecardTests.cs`, `Harness/ModelComparer.cs` (output path only), `README.md` (benchmark paragraph), `.gitignore` | the parity test writes `bench/ifc-mesher/scorecard.json` |
| T1 | Toolkit: pin bim-open-data, call `IfcMesher.Build`, reword the tickets, fix the architecture line | `deps.json`, `src/flow/BimOpenFlow.Nodes.Geometry/{ModelGeometry.cs,README.md}`, `tickets/TKT-{65,188,189,190}-*.md`, `docs/ARCHITECTURE.md`, `docs/REPOSITORY-INVENTORY.md`, `NOTES.md`, this file | toolkit Release build; `node deps.mjs --check` |
| S1 | Studio: close `ara3d-030`, delete the diagnosis plan, the archived mesher documents, and `IfcGeometryPipeline.cs` | `studio/tracker/**`, `studio/docs/ifc-mesher-transform-mesh-diagnosis-plan.md`, `studio/docs/archive/ifc-mesher-*.md`, `studio/IfcGeometryPipeline.cs` | `python tools/track.py index` regenerates; no link to the deleted files remains |
| S2 | Studio: move the `ara3d-sdk` submodule to `24939c1` | `studio/ara3d-sdk` (gitlink) | the studio solution filter builds; otherwise revert and report |

L1 and L2 first; L3, L4, L5, L6 are independent of each other and of L7; L7 after L3 and L4 (the test files reference the split classes); L8 after L6 and L7; T1 after every L chunk is pushed; S1 any time; S2 last.

## Extension points

- Rename the `Ara3D.IfcLoader` namespace of the types that moved to `Ara3D.Ifc.Entities`, as one commit, when the compiler can be trusted to find every use.
- `data/get-test-data.ps1` does not fetch the parity set (`IfcOpenHouse_IFC4.ifc`, `example.ifc`, `steelplates.ifc`, the Duplex, DigitalHub, and the AISC sculpture). The bench README names where each comes from; a fetch script would make the bench reproducible on a fresh machine.
- `MeshingDiagnostics.GeometrySupportStatus` and `GeometryCoverage.GeometryCreationSupport` are two three-valued enums for "how well is this entity handled"; one would do.

## Build log

- 2026-10-11, baseline before L1: Release build 0 errors; IfcMeshingComparison with `ARA3D_IFC_TEST_DIRS` set to the owner's `studio/data` folder: 219 passed, 18 skipped, 1 failed (`Example_SharedEntityBoundingBoxesMatchOracle`, 115 of 116 shared boxes; failing before this work); BimOpenMcp.Ifc.Tests 103 passed. The toolkit ticket for the work is TKT-216.
- 2026-10-11, L1 `e5d2e4e`, L2 `7f76b3b`: the rename and the deletions. Comparison and MCP counts at baseline.
- 2026-10-11, L3 `e1d9cb0`: Brep.cs split into eight files, not seven: `PlanarMap.cs` holds the plane arithmetic that would otherwise have put `SurfaceMap.cs` over 200 lines. Counts at baseline.
- 2026-10-11, L4 `c92323f`: CurveEvaluator.cs split; two private aliases without callers and one unused parameter dropped. Counts at baseline.
- 2026-10-11, L5 `26da373`: `Ara3D.Ifc.Entities` holds IfcEntity, IfcEntityResolver, IfcSchemas, IfcStringDecoder, IfcInstanceTypeRelations and the IfcTypes shared project. IfcMaterialSelectResolver and IfcPropValueExtensions stayed in the loader: they depend on IfcRelations and IfcPropData, which take an IfcFile. The mesher builds alone to `bin/Release/net8.0`. CI-filter tests: 16 projects, 0 failures.
- 2026-10-11, L6 `009d522`: TestFiles reads data/ and ARA3D_IFC_TEST_DIRS; outputs under artifacts/ifc-mesher. Also found and removed: eight absolute paths into the owner's checkouts (studio, ifc-sharp, 3d-format-shootout), two tests writing `.bfast` probes beside the model they read (which is how three stray files got into `studio/data` during this work), and `TestDataManager`, which copied corpora into a project-local folder. Counts at baseline.
- 2026-10-11, L7 `6f3a29c`: `Ara3D.Ifc.Mesher.Tests` (net8.0, 143 tests, 2 s) takes the snippet-built tests; `MicroIfc` parses through `StepDocument`, so the project has no loader dependency. The comparison project keeps 94 tests under `Tests/Corpus` and `Tests/Comparison`, named after what they check; all WP-labels in comments and Explicit reasons replaced by descriptions. Totals 143 + 94 = 237, one fewer than the baseline's 238: the test `SteelPlates_BrepFile_ProducesGeometry` existed twice (BrepTests and ProfileTests) and is kept once. 219 passed in both runs; same single failure. The July 2026 `GeometryEntityInventory.md` was deleted (InventoryTests regenerates it under `artifacts/`).
- 2026-10-11, L8 `b367400`: `bench/ifc-mesher/` with README, RESULTS.md, and `scorecard.json` from a run over the IFC-toolkit `test-files` folder (the one public folder that holds every model the tests name; `steelplates.ifc` is not in `studio/data`). Parity 0.963, 0.938, 0.918. `WriteScorecard` had to create its folder itself: `path.GetParent().Create()` did not, and the first run threw DirectoryNotFoundException. The five `IfcMesherParity` gates pass.
- 2026-10-11, T1: `deps.json` pins bim-open-data `b367400`; `ModelGeometry.Load` calls `IfcMesher.Build(file.EntityResolver)`; ARCHITECTURE and the inventory say the mesher is net8.0 with no native code; TKT-65 rewritten from the fresh scorecard (its old criteria quoted the deleted progress notes), TKT-188/189 reworded, TKT-190 renamed and its cause marked as suspected, not measured. Toolkit Release solution build 0 errors; `node deps.mjs --check` matches every pin.
- 2026-10-11, S1 studio `8ca7608c`: ara3d-030 closed; the diagnosis plan, three archived mesher documents and `IfcGeometryPipeline.cs` deleted.
- 2026-10-11, S2 not done: at `24939c1` the studio's `Ara3D.Studio.App.slnf` has 8 errors in `src/Ara3D.IO`, all `Ara3D.BimOpenSchema` missing, which the SDK removed in `d8735f3` (2026-09-15). The pointer is back at `82df732`; the blocker is studio issue `studio-333` (`4a2c9f71`). Until it moves, `ara3d-sdk/wip/Ara3D.Ifc.Mesher` and `tests/Ara3D.IfcMeshingComparison` remain in that checkout as tracked files of the old SDK commit.
- 2026-10-11, review and fixes: a fresh reviewer (platonic:reviewer) found three mesher files still over 400 lines, documents that attributed the October measurements (TKT-188, TKT-190) to the deleted July notes, a wrong merged-mesh description and symbol in the bench README, stale "native mesher" wording in three toolkit documents, links to deleted files in the studio issue, a copied Frobenius norm, and the parity gates spread over four fixtures. Each fix is its own commit in bim-open-data (`1fd869a`..`202786d`: SweptSolids, ProfileBuilder, and ModelAssembler split into eleven files, largest now 347 lines; `ParityGates.cs`; `MatrixNorms`; `IfcFile.SchemaOf` dropped), the studio (`0b351e17`), and this repository. Done tickets and closed tracker records keep the Approach1 name as history; the criterion above says so now. Follow-ups that were not fixed are TKT-223 (a test-support library; the remaining large files) and TKT-224 (owner-machine paths elsewhere in bim-open-data). S2 stays deferred behind studio-333; TKT-216 is closed with that noted. Fence crossings during L5, L6, and L7 (src/data/README.md, about twenty test files and .gitignore, Harness/*.cs and the comparison csproj) were harmless with one agent working in order.
- Builds in this checkout sometimes fail with NuGet's "Cannot create a file when that file already exists" during restore; a retry passes. Another session was building the same `deps/` projects at the time.
