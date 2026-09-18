# Track T: shared test support and a BFAST reader

Checkpoint for the flow-demos follow-through wave. Checkout
`.claude/worktrees/table-graph-layers`, branch `worktree-table-graph-layers`,
builds under `--artifacts-path artifacts/agent-t`.

## State

| Chunk | State | Commit |
|---|---|---|
| T1a `tests/BimOpenToolkit.TestSupport` (RepoPaths, MiniIfc), solution entry, layering rule | committed | 4c1f04f |
| T1b replace the repo-root and mini-IFC copies in twelve test projects | committed | (T1b) |
| T2 `bfast.read`, `bfast.buffer`, fixture, demo graph, docs | pending | |

## T1a

Files: `tests/BimOpenToolkit.TestSupport/{BimOpenToolkit.TestSupport.csproj,RepoPaths.cs,MiniIfc.cs,README.md}`,
`BimOpenToolkit.sln`, `tests/BimOpenToolkit.Layering.Tests/{LayeringTests.cs,BimOpenToolkit.Layering.Tests.csproj}`.

Layering: `tests/BimOpenToolkit.TestSupport` sits outside the four groups, so
`Layering.GroupOf` names it by its folder. The rule now lets any group reference
that one target, justified by the new test `TestSupportReferencesNoSourceProject`,
which fails if the support project ever gains a project reference.

Checks: `dotnet test tests/BimOpenToolkit.Layering.Tests` 8 passed.

## T1b

Repo-root discovery removed from: `Nodes.Relations.Tests/SampleGraphTests.cs`,
`View3dWorkflows.Tests/View3dSampleTests.cs`, `NrcWorkflows.Tests/NrcPaths.cs`,
`TableWorkflows.Tests/SamplePaths.cs`, `BimWorkflows.Tests/{BimSampleAnalysesTests,BimSampleSeedingTests}.cs`,
`Host.Tests/{NrcSeedingTests,SamplePreparationTests}.cs` (the `FindRepoRoot(AppContext.BaseDirectory)!` lookups;
the `SeedIfEmpty(store, AppContext.BaseDirectory)` calls stay because they exercise the production walk),
`data/Ara3D.BimOpenSchema.DuckDb.Tests/IfcDuckDbBuildTests.cs`, and the two `.git`-walkers
`data/Ara3D.DoorClearance.Tests/TestPaths.cs` and `data/Ara3D.Ifc.Tests/TestData.cs`.
`TableWorkflows.Tests/SampleSeedingTests.FindRepoRoot_FromTestBinaries_FindsTheSolution` still
calls `SampleSeeding.FindRepoRoot` on purpose: it tests that function.

Mini IFC: `Nodes.Effects.Tests/WritePsets{,Typed}Tests.cs` use `MiniIfc.Wall` and `MiniIfc.WallId`;
the ten fixtures in `data/Ara3D.BimOpenSchema.Tests/IfcRelationsTests.cs` and the one each in
`IfcRoomJsonTests.cs` and `IfcToiletJsonTests.cs` keep their entity lines and get the header and
footer from `MiniIfc.Document(entities, schema, fileName, description)`; `IfcMeshingComparison/Tests/Support/MicroIfc.cs`
drops its own `Header`/`Footer` and builds `WrapData` the same way. Line endings are now CRLF
in every generated fixture (they were mixed in MicroIfc).

Checks (all `--no-build` after a per-project build under `artifacts/agent-t`):
Effects 54, Relations 30, TableWorkflows 61, Host 25, BimWorkflows 23, View3d 18, NrcWorkflows 30,
BimOpenSchema (not Slow) 30, DuckDb 20, DoorClearance 7, Ifc 11, IfcMeshingComparison (GoldenMesh) 65; all passed.

## Blockers, findings, requests

(none yet)
