# BOS middle layer wave: TKT-174 to TKT-183

Started 2026-10-10. Follows `docs/plans/bos-formats.md`, whose architecture notes became these tickets. The goal: the readers and writers around BOS (BIM Open Schema) share one middle layer instead of each rebuilding part of one, and the core stops turning a missing value into `""` or 0 (PROJECT.md principle 3). Workflows served: 1 (Fragments in), 2 (answers over MCP), and 3 (files to hand on).

Paths are relative to `deps/bim-open-data` unless they start with `deps/`.

## Order

| Wave | Ticket | Why it waits |
|---|---|---|
| A | TKT-174 scene view | - |
| A | TKT-179 earcut into Ara3D.Geometry | - |
| A | TKT-180 portable IFC conventions | - |
| A | TKT-178 retire the SDK glTF exporter | - |
| A | TKT-176 vertex rounding (code and test only) | regenerating the samples waits for wave C |
| B | TKT-177 BOS session in the MCP server | holds TKT-174's view; `BosFileToolTests.cs` has another session's uncommitted edit |
| B | TKT-175 absence in the BOS core | touches ObjectModel, `Ara3D.Ifc.Bos` and the Fragments reader after A; `ParquetUtils.cs` has another session's uncommitted edit |
| B | TKT-183 selective read (`.usdc` stays an idea) | `ParquetUtils.cs`, after TKT-175 |
| C | samples regenerated, pins moved | after every change that alters a `.bos` (TKT-175, TKT-176) |
| - | TKT-181 format nodes | blocked: depends on TKT-12 (Run from the editor), still open |
| - | TKT-182 column convention | a question for the owner; the supervisor drafts a recommendation |

