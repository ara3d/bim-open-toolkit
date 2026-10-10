# BOS formats wave: GLB, BCF, Fragments, USD

Started 2026-10-10 from the format survey in chat on 2026-10-08. Four tickets, one builder each, all in `deps/bim-open-data` (repository `ara3d/bim-open-data`); the toolkit's `deps.json` pin moves once at the end.

| Ticket | Format | Direction | Workflow |
|---|---|---|---|
| TKT-170 | GLB (binary glTF) | out | 3 |
| TKT-171 | BCF 3.0 (BIM Collaboration Format) | out | 3 |
| TKT-172 | That Open Fragments 2 (`.frag`) | in | 1 |
| TKT-173 | OpenUSD (`.usda`) | out | 3 |

## Chunk table

Contracts: none shared. Each chunk adds one library project and one test project and reads only existing code (`Ara3D.BimOpenSchema`, `Ara3D.BimOpenSchema.ObjectModel`, `Ara3D.BimOpenSchema.IO`, `Ara3D.Ifc.Bos`, the SDK).
Baseline gates: `dotnet build BimOpenData.sln -c Release` in `deps/bim-open-data` (result in the wave record).

Paths below are relative to `deps/bim-open-data`.

| Id | One-sentence commit | Fence (writes only) | Depends on | Test command | Resources |
|---|---|---|---|---|---|
| GLB | BOS to GLB with entity ids in node extras, y-up | `src/data/Ara3D.BimOpenSchema.IO.Gltf/**`, `tests/data/Ara3D.BimOpenSchema.IO.Gltf.Tests/**` | - | `dotnet test tests/data/Ara3D.BimOpenSchema.IO.Gltf.Tests -c Release --artifacts-path artifacts/wave/glb` | `samples/public/duplex.bos` (read only) |
| BCF | BCF 3.0 writer from an issues table | `src/data/Ara3D.BimOpenSchema.IO.Bcf/**`, `tests/data/Ara3D.BimOpenSchema.IO.Bcf.Tests/**` | - | `dotnet test tests/data/Ara3D.BimOpenSchema.IO.Bcf.Tests -c Release --artifacts-path artifacts/wave/bcf` | same |
| FRAG | Fragments 2 reader into BOS | `src/data/Ara3D.BimOpenSchema.IO.Fragments/**`, `tests/data/Ara3D.BimOpenSchema.IO.Fragments.Tests/**` | - | `dotnet test tests/data/Ara3D.BimOpenSchema.IO.Fragments.Tests -c Release --artifacts-path artifacts/wave/frag` | `samples/nrc/duplex-base.ifc` (read only); scratch npm installs outside the repository |
| USD | BOS to `.usda` stage | `src/data/Ara3D.BimOpenSchema.IO.Usd/**`, `tests/data/Ara3D.BimOpenSchema.IO.Usd.Tests/**` | - | `dotnet test tests/data/Ara3D.BimOpenSchema.IO.Usd.Tests -c Release --artifacts-path artifacts/wave/usd` | same |

Supervisor-owned: `BimOpenData.sln`, `Directory.Build.props` (package versions), `README.md`, `src/data/README.md`, `src/mcp/BimOpenMcp.Ifc/**` (one MCP tool per format, after the builders return), and this file.

## Build log

