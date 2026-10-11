# Speckle converter and viewer

Status: planned, 2026-10-10. The converter (D chunks) is unblocked since wave B of the bim-open-data session landed the absence rule and the scene view; the viewer fork (W chunks) is under way in a separate repository (see the build log). Tickets: TKT-185 (the converter, chunks D1 to D7), TKT-186 (the viewer, chunks W1 to W3 and H1), TKT-184 (the geometry-saving defect found on the way).

Brainstorm: [speckle-integration-brainstorm.md](../proposals/speckle-integration-brainstorm.md), ideas 1, 3, 9, 13, 18, 26, 44. This plan builds the two pieces the owner asked for on 2026-10-10: a converter between BIM Open Schema (BOS, the toolkit's table format) and Speckle's object model in both directions, and the Speckle viewer running locally inside the studio with no Speckle server and no account.

## Goal and acceptance criteria

**Workflows served.** Workflow 1 (a Speckle user's model, saved as Speckle objects, opens in Claude over DuckDB) and workflow 3 (a BOS model handed to someone as Speckle objects they can publish or view, and a second 3D renderer for pictures of the model). Workflow 1's Done line is a correct answer about a public model; the converter's measure is the round-trip test below. Workflow 3's Done line is a file someone else opens; the measure is the Duplex opening in the Speckle viewer from the studio and from a standalone page.

**Converter, acceptance criteria.**

1. A library call turns an `IBimData` into a set of Speckle objects (a root `Collection`, one `DataObject` per element with its properties and its `displayValue` meshes, render material proxies) and saves it as one JSON file, `<name>.speckle.json`, holding a flat array of objects whose first element is the root. The object ids are the Speckle content hashes the SDK computes, so the file is what a Speckle server or viewer would hold.
2. A library call reads such a file into a `BimData`: entities, parameters, relations (spatial containment), and geometry, z-up metres, through `BimDataBuilder` and `BimGeometryBuilder`.
3. Round trip on `samples/public/duplex.bos`: BOS to Speckle to BOS gives the same element count per category, the same GlobalIds, the same storey containment pairs, the same number of typed parameters per element, and the same triangle count; vertex positions agree within 0.1 mm (the BOS vertex grid). The test reports every count.
4. Honest absence: a missing name, GlobalId, or property value is never written as `0` or `""` into Speckle; a Speckle property that is `null` produces no BOS parameter. (The builder still writes `""` for an absent GlobalId on the way back: TKT-175.)
5. Values keep their type: Speckle booleans become BOS integer parameters with the descriptor group recording the origin, numbers become numbers, strings strings; a `{value, units}` property keeps its units in the descriptor.
6. A mesh with quads or n-gons is triangulated; the count of n-gons is a diagnostic, not an error. An unknown `units` string fails with a message naming it.
7. Two MCP tools in `bimopen-ifc`: `bos_export_speckle(bosPath, outPath)` and `speckle_to_bos(specklePath, bosPath)`, each returning counts; the saved `.bos` holds the geometry tables.
8. A file of a hundred thousand elements (Schependomlaan, 9,000 elements, is the committed check; Snowdon is a manual run) converts in both directions without reading the whole JSON into one string: the writer streams objects to the file and the reader streams them back.

**Viewer, acceptance criteria.**

9. A standalone studio page, `speckle.html`, lists the host's model catalog and opens any model in `@speckle/viewer` (Apache-2.0, three.js based), fed by the host's Speckle objects for that model, with no Speckle server and no network access beyond the host.
10. The studio's 3D pane can run on the Speckle viewer: with `?viewer=speckle` in the page URL, the pane's `View3DDeps` is the Speckle rig, and a graph's colour, isolate, and hide tables apply to the Speckle viewer through its filtering extension; a click in the viewer selects the entity in the pane as today.
11. Transforms from a graph (explode, offsets, arrange) are not applied by the Speckle rig; the pane shows a one-line notice naming the limitation instead of silently ignoring the table.
12. The host serves `GET /api/models/{id}/speckle`, converting the model's BOS on first request and caching the result by BOS content hash, in the same place the IFC-to-BOS cache lives.
13. A web smoke in `gates/` loads the Duplex on `speckle.html` and checks that the viewer reports a load complete event and a non-zero object count.
14. A measurement recorded in this plan: time to first frame and memory for the Duplex and Schependomlaan in the Speckle rig and in the bim-open-viewer rig, same machine, same page.

**Out of scope.** Sending to or receiving from a Speckle server (an extension point below). The 2026.9 bundle format (`Send3`, `Receive3`): every SDK release of that line is a beta as of 2026-09-30, and no published viewer reads it. Instancing through `InstanceProxy` (meshes are written in world space). Relations other than spatial containment. Speckle's section, measurement, and diff tools. The notebook's hostless embed on the Speckle viewer.

## What exists and what is reused

- **The hub-and-spoke shape of the BOS formats wave** ([bos-formats.md](bos-formats.md)): each format is one library under `deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.<Format>` with a test project, an MCP tool in `BosFileTools.cs`, a README row, and a solution entry. The Fragments reader (`FragmentsToBos.Read(FilePath) -> BimData`, `FragmentsEntityReader`, `FragmentsGeometryReader`, geometry problems as `ExporterWarning` diagnostics) is the model for the reader; the GLB writer (hidden-instance filter, entity ids carried as extras) is the model for the writer.
- **`BimDataBuilder` and `BimGeometryBuilder`** (`Ara3D.BimOpenSchema.ObjectModel`): `AddDocument`, `AddEntity`, `AddParameter` overloads that choose the `ParameterType`, `AddRelation`, `AddDiagnostic`; `AddMesh`, `AddMaterial`, `AddTransform`, `AddInstance`, `BuildModel`.
- **Speckle.Sdk 2026.8.0** (NuGet, Apache-2.0, `net8.0` and `netstandard2.0`, 2026-08-26): `Base` with dynamic properties and the `@` detach prefix, `Speckle.Objects.Data.DataObject` (`name`, `properties`, `displayValue`), `Speckle.Sdk.Models.Collections.Collection` (`elements`), `Objects.Geometry.Mesh` (`vertices` flat, `faces` packed as count then indices, `colors` per vertex, `units`), `RenderMaterial` and `RenderMaterialProxy` (`objects` = application ids), `IOperations.Send(Base, transports)` and `Receive(objectId, transport)`, `MemoryTransport(ConcurrentDictionary<string,string>)`, `DefaultTraversal.CreateTraversalFunc()`. Sending to a `MemoryTransport` yields the flat dictionary of id to JSON, with `__closure` and `referencedId` references, that a server stores and the viewer loads.
- **`@speckle/viewer` 2.31.14** (npm, Apache-2.0, depends on `three ^0.140.0` and `@speckle/objectloader2`): `new Viewer(container, params)`, `loadObject(loader)`, extensions `CameraController`, `SelectionExtension`, `FilteringExtension` (`isolateObjects`, `hideObjects`, `showObjects`, `setUserObjectColors(groups: {objectIds, color}[])`, `resetFilters`), events `ObjectClicked` and `LoadComplete`, `screenshot()`. `ObjectLoader2Factory.createFromObjects(objects: Base[])` and `createFromJSON(json)` build a loader from in-memory objects, the first element being the root; `SpeckleLoader` creates its object loader in a `protected initObjectLoader(...)` that a subclass overrides. `SpeckleConverter.traverse` reads `displayValue`/`@displayValue`, `elements`/`@elements`, `referencedId`, `units`, and the proxies; it never reads `properties`, so the viewer renders whatever properties we attach.
- **The 3D pane seam** (`deps/bim-open-notebook/bimopenflow/web/packages/pane-3d/src/viewerDeps.ts:13-27`): `View3DDeps.createRig(canvas, onPick) -> ViewerRig` with `load(url, format, onPreview) -> GroupEntityMap[]`, `setBoxes`, `clearBoxes`, `requestRender`, optional `applyRecipe`, `fit`, `reset`, `capture`, `legend`, `dispose`. `createViewPane3D({ deps })` takes another implementation; test fakes already do. Colouring and hiding happen in the pane by writing per-instance RGBA through `ColorableGroup.setColors`, so the Speckle rig's groups translate colour writes into `setUserObjectColors` and `hideObjects` calls.
- **The host's model bytes endpoint** (`deps/bim-open-flow/src/flow/BimOpenFlow.Host.Api/ModelBytesEndpoint.cs`) and the IFC-to-BOS cache in `ModelCatalog` are the pattern for the Speckle endpoint. The studio already maps its own endpoints: `Program.cs:19` passes `host => host.App.MapAsk(host.Services)` to `HostRunner.RunAsync`, so a `MapSpeckle` sits beside `MapAsk` in `src/studio/BimOpenFlow.Studio` and the generic host stays free of Speckle.
- **Studio pages**: `bimopenflow/web/packages/studio-web/vite.config.ts` lists `index.html`, `studio.html`, `3d.html`, `showcase.html` as inputs; `speckle.html` is a fifth. `toolkitPanes.ts` and `main.ts` are where `?viewer=speckle` selects the deps.

**Retired:** nothing. This work adds a spoke and a rig. The one deletion it enables is listed under Planned debt.

## Facts that shape the design

- The viewer's loader needs a flat array of objects with content-hash ids and `__closure` maps, the same thing a server stores. The SDK's `Send` to a `MemoryTransport` produces exactly that, so the writer does not reimplement Speckle's hashing. This is why the converter depends on the SDK rather than writing JSON by hand (see Considered and rejected).
- Speckle's own IFC import writes a `DataObject` per element with `properties["IFC Type"]`, `properties["IFC GUID"]`, `properties["IFC Attributes"]`, and `properties["Property Sets"][pset][name] = scalar` under Project, Site, Building, and Storey collections. The writer mirrors those keys so a reader written for Speckle's IFC output reads ours, and the reader accepts both that shape and the Revit connector's `{value, units}` leaves.
- Speckle geometry is z-up like BOS. No axis change. Units are a string per object; the writer uses `"m"` and the reader converts `m`, `mm`, `cm`, `ft`, `in`, and the long forms.
- `@speckle/viewer` pins `three ^0.140` and the studio workspace dedupes `three` to 0.185. Whether the viewer runs on 0.185 is spike S1. If not, the rig runs the viewer in an iframe page with its own `node_modules`, and the rig talks to it by `postMessage`.
- **Absence rule, agreed with the "BIM Open Data format support" session on 2026-10-10:** build BOS only through `BimDataBuilder` and `BimGeometryBuilder`, and write nothing for a missing value where the builder allows it. That session's wave B landed the same evening: specification bim-open-schema `c4bd3f3` (an index of -1 means absent, LocalId -1 means none); bim-open-data `54fa408` (`BimDataBuilder.AddEntity` and `UpdateEntity` take a null GlobalId or Name and store -1, `AddParameter` with a null string adds no row, `IBimData.Get(...)` returns `string?`, `float?`, `Point?` and null for -1; `""` stays a real value); the DuckDB views `63f8bfc` read -1 and legacy `""` as NULL. The scene view is `BosScene` in `Ara3D.BimOpenSchema.ObjectModel` (`3d1b077`), for writers: `BosToSpeckle` (chunk D3) uses it for instances, bounds, and typed values. The MCP server has a BOS session cache (`61715c1`), so a Speckle-made `.bos` opens in `bos_sql`, `bos_table`, and `bos_export_*` with no new tool. The toolkit's pins for bim-open-data, bim-open-schema, ara3d-sdk, and bim-open-viewer move at the end of that session's wave C; D1 builds against bim-open-data `54fa408` or later and D7 rebases onto whichever pin lands last.
- The pane never sends mesh bytes; it sends tables and a model URL. The Speckle rig therefore needs its own URL for the objects, which is the `/api/models/{id}/speckle` endpoint.

## Spikes (answer before chunk 1)

- **S1: three.js version.** Half a day. In `scratch/speckle-viewer-three/`, install `@speckle/viewer@2.31.14` beside `three@0.185` and render the viewer's OBJ sample. Answer: direct import in the workspace, or iframe isolation. Abandon the viewer half if neither renders.
- **S2: in-memory loading.** Half a day, after S1. Write a `DataObject` with one `Mesh` and a `RenderMaterialProxy` from a ten-line C# program using `Send` to a `MemoryTransport`, dump the objects as a JSON array, root first, and load them in the browser through a `SpeckleLoader` subclass whose `initObjectLoader` returns `ObjectLoader2Factory.createFromObjects(objects)`. Answer: does the mesh render with its colour, and does `ObjectClicked` return the object's `properties`? **The finding that would make abandoning the viewer half right:** the viewer cannot render from in-memory objects without a server. Then the only local path is a Speckle server in Docker, which on Windows needs WSL2, and the viewer half becomes a ticket, not a chunk.
- **S3: SDK on the host.** Two hours, in parallel with S1. Reference `Speckle.Sdk 2026.8.0` from a `net8.0` console project beside `Ara3D.BimOpenSchema.IO`; confirm the package graph (Speckle.Newtonsoft.Json, Microsoft.Data.Sqlite, GraphQL.Client) restores next to Parquet.Net and DuckDB without binding conflicts, and that `Send` to a `MemoryTransport` needs no network. Answer: the package reference line for chunk 1.

Each spike writes its answer under "Spike answers" at the end of this file before chunk 1 starts.

## Design

### Module 1: `Ara3D.BimOpenSchema.IO.Speckle` (library, `deps/bim-open-data`)

Target `net8.0`, no Windows dependency, references `Ara3D.BimOpenSchema.IO`, `Ara3D.BimOpenSchema.ObjectModel`, and `Speckle.Sdk`. It must not reference `Ara3D.Ifc.Bos` (which is `net8.0-windows` with native web-ifc, TKT-180).

```csharp
namespace Ara3D.BimOpenSchema.IO.Speckle;

/// A flat set of Speckle objects as a server or viewer holds them:
/// content-hash ids, the root first. Json holds one serialized object per id.
public sealed record SpeckleObjectSet(string RootId, IReadOnlyDictionary<string, string> Json);

public static class BosToSpeckle
{
    /// Builds the Speckle object graph for a BOS model and serializes it with the
    /// SDK's Send to a MemoryTransport, so ids are Speckle content hashes.
    /// Hidden instances are skipped; each skipped index is counted in the summary.
    public static Task<(SpeckleObjectSet Objects, SpeckleWriteSummary Summary)> ConvertAsync(
        IBimData data, SpeckleWriteOptions? options = null, CancellationToken ct = default)
        => throw new NotImplementedException();

    /// Builds the object graph without serializing it (for tests and for a later server send).
    public static Collection BuildRoot(IBimData data, SpeckleWriteOptions? options = null)
        => throw new NotImplementedException();
}

public sealed record SpeckleWriteOptions(bool IncludeGeometry = true, bool IncludeHidden = false);

public sealed record SpeckleWriteSummary(
    int Elements, int Collections, int Meshes, int Triangles, int Materials,
    int HiddenSkipped, int ParametersWritten, IReadOnlyList<string> Warnings);

public static class SpeckleToBos
{
    /// Reads a Speckle object set into BOS. Title and path become the Document row.
    public static (BimData Data, SpeckleReadSummary Summary) Convert(
        SpeckleObjectSet objects, string title, string path, SpeckleReadOptions? options = null)
        => throw new NotImplementedException();
}

public sealed record SpeckleReadOptions(bool IncludeGeometry = true);

public sealed record SpeckleReadSummary(
    int Elements, int Collections, int Meshes, int Triangles, int NGonsTriangulated,
    int ParametersRead, int NullsSkipped, IReadOnlyList<string> Warnings);

/// The .speckle.json file: a JSON array of objects, the root first.
public static class SpeckleObjectFile
{
    public static Task SaveAsync(SpeckleObjectSet objects, FilePath file, CancellationToken ct = default)
        => throw new NotImplementedException();
    /// Streams the array; never holds the whole file as one string.
    public static Task<SpeckleObjectSet> LoadAsync(FilePath file, CancellationToken ct = default)
        => throw new NotImplementedException();
}

/// Speckle unit strings to metres. Unknown strings throw with the string in the message.
public static class SpeckleUnits
{
    public static double ToMetres(string? units) => throw new NotImplementedException();
}
```

**Mapping, BOS to Speckle** (`BosToSpeckle`):

| BOS | Speckle |
|---|---|
| Document | root `Collection` named by the document title; `properties["BOS"] = { "Generator", "Version" }` from the Manifest |
| Entities whose category is IfcProject, IfcSite, IfcBuilding, IfcBuildingStorey (by category entity name) | nested `Collection`s in that order, with `properties["IFC Type"]`, `["IFC GUID"]`, and the entity's parameters as below; a level proxy per storey |
| Every other entity with geometry or parameters | `DataObject`: `name` = Name when present; `applicationId` = GlobalId when present, else `bos:{entityIndex}`; `properties["IFC Type"]` = category name; `["IFC GUID"]` = GlobalId when present; `["BOS"]` = `{ "EntityIndex", "LocalId", "Type": type entity name }`; placed under the storey its `ContainedIn` relation names, else under an `Unplaced` collection |
| Parameters, grouped by descriptor Group | `properties["Property Sets"][group][name]` = scalar when the descriptor has no units, else `{ "value": v, "units": u }`; Entity-valued parameters become the target's applicationId; Point parameters become `[x, y, z]`; groups whose name starts with `Ifc:` go under `properties["IFC Attributes"]` instead |
| Instances (not hidden), mesh and transform | one `Mesh` in `displayValue` per instance, world-space vertices (transform applied), `units = "m"`, faces as triangles `[3, a, b, c]` |
| Materials | one `RenderMaterial` per BOS material (`diffuse` ARGB from RGBA bytes, `opacity`, `metalness`, `roughness`), collected in `RenderMaterialProxy` entries on the root with `objects` = application ids of the meshes that use them; the writer gives each mesh an `applicationId` of `{entityAppId}/m{instanceIndex}` for that purpose |
| Relations other than `ContainedIn` | not written (extension point E3) |

**Mapping, Speckle to BOS** (`SpeckleToBos`), walking with the same rules as the viewer's converter: resolve `referencedId` through the set, read `displayValue`/`@displayValue` and `elements`/`@elements`, dechunk `DataChunk`s.

| Speckle | BOS |
|---|---|
| Each `Collection` | an entity with category from `properties["IFC Type"]`, else from `collectionType`, else `Collection`; its children get a `ContainedIn` relation when the collection is a storey, `PartOf` otherwise |
| Each object with a `displayValue` or a `DataObject` | an entity: LocalId = running index; GlobalId = `properties["IFC GUID"]`, else `properties["IFC Attributes"]["GlobalId"]`, else absent; Name = `name`; category entity per distinct `properties["IFC Type"]`, falling back to the last segment of `speckle_type` |
| `applicationId`, `id`, `speckle_type` | parameters `Speckle:applicationId`, `Speckle:id`, `Speckle:type` in group `Speckle` |
| `properties`, recursively | one parameter per leaf: group = the key path above the leaf joined by `/` (`Property Sets/Pset_WallCommon`), name = leaf key; a `{value, units}` object is one parameter with those units; `null` is skipped and counted; arrays of three numbers under a key become a Point only when the key path says so (`BOS/...`), otherwise the array is written as JSON text |
| `Mesh` | vertices scaled by `SpeckleUnits.ToMetres(units)`, faces unpacked, quads split into two triangles, n-gons fan-triangulated and counted; `colors` ignored (material wins) |
| `InstanceProxy` with a definition | the definition's meshes with the instance transform (read side only; the writer does not emit proxies) |
| `RenderMaterialProxy` | one BOS material per proxy, assigned to the instances whose mesh application ids the proxy lists; meshes with no proxy get the default material |

**Worked example** (the test fixture `tests/data/Ara3D.BimOpenSchema.IO.Speckle.Tests/Fixtures/one-wall.bos`, built by the test with `BimDataBuilder`): one document "one-wall", a storey entity "Level 1" (category IfcBuildingStorey), one wall entity with GlobalId `2O2Fr$t4X7Zf8NOew3FLKI`, Name "Wall-1", parameters `Pset_WallCommon/IsExternal = true` (no units) and `Qto_WallBaseQuantities/Length = 4.0` (units `m`), relation wall `ContainedIn` storey, one unit-cube mesh at translation (1, 2, 0) with a red material. Expected Speckle: root Collection "one-wall" → Collection "Level 1" (`IFC Type` IfcBuildingStorey) → DataObject "Wall-1" (`applicationId` = the GlobalId, `properties["Property Sets"]["Pset_WallCommon"]["IsExternal"] = true`, `["Qto_WallBaseQuantities"]["Length"] = { value: 4.0, units: "m" }`), `displayValue` = one Mesh of 8 vertices from (1,2,0) to (2,3,1), 12 faces, `units "m"`; one RenderMaterialProxy with diffuse red. Reading that back gives 3 entities (storey, wall, and the category entities aside), the same GlobalId, 1 ContainedIn relation, 2 parameters with the same types and units, 12 triangles.

### Module 2: MCP tools and a command line (`deps/bim-open-data`)

In `BosFileTools.cs`, beside `frag_to_bos`:

- `bos_export_speckle(bosPath, outPath?)`: reads the `.bos`, calls `BosToSpeckle.ConvertAsync`, saves `.speckle.json`, returns the summary and the path.
- `speckle_to_bos(specklePath, bosPath?)`: loads the file, calls `SpeckleToBos.Convert`, then follows `frag_to_bos`'s recipe: `BosSession.FromData(data, bosPath, files)` plus `CopyDatabaseBeside()` (bim-open-data `964e91a`), which saves the `.bos` with its geometry (`WriteToParquetZip` includes geometry since TKT-184, `521b837`) and registers the session so `bos_sql`, `bos_table`, `ifc_table`, `ifc_sql`, and `bos_export_*` open it by its `.bos` path (`1373cab`). Returns the summary.

Recipe facts from the middle-layer wave (bim-open-data `f065f10`, plan `docs/plans/bos-middle-layer.md`) that D1 to D6 code against: a descriptor's units and group are `null` for "none", not `""` (`aaebb39`), so the writer emits a `{value, units}` leaf only when units is non-null; `BimGeometryBuilder` skips non-finite meshes and counts clamped coordinates (`NonFiniteMeshCount`, `ClampedCoordinateCount`), and the reader turns both into `ExporterWarning` diagnostics the way `IfcToBosConverter` does (`7bf79ac`).

`tools/bos-to-speckle` is a one-file console like `bos-to-usd`, for converting outside the MCP server. Both tools gain a row in `src/data/README.md` and `BosFileToolTests` entries.

### Module 3: the studio endpoint (`src/studio/BimOpenFlow.Studio`)

```csharp
public static class SpeckleEndpoint
{
    /// GET /api/models/{id}/speckle: the model's Speckle objects as the .speckle.json
    /// array, converted on first request and cached beside the IFC-to-BOS cache,
    /// keyed by the BOS content hash. 404 for an unknown id.
    public static IEndpointRouteBuilder MapSpeckle(this IEndpointRouteBuilder app, IServiceProvider services)
        => throw new NotImplementedException();
}
```

Registered in `Program.cs` next to `MapAsk`. The cache folder is the one `ModelCatalog` uses for converted IFC; the file name is `{hash}.speckle.json`. A second request streams the cached file.

### Module 4: the Speckle rig and page (`bimopenflow/web/packages/pane-3d-speckle`, toolkit repository)

A new workspace package beside `studio-web`, in this repository rather than in bim-open-notebook, so the notebook and flow repositories stay free of Speckle.

```ts
// src/speckleRig.ts
export interface SpeckleRigOptions { readonly objectsUrlFor: (modelUrl: string) => string }

/** View3DDeps backed by @speckle/viewer; the pane's colour and hide writes become
 *  FilteringExtension calls, transforms are refused with a notice. */
export const speckleView3DDeps = (options: SpeckleRigOptions): View3DDeps => { throw new Error("stub") };

// src/offlineLoader.ts
/** A SpeckleLoader whose object loader is built from an in-memory array (root first). */
export class OfflineSpeckleLoader extends SpeckleLoader {
  constructor(tree: WorldTree, resourceId: string, objects: Base[]) { super(tree, resourceId); throw new Error("stub") }
  protected override initObjectLoader(): ObjectLoader2 { throw new Error("stub") }
}

// src/entityMap.ts
/** objectId <-> BOS entity index, read from properties.BOS.EntityIndex while the tree loads. */
export interface EntityMap { entityOf(objectId: string): number | undefined; objectsOf(entity: number): readonly string[] }
export const buildEntityMap = (tree: WorldTree): EntityMap => { throw new Error("stub") };

// src/speckleGroups.ts
/** ColorableGroup over a set of object ids: setColors batches into setUserObjectColors,
 *  alpha 0 into hideObjects; setTransform records one notice and does nothing. */
export const speckleGroup = (viewer: Viewer, filtering: FilteringExtension, entities: readonly number[], map: EntityMap): GroupEntityMap => { throw new Error("stub") };
```

- `speckle.html` and `src/specklePage.ts` in `studio-web`: a model list from `GET /api/models`, a viewer filling the page, a "Fit" button and a PNG capture (`viewer.screenshot()`), the load time shown in the corner (criterion 14).
- `studio-web/src/main.ts`: `const deps = new URLSearchParams(location.search).get("viewer") === "speckle" ? speckleView3DDeps({ objectsUrlFor }) : undefined;` passed into the view3d registration's `create`.
- If S1 says iframe: the package also holds `frame.html` with its own `package.json` outside the workspace globs, and `speckleRig.ts` talks to it over `postMessage` with the same four messages (`load`, `colors`, `hide`, `pick`). The public surface above does not change.

**Worked example.** The Duplex on `speckle.html`: the host converts `duplex.bos` once (681 instances, 26,774 triangles per the GLB record), the page shows 660 objects after load, clicking a door writes its `IFC GUID` and `Property Sets` to the side panel, and `?viewer=speckle` on `studio.html` with the `duplex-doors` graph colours the doors by storey.

## Chunks

Two tracks. The data track is sequential; the web track starts from S2's fixture and joins at W3.

| Id | One-sentence commit | Fence (writes only) | Depends on | Test |
|---|---|---|---|---|
| S | Spikes S1, S2, S3 answered in this file | `docs/plans/speckle-converter-and-viewer.md`, `scratch/**` (git-ignored) | - | the answers below |
| D1 | `Ara3D.BimOpenSchema.IO.Speckle`: stubs that compile, `SpeckleUnits`, `SpeckleObjectFile` save and load, with tests | `deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Speckle/**`, `deps/bim-open-data/tests/data/Ara3D.BimOpenSchema.IO.Speckle.Tests/**` | S3 | `dotnet test tests/data/Ara3D.BimOpenSchema.IO.Speckle.Tests -c Release --artifacts-path artifacts/speckle` |
| D2 | `BosToSpeckle`: entities, collections, parameters (no geometry), one-wall and Duplex counts | same | D1 | same; Duplex: 1 project, 1 site, 1 building, 2 storeys, element count equals the BOS element count |
| D3 | `BosToSpeckle` geometry and materials: world-space meshes, render material proxies, hidden skipped | same | D2 | same; Duplex triangle count equals the GLB record's 26,774 minus hidden |
| D4 | `SpeckleToBos`: entities, collections, parameters, containment; honest absence | same | D2 | same; one-wall round trip exact |
| D5 | `SpeckleToBos` geometry: units, faces, n-gons, instance proxies, materials; the Duplex round trip (criterion 3) | same | D3, D4 | same; the round-trip numbers written into this file |
| D6 | MCP tools `bos_export_speckle` and `speckle_to_bos`, the `bos-to-speckle` console, README rows, solution entries | `deps/bim-open-data/src/mcp/BimOpenMcp.Ifc/BosFileTools.cs`, `deps/bim-open-data/tests/mcp/**`, `deps/bim-open-data/tools/bos-to-speckle/**`, `deps/bim-open-data/BimOpenData.sln`, `deps/bim-open-data/src/data/README.md` | D5 | `dotnet test tests/mcp -c Release`; `tools/list` names both |
| D7 | Pin `bim-open-data`; rebuild the MCP server; `docs/DEMOS.md` row | `deps.json`, `docs/DEMOS.md` | D6 | `node deps.mjs`, `node scripts/build-mcp.mjs --check` |
| W1 | `pane-3d-speckle` package: `OfflineSpeckleLoader`, `buildEntityMap`, `speckle.html` loading S2's fixture file from `/fixtures/` | `bimopenflow/web/packages/pane-3d-speckle/**`, `bimopenflow/web/packages/studio-web/speckle.html`, `studio-web/src/specklePage.ts`, `studio-web/vite.config.ts`, `bimopenflow/web/package.json`, `package-lock.json` | S1, S2 | `npm run build --workspace packages/studio-web`; the fixture renders |
| W2 | `speckleView3DDeps` and `speckleGroup`: colours and hides through the filtering extension, picks back to the pane, transforms refused with a notice; `?viewer=speckle` in `main.ts` | `bimopenflow/web/packages/pane-3d-speckle/**`, `studio-web/src/main.ts` | W1 | vitest in the package with a fake viewer: a colour table becomes one `setUserObjectColors` call per distinct colour; alpha 0 becomes `hideObjects` |
| H1 | `SpeckleEndpoint.MapSpeckle`, cached by BOS hash, registered beside `MapAsk` | `src/studio/BimOpenFlow.Studio/SpeckleEndpoint.cs`, `src/studio/BimOpenFlow.Studio/Program.cs`, `src/studio/BimOpenFlow.Studio/BimOpenFlow.Studio.csproj`, `tests/studio/**` | D7 | a studio test requests the Duplex twice and the second response comes from the cache |
| W3 | `speckle.html` and the rig read `/api/models/{id}/speckle`; the `bof-speckle` launch entry; the web smoke (criterion 13) | `studio-web/src/specklePage.ts`, `pane-3d-speckle/src/speckleRig.ts`, `.claude/launch.json`, `gates/speckle-smoke.mjs`, `gates/all.mjs` | W2, H1 | `node gates/speckle-smoke.mjs` |
| M | Measurements (criterion 14) and the limitations recorded in this file and `docs/bim-flow-3d.md` | `docs/plans/speckle-converter-and-viewer.md`, `docs/bim-flow-3d.md` | W3, D7 | the numbers are in the file |

Builders: one for D1 to D6 (the SDK's object model is the one context worth keeping), one for W1 to W3, the supervisor for S, H1, D7, and M. W1 can start as soon as S2 produces its fixture, before any D chunk is committed.

## Planned debt

- **`frag_to_bos` and `FragmentsToBos.Convert` save through `WriteToParquetZip`, which omits the geometry tables** (`BimDataExtension.ToDataSet` lists nine tables; `ParquetUtils.cs:392` says so). Found while reading the pattern this plan copies. Not fixed here: filed as TKT-184 so the fix is one commit with its own test. D6 uses the `WriteBimOpenSchema` path and its test opens the saved file and counts instances.
- **The MCP `createRun` tool snapshots instead of running effects** (`FlowEvalTools.cs:105-111` calls `Sessions.Snapshot`, the HTTP endpoint calls `Run`). Noted for TKT-12's owner, not this plan.
- **Two converters of BOS to a viewer's input** will exist if the iframe path is taken and the page converts in the browser; the plan avoids that by converting on the host (H1). If H1 cannot land (the studio cannot reach the catalog's cache folder), the browser-side conversion is the fallback and this entry becomes a ticket.

## Extension points (not built)

- **E1 Server send and receive.** `BosToSpeckle.BuildRoot` already returns the `Collection`; `operations.Send2(url, projectId, token, root)` publishes it, and `Receive2` feeds `SpeckleToBos.Convert`. A `speckle.load` node (project, model, version) and a `sink.speckle` effect node follow the `bos.load` and `sink.exportParquet` shapes once TKT-12's Run exists; the version id is the content hash the run record pins.
- **E2 The 2026.9 bundle.** When `Send3`/`Receive3` leave beta and `@speckle/viewer` reads a bundle, `SpeckleObjectSet` gains a second serialization; the BOS tables map onto the columnar property store and the relational layer more directly than onto `properties`.
- **E3 Relations beyond containment** (`HasMaterial`, `Voids`, `Fills`, `ConnectsTo`): either `properties["BOS Relations"]` now, or the 2026.9 relational layer (E2), which is the better home.
- **E4 Instancing** through `InstanceDefinitionProxy` and `InstanceProxy` on the write side, cutting file size for repeated meshes (the Duplex has 681 instances over fewer meshes).
- **E5 The notebook embed** on the Speckle rig, reading a `.speckle.json` beside the notebook as `view3dEmbed` reads a `.bos` today.
- **E6 Speckle tools in the recipe**: `SectionTool` for `view3d.section`, `DiffExtension` for a future `speckle.diff` table.

## Considered and rejected

- **Option:** write the Speckle JSON by hand, no SDK dependency (brainstorm idea 45, inverted). **Reason:** the viewer and server identify objects by Speckle's content hash over its canonical serialization, with `__closure` depth maps; reimplementing that is the part most likely to drift. The SDK is Apache-2.0, `net8.0`, and `Send` to a `MemoryTransport` needs no network. **Would change if:** S3 finds the package graph conflicts with Parquet.Net or DuckDB, or the SDK's size (Speckle.Sdk.Dependencies with IL-repacked libraries) is unacceptable in the MCP server's publish.
- **Option:** target the 2026.9 bundle (`Send3`) now, since the old model's server compatibility ends 2026-11-01. **Reason:** every 2026.9 SDK release is a beta, no published viewer reads a bundle, and the local viewer is half of this plan. The file we write is what the viewer loads today. **Would change if:** a stable 2026.9 SDK and a viewer release that reads bundles both ship; then E2 becomes the next plan.
- **Option:** a local Speckle server in Docker as the viewer's source. **Reason:** Windows needs WSL2, the stack is five containers, and it only matters if S2 fails. **Would change if:** S2 shows the viewer cannot load in-memory objects.
- **Option:** put the Speckle rig in `deps/bim-open-notebook` beside `pane-3d`. **Reason:** the notebook repository is generic; a Speckle dependency there would pull Apache-2.0 viewer code and a second three.js into every notebook build. The toolkit holds the BIM-specific and experimental parts. **Would change if:** E5 (notebook embed on Speckle) is wanted; then the rig moves with a pin.
- **Option:** a second pane kind ("Speckle 3D" tab) instead of `?viewer=speckle`. **Reason:** two tabs for one result confuse the demo; the flag gives an A/B comparison on one page and touches no generic pane code. **Would change if:** users want both renderers side by side.
- **Option:** convert BOS to Speckle objects in the browser from the BOS bytes the host already serves, using `@bim-open-viewer/loaders`. **Reason:** a second implementation of the mapping in TypeScript, so the two would drift (principle 4). **Would change if:** H1 cannot land.

## Decisions for the owner (defaults used if unanswered)

- Property layout: mirror Speckle's IFC importer (`Property Sets`, `IFC Attributes`, `IFC Type`, `IFC GUID`) with `{value, units}` leaves where BOS has units. Default: yes.
- Where `.speckle.json` files land for the MCP tool when `outPath` is omitted: next to the `.bos`. Default: yes.
- Keep the Speckle rig behind `?viewer=speckle` rather than a settings toggle. Default: yes, until M's numbers say which renderer is better for which model.

## Spike answers

(filled in by chunk S)

## Build log

(one line per chunk: commit, tests, numbers)

## Measurements

(criterion 14: model, renderer, first frame ms, memory MB, machine)

## Build log

- 2026-10-10: the owner asked for the Speckle viewer as its own repository with the Speckle dependencies split out. `C:\Users\cdigg\git\bim-open-web-viewer` (no remote yet) holds a fork of speckle-server `packages/viewer` at 51d43b91: `packages/viewer` is the engine with no `@speckle/*` import (a test enforces it), `packages/speckle` holds `SpeckleLoader`, `SpeckleOfflineLoader`, the converters and `UrlHelper` over `@speckle/objectloader2` 2.31.14, and `packages/sandbox` is a Vite page. Spike S2 is answered there: a three-object set (collection, data object, mesh) loads from memory with no server, renders, and a click returns the data object's `properties`. Spike S1 is not: the fork pins `three` 0.140.2; running on 0.185 is still open. Chunks W1 to W3 should build on the fork's core package rather than on `@speckle/viewer` from npm.
- 2026-10-11: Snowdon in the fork. Through Speckle objects (`tools/bos-to-speckle.mjs`, 794,873 objects, 340 MB JSON) the load took 188 s, 41 s of it in the Speckle converter removing 158,055 definition meshes from one collection (quadratic `indexOf`). The fork now loads BOS directly: `packages/bos` decodes the Parquet tables into an `InstancedModel` and the core's `InstancedModelLoader` builds the world tree from it, with per-object BVHs built lazily and timer-free yields. Snowdon in Node: decode 1.5 s, tree 1.7 s, render tree 3.6 s, batching 12.4 s; 456,598 objects in 563 draw calls. The remaining cost is the engine's per-object tree, render view and batch object. Criterion 14's comparison with bim-open-viewer should use this path, not the Speckle objects; H1's host-side converter is only needed for sending to Speckle, not for viewing.