Off limits until their owner commits: `src/data/Ara3D.BimOpenSchema.IO/ParquetUtils.cs`, `src/data/Ara3D.BimOpenSchema.Federation/BosUnion.cs`, `tests/data/Ara3D.BimOpenSchema.IO.Fragments.Tests/DuplexFixtureTests.cs`, `tests/mcp/BimOpenMcp.Ifc.Tests/BosFileToolTests.cs` (the "BIM Open Toolkit + Speckle integration" session's fixer, TKT-184: `.frag` saves had no geometry), plus `src/data/Ara3D.BimOpenSchema.IO.Fragments/FragmentsToBos.cs` and `src/mcp/BimOpenMcp.Ifc/BosFileTools.cs` until that session sends its commit hash. T180 was told to leave `FragmentsToBos.cs` alone.

## Chunk table (wave A)

Contracts: none shared between wave A chunks. TKT-174 commits its view before moving the writers onto it, and TKT-177 and TKT-175 build on that commit.
Baseline gates: `dotnet build BimOpenData.sln -c Release` and `dotnet test BimOpenData.sln -c Release --no-build --filter "TestCategory!=RequiresTestData"` at `7f788ed`: all pass (wave record of bos-formats, plus `tools/bos-to-usd`).

| Id | One-sentence commit | Fence (writes only) | Test command | Resources |
|---|---|---|---|---|
| T174 | A BOS scene view in ObjectModel; GLB, USD and BCF use it | `src/data/Ara3D.BimOpenSchema.ObjectModel/BosScene*.cs` (new files only), `src/data/Ara3D.BimOpenSchema.IO.Gltf/**`, `src/data/Ara3D.BimOpenSchema.IO.Usd/**`, `src/data/Ara3D.BimOpenSchema.IO.Bcf/**`, `tests/data/Ara3D.BimOpenSchema.ObjectModel.Tests/**` (new), `tests/data/Ara3D.BimOpenSchema.IO.{Gltf,Usd,Bcf}.Tests/**` | its four test projects, `--artifacts-path artifacts/wave2/t174` | samples read only |
| T179 | Earcut and ShellMesher in Ara3D.Geometry; Fragments and Approach1 use them | `deps/ara3d-sdk/src/Ara3D.Geometry/**`, the SDK's Geometry tests, `src/data/Ara3D.BimOpenSchema.IO.Fragments/{Earcut,ShellMesher,FragmentsGeometryReader,CircleExtrusionMesher}.cs`, `tests/data/Ara3D.BimOpenSchema.IO.Fragments.Tests/GeometryTests.cs`, `src/data/Ara3D.Ifc.Mesher/**`, `tests/data/Ara3D.IfcMeshingComparison/**` | SDK Geometry tests, Fragments tests, IfcMeshingComparison, `--artifacts-path artifacts/wave2/t179` | edits a project every other chunk compiles |
| T180 | Ara3D.Ifc.Conventions (net8.0) shared by Ara3D.Ifc.Bos and the Fragments reader | `src/data/Ara3D.Ifc.Conventions/**` (new), `tests/data/Ara3D.Ifc.Conventions.Tests/**` (new), `src/data/Ara3D.Ifc.Bos/**`, `src/data/Ara3D.BimOpenSchema.IO.Fragments/{FragmentsEntityReader,FragmentsItems,FragmentsToBos}.cs`, `src/data/Ara3D.BimOpenSchema.IO.Fragments/*.csproj`, `tests/data/Ara3D.BimOpenSchema.IO.Fragments.Tests/ReaderTests.cs` | Conventions, Fragments, Ifc tests, `--artifacts-path artifacts/wave2/t180` | none |
| T178 | ifc_export_glb and the BOS Browser write through Ara3D.BimOpenSchema.IO.Gltf | `src/mcp/BimOpenMcp.Ifc/IfcGeometryTools.cs`, `apps/Ara3D.BimOpenSchema.Browser/**`, `tests/mcp/BimOpenMcp.Ifc.Tests/IfcGeometryToolTests.cs`, `tests/mcp/BimOpenMcp.Ifc.Tests/GlbSourceComparisonTests.cs` (new) | MCP tests, `--artifacts-path artifacts/wave2/t178` | `data/` IFC fixtures read only |
| T176 | BimGeometryBuilder rounds to the nearest 0.1 mm | `src/data/Ara3D.BimOpenSchema.ObjectModel/BimGeometryBuilder.cs`, `tests/data/Ara3D.BimOpenSchema.Tests/VertexRoundingTests.cs` (new) | BimOpenSchema tests, `--artifacts-path artifacts/wave2/t176` | none |

Supervisor-owned: `BimOpenData.sln`, `Directory.Build.props`, every README outside a fence, `deps.json` in every repository, this file, and the tickets.

## Build log

- TKT-184 (another session's fixer) landed as bim-open-data `521b837`, `43386b2`, `46e5885`: `WriteToParquetZip` now writes the geometry tables. Its files were released, and `FragmentsToBos.cs` went back into T180's fence. The toolkit pin moved to `46e5885` in `92bdb52`; this wave rebases over it at the end.
- T183 (selective read, `ParquetUtils.cs` and `SelectiveReadTests.cs`) dispatched early, once `ParquetUtils.cs` was free. The `.usdc` half of TKT-183 stays an idea.
- T183: `6f80664`, fence only. `ReadBimDataFromParquetZip(path, BosTables)`; a selected table also reads the tables its rows index into (`WithReferencedTables`), so Entities never points into an empty Strings table. Accepted. 5 tests pass. Geometry and Entities against a full read: Schependomlaan 187 against 317 ms, digitalhub-federated 982 against 1075 ms (their Parameters tables are small). Callers to move in wave C: `BosGlb.cs` (after T174), `BosFileTools.cs`, bim-open-flow `ModelCatalog.cs:69,77`, toolkit `BosLoadNode.cs` and `BimModel.cs`, `tools/bos-to-usd`, the Browser.
- T176: `5ad98c3`, fence only. `BimGeometryBuilder.ToVertexUnits` rounds half away from zero, multiplies in double (the float product could not count single units above 1.68 km), and saturates beyond ±214,748 m. A 5 cm tube lost 0.29 % before and keeps its volume within 0.01 % now. `BimGeometryBuilder` is the only float-to-int site; every writer goes through it. All 11 samples in `samples/public` change on regeneration (wave C). The Fragments `ReaderTests` hidden-count failure it saw is T180's test in progress.
- T180: `36e483b`, fence only. `Ara3D.Ifc.Conventions` (net8.0) holds the parameter names, class rules (hidden classes), material sets, relation names and property-value attributes. `IfcRelationMapping` stays in Ara3D.Ifc.Bos because its enum lives in the Windows-only loader. `IfcToBosConverter` output was checked identical table by table on six IFC files. Both readers hide the same 21 IFCSPACE instances on the Duplex. Still different between the readers: a property with no value (`""` String in Ifc.Bos, nothing in Fragments) and integer property values (Number against Int); TKT-175 settles the first. Pre-existing: `Ara3D.Ids` does not build (`IfcDataTypes` missing) and is not in the solution, so no gate saw it.
- T178: `f740540`, fence only. `ifc_export_glb` and the BOS Browser write through `BosGlb`, and neither references `Ara3D.IO.GltfExporter` now. The tool's source is now the session's BOS conversion (web-ifc), chosen on evidence in `GlbSourceComparisonTests` ([Explicit]). Elements whose bounds agree within 1 cm: 86/90, 774/784, 3490/3493 and 234/236; all 14 large disagreements are roof-clipped walls that Approach1 leaves unclipped. Extras: `stepId`, `globalId`, `entityIndex`. 85 MCP tests pass; the validator reports 0 errors on five exports (by hand). Filed: TKT-188 (`ifc_mesh`, `ifc_bounds` and `ifc_volume` still measure Approach1), TKT-189 (the converter drops an instance that shares geometry, so the Duplex roof has no node). Integration: the MCP README row, the unused GltfExporter reference in `Ara3D.BimOpenSchema.Tests.csproj`, the uncalled `IfcGeometry.Filtered`.
- T174: `3d1b077` (view and 14 tests), `9e90745` (GLB, -72 lines), `af477c8` (USD, -86), `225f93a` (BCF, -52), fence only. `BosScene` in ObjectModel: one pass over Instances; groupings by entity and mesh bounds built on first use; `GlobalId`/`Name`/`Label` null for "", -1 and out of range; typed getters (`IntValue`, `NumberValue`, `StringValue`, `EntityValue`, `PointValue`) null when missing; `Select(filter)` counts bad mesh, transform and material indices once. Writer tests unchanged: GLB 9, USD 41, BCF 30. Behaviour changes: USD and BCF skip an instance with a bad transform (USD counts it in `InstancesWithBadTransform`). Left: `ElementBox` in IO.Bcf duplicates `BosBox`, and DataModel's `GeometryConversion` keeps stricter checks. Integration: the ObjectModel.Tests sln line and an ObjectModel README line.
- Supervisor `cdd0d2b`: Conventions and ObjectModel.Tests in the solution, README rows, the Fragments README no longer says nothing is hidden.
- T179: ara3d-sdk `566f24d` (Earcut and ShellMesher in Ara3D.Geometry, with tests), `c0abe6f` (`Earcut.Deviation`, the area check), `24939c1` (PolygonTriangulator shrinks to two forwarders for two Studio examples); bim-open-data `80eee24` (Fragments and Approach1 use them; Approach1 brep faces whose triangles miss their area by more than 1 % are left out). SDK Geometry tests 80/80, Fragments 33/33, IfcMeshingComparison 197/38 skipped as before (with `ARA3D_IFC_TEST_DIRS`), MCP 85/85. On DigitalHub, instances rise to 3599/3599 and bounds to 769/769, but triangles grow from 279,188 to 452,837 (web-ifc 311,811) and the merged-mesh score drops from 0.729 to 0.705. The old ear clip had been dropping 2,290 small faces; they now mesh, at Approach1's denser curve sampling. Lesson: add the new code, move callers, then delete. A first shrink broke everyone's build for a few minutes. Filed: TKT-190 (Approach1 curve density), TKT-191 (SDK triangulator leftovers). SDK pin `24939c1` moves in wave C.
- T177: `e6029e4` (`IfcGeometry.Filtered` deleted; the comments now name `IfcClasses.Hidden`), `f0652fc` (generic `SessionCache<T>`), `61715c1` (`BosSession` and `BosSessionCache`, keyed by `.bos`, LRU capacity 3, reopened when the file changes; tables, scene and DuckDB each built on first use; IFC sessions take theirs from the shared cache; the new `bos_table`; `MetricCatalog` resolves against the source document's folder). Reads all tables, because the writers and SQL need them and `BosScene` cannot tell unread from empty; lazy loading covers SQL-only use. Schependomlaan second calls: `bos_export_glb` 796 → 321 ms, `bos_sql` 45 → 34 ms. MCP 93/94; the one failure (a layer named "#13" now null) comes from T175's converter change, and that test was moved into T175's fence. Upstream gap: `IfcToBosConverter` exposes only its `DataSet`, so an IFC session re-reads the `.bos` it just wrote.
- T175: bim-open-schema `c4bd3f3` (the spec says -1 means absent; the builder's push was rejected behind two newer commits, and the supervisor rebased and pushed it). bim-open-data `54fa408` (builder and accessors: null becomes -1, `""` stays a value, `Get` returns null for absent, nullable annotations on in ObjectModel and IO), `b6efd51` (Fragments), `46e987a` (IfcToBosConverter: no `"#id"` names, no row for a property without a value), `63f8bfc` (DuckDB views: -1 and legacy `""` read as NULL), `e7dbef1` (explorer). bim-open-viewer `16b8a3c` (formats). Fresh Duplex conversion: 4,376 GlobalIds and 2,788 names absent (-1), none `""`. All projects pass, MCP 94/94 (layer #13 is now named null; it is `$` in the file). The builder edited `BimObjectModel.cs` outside its fence because ObjectModel would not compile otherwise; accepted. Supervisor: toolkit `BimModel.cs` (did not compile against `Point?`), `RoomNavigator.cs` and `SimulateSequence.cs` null handling; `FederationExample` passes null (`68c471d`). Toolkit builds with 0 errors. Left: units and groups are still `""` for none; `NameOrNull` repeats `IfcEntity.GetEntityLabel`'s attribute order.
- T175 follow-up `e28a28b`: `NameOrNull` reads a class's name attribute from the schema (`Name`, `LayerSetName`, `ProfileName`, `ApplicationFullName`) and only when its value is a STEP string. On the Duplex, names starting with "#" go from 1,190 to 0 and absent names from 2,788 to 4,170. Presentation layers and surface styles gain their real names. Found by C1's first regeneration.
- Wave C dispatched: C1 regenerates `samples/public`, C2 moves callers onto selective reads and removes the last GltfExporter reference.
- C1, first run: stopped before committing because DigitalHub architecture's entity count changed (2,972 → 3,640, material constituents from `817e609`, which landed after the samples of 2026-10-03). Parameter-row changes were traced to `817e609` (material rows), `26b8691` (duplicate rows) and TKT-175 (empty values). The supervisor accepted the new counts and asked for a second regeneration after `e28a28b`.
- C2: bim-open-data `ebfa619` (`BosGlb.WriteGlb(path)` reads Geometry and Entities; byte-identical against a full read) and `752dd49` (the last `Ara3D.IO.GltfExporter` reference removed); bim-open-flow `3af0b4f` (`ModelCatalog`: the entity index reads Entities and Parameters, `GetInfo` four tables); toolkit `caa178f` (`bos.load` reads Entities, Parameters and Relations; its test copies the sample before reading). Each has a test that fails when a needed table is dropped. Schependomlaan reads: GLB 361 → 224 ms, entity index 373 → 227 ms, `GetInfo` 373 → 337 ms, `bos.load` 298 → 278 ms. Left reading everything: the Browser (shows every table) and `bos-to-usd` (uses all but Diagnostics). A row-count-only read would help `GetInfo`.

## Review findings (fresh reviewer, 2026-10-10)

Defects (D) and design notes (N), with the fix chunk (F) that owns each. Paths are in bim-open-data unless named.

- D1 `BosDuckDbViews.cs:41-46`: `ParameterText` shows a Point parameter's table index ('17', '-1') as its value. -> F1
- D2 `ParquetUtils.cs:558-566` `WithReferencedTables`: Entities does not pull in Documents; Parameters, Relations, Diagnostics and Geometry do not pull in Entities, so "not read" looks like "absent". -> F2
- D3 `Federation/BosUnion.cs:98`, `Harmonizer/BosHarmonizer.cs:25,89,113,170`, `Harmonizer/SourceKind.cs:34,46` index `Strings` directly and throw on -1. -> F4
- D4 The IFC and Fragments readers name the same entity differently (IfcToBosConverter `NameAttributes`/`NameOrNull`/the space rule against `FragmentsEntityReader.NameOf`, Name only); the rule belongs in Ara3D.Ifc.Conventions, and `DuplexFixtureTests` compares names for doors only. -> F3
- D5 `Ifc.Mesher/Approach1/Brep.cs:111` and `Tessellated.cs` drop faces without a diagnostic; `Brep.cs:311-320` has two stacked summaries. -> F5
- D6 `BimGeometryBuilder.ToVertexUnits`: a NaN vertex becomes int.MinValue; clamping at ±214 km is silent. -> F6
- D7 The spec comment said older absence is index 0. Fixed in bim-open-schema `c369c32`.
- D8 Units and groups still store "" for none, and `ParameterText` shows the "". -> F1 (view `NULLIF`), F3 (readers pass null)
- D9 `ObjectModel/BimObjectModel.cs:166,169,205`: GlobalId/Name use `Get`, not `Label` (legacy "" leaks out); about 30 nullable warnings; `GetParameterAsNumber` unboxes a null `float?`. `BimGeometryExtensions.cs:87,306` index `InstanceFlags` without a length check. -> F8
- D10 Debt marked "Left" has no tickets, and the wave's tickets are still open. -> supervisor
- D11 TKT-177's "ifc_table works on a .bos" is not met; `bos_table` exists instead. -> F9
- N1 BOS session lifetime: eviction during an HTTP call, a leak when Dispose fails, GUID folders leak per run, and an IFC session's `databasePath` can vanish under capacity 3. -> F9
- N2 Explicit selection includes hidden instances in `ifc_export_glb` but not in `bos_export_glb`. -> F9 (both include hidden when named)
- N3 bim-open-flow `ModelEntityIndex.cs:88-115` turns absence into "", copies `Label`, and `Find(-1)` returns an arbitrary category. -> F4
- N4 The TKT-176 tolerance holds only at 4,096 segments; the worst case on a 0.1 mm grid is about 0.2 %. -> F6 restates it
- N5 Duplicates: `ElementBox` against `BosBox` (-> F10), `DataModel/GeometryConversion` (ticket), `NameOrNull` against `GetEntityLabel` (-> F3), the Revit exporter makes up GlobalIds (ticket).
- N6 What the Speckle reader will trip on (units and groups, naming hooks, the harmonizer on -1, unread against empty, the silent clamp, the `frag_to_bos` recipe). Covered by F1-F4, F6, F9 (`BosSession.FromData`).
- N7 Waves B and C had no fence table, and TKT-175's and TKT-183's ticket fences did not match the work. Recorded in the wave record.
- N8 Status of the bos-formats architecture notes: see the wave record.

## Fix log

- F10 `0bb5b28`: `ElementBox` deleted; IO.Bcf uses `BosBox` (net -12 lines). BCF 30/30.
- F1 `b4888f0` (D1: `ParameterText` renders a Point as `Point { X = 1.5, Y = 2.0, Z = -3.0 }`, NULL for -1) and `bc9eb65` (D8 view: `NULLIF` on Units and ParameterGroup). DuckDb 47 pass, 2 skipped.
- F5 `a0db841` (D5; its trailer says TKT-176 by mistake, and it belongs to TKT-179): Approach1 records every dropped face (failed triangulation, area off by more than 1 %, fewer than 3 points, ShellMesher false) as one line per product with counts and the first three face ids; the product's IFCFACE status becomes Approximate. Corpus: Duplex 256 dropped faces in 8 products, Schependomlaan 198 in 31, FZK-Haus, Institute and model_0 none. IfcMeshingComparison 200 pass, MCP 96.
- F6 `e5c3d88` (D6: a mesh with a non-finite vertex is left empty with its slot kept, so no instance index shifts; `NonFiniteMeshCount` and `ClampedCoordinateCount`; `ToVertexUnits` throws on non-finite) and `427577c` (N4: the test asserts each vertex within 0.05 mm, at most 0.4 % volume change at any tessellation, and about 0.001 % at 4,096 segments as an observation; TKT-176's criterion restated). Wiring both counts into diagnostics in the two readers was handed to F3 (the first message went to F2 by mistake; corrected on resume).
- Committed before the stall: F9 `1373cab` (D11: `ifc_table`, `ifc_sql`, `ifc_sql_export` and `ifc_export_glb` take a `.bos` path), F4 `38dbdd2` (D3: Federation and Harmonizer read absent strings through `Get`/`Label`).
- 2026-10-11: F2, F3, F4, F8 and F9 stalled together (the stream watchdog, no progress for 600 s), each mid-chunk with uncommitted work in its own fence. All five were resumed with `SendMessage`, keeping their context, and continued from the files on disk.
- F2 `eb3e1a5` (D2): `WithReferencedTables` follows a single references table to a fixed point. Parameters, Relations, Diagnostics and Geometry now also read Entities (hence Strings and Documents), and Entities reads Documents. A new test checks that every index in the selected rows resolves to a row that was read, for each table. Callers still pass: Gltf 12, Catalog 28, Nodes.Bos 12.
- F4 `38dbdd2`, `307840a` (D3: Federation and Harmonizer read absent strings through `Get`/`Label`; an unnamed category gets no canonical category, counted in one diagnostic) and bim-open-flow `81c058a` (N3: `ModelEntityIndex` keeps absence null and never finds LocalId -1). The API still sends `""` because the wire contract requires strings: TKT-198. Federation 14, Harmonizer 13, Catalog 31, Host.Api 43.
- Supervisor toolkit `55573c4`: `bos.load` orders parameters totally (two same-named parameters in different groups came out in either order, so F4's run hit a flaky test). The node's three queries are constants that its test reuses. Two goldens re-approved for F1's null units.
- F9 `1373cab` (D11), `dfb106e` (N1: a lease per call, so a session in use is never evicted or disposed; an IFC session leases its conversion's BOS session; derived files live under `%TEMP%/bimopenmcp`, keyed by source and build id, reused after a restart and swept at start), `4aed48c` (N2: named hidden instances are exported by both GLB tools), `964e91a` (N6: `BosSession.FromData` and `CopyDatabaseBeside`); toolkit `52befea` (ifc-ask skill). MCP 103/103, suite about 15 s instead of 70 s. The query tools open DuckDB read-only. Leftovers: TKT-199.
- F8 bim-open-data `4f57e83` (D9: the object model reads absence like BosScene, through `Label`; `GetParameterAsNumber` returns `float?`; Elevation, TypeName, WorksetId are nullable; bad parameter rows are left out; `BimGeometry.GetInstanceFlags` gives the short-column rule to every caller; nullable warnings 33 → 0) and toolkit `83ee110` (BimAnalysis nodes and studio tools handle nulls). ObjectModel 20, BimOpenSchema 96, BimAnalysis 80; both solutions 0 errors. Leftovers: TKT-200.
- F3 `205bdd6` (D4 and N5's duplicate: `IfcNames.NameOf` in Ara3D.Ifc.Conventions is the one naming rule; `IfcEntity.GetName` in IfcLoader uses it, and both readers and `GetEntityLabel` call it; `NameOrNull` and `MaterialNameIndex` deleted. A name may be an enumeration value, so IfcSIUnit is named METRE from both readers. A new Duplex test pairs every entity both readers keep and compares name and room number; it failed on all 21 spaces before), `aaebb39` (D8 readers: null units, and null groups from Fragments), `7bf79ac` (F6's counts become ExporterWarning diagnostics in both readers). Conventions 35, Fragments 36, Ifc 23, MCP 102. Out of fence: TKT-201 (IfcPropData names an unnamed set "$"); the Revit exporter's "" units are in TKT-193. The samples need regenerating (units -1, SI unit names): C1 resumed.

- C1, third regeneration `9fde349`: units NULL in all 16,110 Duplex ParameterText rows (were ""), five IfcSIUnit entities named (METRE, SQUARE_METRE, ...), no diagnostics in any sample, counts unchanged; the temporary `UnitsUnnamedInTheCommittedSample` list in DuplexFixtureTests deleted.

## Wave record

Outcome: success. TKT-174, 175, 176, 177, 178, 179, 180 and 183 (selective read) are closed with every criterion met. The review's 11 defects were fixed, except D10, which became tickets. Its 8 design notes were fixed, filed, or recorded here (N7). TKT-181 (format nodes) waits on TKT-12, and TKT-182 (column convention) waits on the owner.
Gates (final, 2026-10-11):
- bim-open-data `f065f10`: BimOpenData.sln 0 errors, and every project passes with `TestCategory!=RequiresTestData` (MCP 103, BimOpenSchema 74, Workflows 96, DuckDb 47+2 skipped, USD 41, Fragments 36, Conventions 35, BCF 30, Ifc 23+11, ObjectModel 20, GLB 12, IfcMeshingComparison 192+45).
- bim-open-flow `469a3ad`: every project under tests/flow passes (BimOpenFlow.sln itself does not build inside deps/: TKT-197).
- Toolkit: BimOpenToolkit.sln 0 errors, every test project passes, and two pairs of golden texts were re-approved for intended changes.
- Not run: tests tagged RequiresTestData, the explorer's Playwright smoke test, the web gates.
Pins: bim-open-data `f065f10` (pins schema `c369c32`, sdk `24939c1`, viewer `16b8a3c`), bim-open-flow `469a3ad` (pins data `f065f10`), toolkit pins all five.
Commits: in the build and fix logs above.
Findings:
- Wave A ran five builders and one early chunk (T183) once another session released `ParquetUtils.cs`. Wave B ran two, wave C two, and the review fix round nine.
- Coordination with three peer sessions went by message. The Speckle session's TKT-184 held six files; it released them by sending a hash, and its Speckle reader was told the absence rule before it starts.
- Two builders edited outside their fence because the build would not compile otherwise (T175 `BimObjectModel.cs`, F3 IfcLoader); both were accepted and recorded.
- One message went to the wrong fixer (F2 instead of F3) and was corrected on resume.
- Five fixers stalled together on the stream watchdog. All were resumed with `SendMessage` and finished from their files on disk; nothing was redone.
- Regenerating the samples found work that predated the wave (`817e609` material rows, `26b8691` duplicates), and a real defect (names read from a STEP reference, fixed in `e28a28b`). It ran three times, because two review fixes changed fresh conversions.
- N7: waves B and C had no fence table in this plan, and the fences of TKT-175 and TKT-183 did not match the work. Fences were set in each brief instead. Next time, write them here before dispatch.
- Tickets filed along the way: TKT-187 to TKT-201.
Status of the architecture notes in `docs/plans/bos-formats.md`:
- 1, scene view: resolved (DataModel: TKT-192).
- 2, absence: resolved in the spec, builder, readers, views, object model, Federation, Harmonizer, catalog and JS readers (leftovers: TKT-193, 198, 200, 201).
- 3, BOS session: resolved, and the `ifc_*` query tools take a `.bos`.
- 4, one glTF writer: resolved.
- 5, earcut and conventions: resolved (TKT-191 for the SDK leftovers).
- 6 and 7: open (TKT-182, TKT-181).
- 8, selective read: resolved (`.usdc`: TKT-196; row counts: TKT-195).
Timing: 2026-10-10 afternoon to 2026-10-11. The builders ran 2 to 47 minutes each, mostly in parallel; run one after another, their total would be about 9 hours of agent time.