- GLB: `8edac54`, fence only. 5 tests pass; Khronos glTF validator 2.0.0-dev.3.10 reports 0 errors and 0 warnings on all 11 public samples. Duplex: 681 instances, 660 nodes (21 hidden), 26,774 triangles drawn, 930,520 bytes, 18 ms to write.
- BCF: `edb93a0`, fence only. 25 tests pass; every XML file validates against the buildingSMART BCF 3.0 XSDs (pinned bc48611, CC BY-ND, unmodified). Duplex doors: 4 topics, 14 elements, 5,204 bytes. Ticket criterion 2 corrected: BCF 3.0 forbids a viewpoint without a camera.
- FRAG: `00deae9` (entities, properties, relations) and `99e5b31` (geometry), fence only. 30 tests pass. The Duplex fixture made by That Open's own importer matches the BOS from the same IFC: equal per-class element counts, 207 identical storey pairs, element boxes within 2 mm, signed volume per class within 0.03 %; 27,242 triangles against 27,342.
- Integration: `8db3659` (supervisor). Eight projects in the solution, `Ara3DGoogleFlatBuffersVersion` in `Directory.Build.props`, MCP tools `frag_to_bos`, `bos_export_glb`, `bos_export_usd`, `bos_export_bcf` in `BosFileTools.cs` with `BosFileToolTests` (6 tests), README rows. Toolkit pin moved to `8db3659`.
- Review (fresh reviewer, 5 defects, 7 design notes): MCP side `0e92cb9` (supervisor): `bos_sql` over any `.bos`, text views in `frag_to_bos`'s database, BCF GUID seed defaults to the file name, error-message test. BCF `3998d55` (validate, then write a temporary file and move it into place) and `b83ea5d` (characters XML cannot hold become U+FFFD), 30 tests. GLB `285c313` (`UnmatchedEntityIndices`), `0201b4e` (bad flags, material and transform indices skipped or defaulted and counted), `824f255` (Khronos validator script pinned in the test project), 9 tests; MCP `bos_export_glb` now takes `entityIndices` and fails when none draws. USD `06a2de8` (no `bim:localId` for -1), `fb0367c` (temporary file, then move), `d13566e` (every entity a prim: Xform with geometry, Scope without; BOS relations as `bim:` relationships), 41 tests with usd-core; Schependomlaan now 56.8 MB `.usda`, 7.2 MB `.usdc`. MCP text for `bos_export_usd` updated in `039f5a2`. The defect "8edac54 has no trailers" was skipped: `git log -1 8edac54` shows `Ticket: TKT-170` and `Agent:`.
- USD: `637c94d`, fence only. 36 tests pass with usd-core 0.26.8 (32 plus 4 reported skips without it); duplex opens with no composition errors and no findings from 28 UsdValidation validators. Schependomlaan: 42.7 MB .usda in about 300 ms; 4.7 MB as .usdc or .usdz.

## Learned

Facts the next person would otherwise rediscover. Each project's README holds the full list for its format.

**GLB**
- The SDK's `Ara3D.IO.GltfExporter` cannot carry node extras. It gives a mesh shared by several instances the first instance's material, writes meshes no visible instance uses, and rotates z-up to y-up with a float matrix that leaves about 4e-8 where zeros belong. The new project writes with SharpGLTF (`Ara3D.IO.SharpGLTF`) instead.
- three.js `GLTFLoader` copies node extras into `object.userData`, so a pick reads `userData.entityIndex`.
- A .glb is 8 to 14 times its .bos. The largest public sample, `digitalhub-federated.bos` (4.8 MB), gives 47.8 MB.

**BCF**
- BCF 3.0 requires exactly one camera in every viewpoint (`visinfo.xsd`). A topic with no geometry therefore gets no viewpoint, and its GlobalIds go in the description.
- `IfcGuid` must be exactly 22 characters of the IFC base-64 alphabet. Anything else, such as a Revit UniqueId, goes in `AuthoringToolId`.
- Topic and viewpoint GUIDs must be lowercase. `<Visibility>` without `DefaultVisibility="true"` hides the whole model.
- .NET resolves no `xs:include` unless `XmlSchemaSet.XmlResolver` is set. The BCF schema files are CC BY-ND, so only unmodified copies may be committed.
- BOS coordinates are the model's own z-up metres, which is also BCF's frame, so no conversion is needed.

**Fragments**
- A `.frag` file is a zlib-deflated FlatBuffer. That Open's importer writes it without the `"0001"` identifier the `.fbs` declares.
- The version is in the metadata JSON (`@thatopen/fragments` 3.4.8). The schema is pinned to tag `v3.4.8`.
- Attributes are JSON text `[name, value, ifcType]`. Relations are `[name, id, ...]` over local ids (IFC express ids).
- `guids_items` holds local ids, but `meshes_items` holds positions. `sample.item` indexes both `meshes_items` and `global_transforms`.
- Geometry is y-up metres, moved near the origin by web-ifc. `meshes.coordinates` records that move, so the reader undoes it and maps (x, y, z) to (x, -z, y).
- The FlatBuffers library's own verifier throws on real That Open files, so the reader does its own bounds checks. That Open's importer skips openings and type objects by default.
- Git treated `.frag` as text until a `.gitattributes` marked it binary.

