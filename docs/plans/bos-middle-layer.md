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

Off limits until their owner commits: `src/data/Ara3D.BimOpenSchema.IO/ParquetUtils.cs`, `src/data/Ara3D.BimOpenSchema.Federation/BosUnion.cs`, `tests/data/Ara3D.BimOpenSchema.IO.Fragments.Tests/DuplexFixtureTests.cs`, `tests/mcp/BimOpenMcp.Ifc.Tests/BosFileToolTests.cs` (session "Web USD viewer", 24157cfb).

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

## Wave record
