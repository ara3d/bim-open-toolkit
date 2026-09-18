# Track A — Model data

**Contract revision: nrc-1, including the "Contract amendments" section of
`docs/plans/nrc-handoff-wave.md`. Acknowledged before any write.**

State: working
Started from supervisor commit `8bcf1c9`.

## Scope

- A1 copy the five CSVs and `duplex-enriched.ifc` into `samples/nrc/` with a README.
- A2 fill in `src/data/Ara3D.Ifc.DuckDb/IfcDuckDbBuild.cs` plus a new test file.
- A3 add the `StoreyOfEntity` view to `BosDuckDbViews.cs` and `IfcDuck.cs`, with a test.
- A4 verify `tests/flow/BimOpenFlow.NrcWorkflows.Tests/Fixture.cs`.

## Files owned

- `samples/nrc/**`
- `src/data/Ara3D.Ifc.DuckDb/IfcDuckDbBuild.cs`
- `StoreyOfEntity` in `src/data/Ara3D.BimOpenSchema.DuckDb/BosDuckDbViews.cs`
- `StoreyOfEntity` in `src/mcp/BimOpenMcp.Ifc/IfcDuck.cs`
- `tests/data/Ara3D.BimOpenSchema.DuckDb.Tests/IfcDuckDbBuildTests.cs`
- `tests/flow/BimOpenFlow.NrcWorkflows.Tests/Fixture.cs`
- this checkpoint

## Chunk commits

| Chunk | Hash | State |
|---|---|---|
| A1 samples | `48f7a1f` | committed |
| A2 build function | pending | implemented, verified |
| A3 StoreyOfEntity view | — | not started |
| A4 fixture | — | not started |

## Checks and results

`dotnet test tests/data/Ara3D.BimOpenSchema.DuckDb.Tests --artifacts-path C:\Users\cdigg\AppData\Local\Temp\claude\nrc-wave\track-a`
— 16 passed, 1 skipped (`FzkHaus_ConvertsAndAnswersViewQueries`, its model is not in
this checkout's `data/`), 0 failed.

## Running processes

None.

## Blockers

None.

## Findings

1. **A build with `--artifacts-path` puts test binaries outside the checkout.**
   `SampleSeeding.FindRepoRoot(AppContext.BaseDirectory)` then finds no
   `BimOpenToolkit.sln` and returns null, so `NrcPaths.Root` throws. Tracks B and E
   will hit this the moment they run `BimOpenFlow.NrcWorkflows.Tests` with a private
   artifacts path. `IfcDuckDbBuildTests` sidesteps it by locating `samples/nrc` from
   its own `[CallerFilePath]`. Requested of the supervisor: either drop the private
   artifacts path for that project, or let `NrcPaths` fall back to `[CallerFilePath]`
   (`NrcPaths.cs` is supervisor-owned).