**USD**
- The usd-core 0.26.8 Windows wheel ships no `usdchecker` script. The same checks run through `UsdValidation.ValidationRegistry`.
- An instanceable prim shares its descendants, not itself, so each prototype is `P{i}/Mesh`.
- BOS's scale × rotation × translation order is USD's `[translate, orient, scale]`. usda quaternions are written real part first.
- `TextWriter.Write(int)` follows the writer's culture, and sv-SE writes a Unicode minus sign. The writer formats every number with the invariant culture.
- Schependomlaan writes 42.7 MB of `.usda` in about 0.3 s, which is 4.7 MB as `.usdc`. Snowdon will need `.usdc`, by usd-core conversion or a native writer.

**BOS data (all four builders hit these)**
- 4,376 of the Duplex's 4,721 entities have GlobalId `""`. `BimDataBuilder` cannot write an absent GlobalId or Name, so every reader writes `""`.
- `BimDataExtension.Get(NumberIndex)` returns 0 for a missing value, and `Get(StringIndex)` throws on -1.
- `BimGeometryBuilder.BuildModel` truncates vertices toward zero (`(int)(v * 1e4)`) instead of rounding. A 5 cm tube loses about 0.26 % of its volume.
- `Entity.GlobalId` is a `StringIndex`, contrary to the specification's comment that it is not kept in the string table.

**Repository mechanics**
- `dotnet sln add` includes referenced projects by default (`--include-references true`). In the toolkit's linked `deps/` layout, that adds dependency projects by `..\` paths, which break a standalone clone. Pass `--include-references false`.
- `Platonic.props` restores analyzers from a local `Platonic.CSharp` feed and forbids ambient IO (rule PURE010). None of the four projects imports it, which matches the other `IO.*` projects.
- `ParquetUtils.ReadBimDataFromParquetZip` takes a `FilePath`. The implicit conversion from string does not apply in extension-method form.

## Architecture notes

**How it fits together.** BOS is already the hub. Each reader turns a source into `BimData` through `BimDataBuilder`: IFC through `Ara3D.Ifc.Bos`, Fragments through the new reader, Revit through the exporter. Each writer turns `BimData` into a target: DuckDB, the tabular exports, and now GLB, USD and BCF. N readers and M writers then cost N + M converters, not N × M. The wave confirmed that shape: no format needed to know about another. What it exposed is that the hub has no shared middle layer, so each spoke rebuilt part of one.

**1. A scene view over BOS (TKT-174).** The three writers each re-derived the same pieces:
- the hidden-instance test (GLB inline, BCF `ElementBounds`, and a third copy in DataModel `GeometryConversion.cs`)
- GlobalId and name lookup with bounds checks (all three)
- per-entity bounds (BCF `ElementBounds`, also needed by the viewer's "frame selection")
- grouping instance and parameter rows by entity (USD `RowGroups`)
- typed parameter values that are null when missing (USD `BosValues`)

They belong in one view in `Ara3D.BimOpenSchema.ObjectModel`, built once in O(n):
- `Instances(filter)` yielding (instance, entity, mesh, material, world transform)
- `ElementsWithGeometry`
- `ParametersOf(entity)`
- `EntityIds(entity)` returning (GlobalId?, Name?)
- `Bounds(entity)`
- `TypedValue(parameter)`

`BimObjectModel` cannot serve: it copies every mesh through `ToModel3D()` and keys parameters by name, so two descriptors with one name collide.

**2. Absence in the core (TKT-175; vertex truncation is TKT-176).** Principle 3 (honest absence) holds in each new library and fails beneath them: the builder interns `""`, the accessor turns a missing number into 0, and nullable annotations are off in `IO` and `ObjectModel`. The fix starts in the specification: say that index -1 means absent, then follow it through the builder and the accessors.

**3. The MCP server is shaped around IFC sessions (TKT-177).** `IfcSessionCache` keys sessions by `.ifc` path, so a `.frag` or a `.bos` cannot be opened, cached, or queried with `ifc_sql`. The new tools take a `bosPath` and re-read the archive on every call. A BOS session would fix all three: the cached `IBimData`, its DuckDB, and the scene view of note 1, keyed by `.bos`, with IFC and Fragments as two ways to create one. The `ifc_*` query tools could then run on any source.

**4. Two glTF writers (TKT-178).** `ifc_export_glb` and the WPF Browser still use the SDK exporter and inherit its material bug. Moving them to `Ara3D.BimOpenSchema.IO.Gltf` retires one writer. For the IFC tool, that means routing through BOS geometry instead of the Approach1 mesher, which needs a check that the two meshers agree.

**5. Shared geometry and IFC knowledge sit in the wrong places (TKT-179, TKT-180).**
- The SDK's `PolygonTriangulator` fails its own rectangle-with-hole test, so the Fragments reader ported earcut. Earcut and `ShellMesher` belong in `Ara3D.Geometry` (ara3d-sdk), replacing it.
- The IFC rules a reader needs live in `Ara3D.Ifc.Bos`, which is `net8.0-windows` with native web-ifc: the hidden classes, the relation-name mapping, and the `Ifc:` parameter prefix. A portable reader cannot reference them, so the Fragments reader marks nothing hidden. A small portable conventions project would serve both.

**6. One issue and selection table (TKT-182).** BCF reads a table with `GlobalId`, `Title`, `Description`, `Status` and `Priority`. The flow's verdict tables use camelCase (`checkTitle`, `verdict`), `Ara3D.Ids` uses PascalCase, and the DuckDB views use PascalCase. One named convention would let a check, an IDS run, a SQL result and the viewer's selection feed BCF, GLB extras and colouring without column mapping.

**7. Not yet in graphs (TKT-181, after TKT-12's Run).** The formats are library calls and MCP tools, but not nodes. Workflow 3 needs writer nodes that wait for Run (principle 2) for GLB, USD and BCF, and a reader node for `.frag`, so a graph can end in a file someone else opens.

**8. Reading only what is needed (TKT-183, with `.usdc`).** `ReadBimDataFromParquetZip` reads every table. The GLB export never uses Parameters, and at Snowdon's size (about 450,000 instances) a table list on the reader would save most of the read.

## Wave record

Outcome: success. All acceptance criteria of TKT-170 to TKT-173 pass. Two criteria were corrected against the formats: BCF 3.0 forbids a viewpoint without a camera (TKT-171), and usd-core ships no `usdchecker` (TKT-173).
Gates: baseline `dotnet build BimOpenData.sln -c Release`, 0 errors (330 warnings, all older). Final, at `039f5a2`: 0 errors, and `dotnet test --filter "TestCategory!=RequiresTestData"` passes in every project: Gltf 9, Bcf 30, Fragments 30, Usd 37 (+4 skipped without usd-core; 41 with it), BimOpenMcp.Ifc 82. Not run: tests tagged RequiresTestData, and a toolkit build against the new pin. The toolkit references none of the new projects.
Commits: GLB `8edac54`, `285c313`, `0201b4e`, `824f255`; BCF `edb93a0`, `3998d55`, `b83ea5d`; FRAG `00deae9`, `99e5b31`; USD `637c94d`, `06a2de8`, `fb0367c`, `d13566e`; supervisor `8db3659`, `0e92cb9`, the `entityIndices` commit, `039f5a2`. Toolkit pin at `039f5a2`.
Findings:
- No builder needed a fence change or a contract.
- The platonic commit-guard hook flagged each builder's files as edited by another session, because all four builders share one session id. Each builder checked the diff and committed with `platonic.claim`.
- `dotnet sln add` pulled dependency projects in by `..\` paths; the supervisor reran it with `--include-references false`.
- The reviewer found 5 defects and 7 design notes. 4 defects and 4 notes were fixed, 1 defect was wrong, and 3 notes became tickets (TKT-174, TKT-179, TKT-181).
Timing: builders ran 12 (GLB), 13 (BCF), 19 (USD) and 29 (FRAG) minutes at once, about 75 minutes if run one after another. Review 9 minutes; fixes 4 to 10 minutes each, again at once.
