# Track A — Model data

**Contract revision: nrc-1, including the "Contract amendments" section of
`docs/plans/nrc-handoff-wave.md`. Acknowledged before any write.**

State: verified (all four chunks implemented and checked; integration is the
supervisor's to assign).
Started from supervisor commit `8bcf1c9`.
Remaining work: none. No files are open for further edits.

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
| A2 build function | `ebdd3a6` | committed |
| A3 StoreyOfEntity view | `f697ec2` | committed |
| A4 fixture | pending (checkpoint only) | verified, no code change needed |

## Checks and results

All with `--artifacts-path C:\Users\cdigg\AppData\Local\Temp\claude\nrc-wave\track-a`.

- `dotnet test tests/data/Ara3D.BimOpenSchema.DuckDb.Tests` — 19 passed, 1 skipped
  (`FzkHaus_ConvertsAndAnswersViewQueries`; its model is not in this checkout's
  `data/`), 0 failed.
- `dotnet build src/mcp/BimOpenMcp.Ifc` — 0 errors (the `StoreyOfEntity` edit to
  `IfcDuck.cs`).
- `dotnet build tests/flow/BimOpenFlow.NrcWorkflows.Tests` — 0 errors.
- A4, through a throwaway NUnit test deleted before the commit: the fixture built
  `duplex-enriched.duckdb` into
  `%TEMP%\bimopenflow-nrc-tests\<guid>\duplex-enriched.duckdb` (file present), and
  `RelationRuntime.FromRoots(Fixture.Roots)` resolved `nrc` to
  `FileRoot samples\nrc` and `duplex-enriched` to `DuckDbFile <temp>\duplex-enriched.duckdb`.
  `Fixture.cs` needed no change and is committed as the supervisor wrote it.

## Running processes

None.

## Blockers

None.

## Findings

1. **A build with `--artifacts-path` puts test binaries outside the checkout**, where
   walking up from `AppContext.BaseDirectory` finds no `BimOpenToolkit.sln`.
   `IfcDuckDbBuildTests` locates `samples/nrc` from its own `[CallerFilePath]` for that
   reason. The supervisor had already fixed `NrcPaths` the same way in `b9fcf0f`, so
   nothing is outstanding: `NrcPaths.Root` resolved correctly under the private
   artifacts path when A4 exercised it. No request to the supervisor.

2. **The storey walk needs `MemberOf`, not just `ContainedIn` and `PartOf`.** The
   Duplex conversion produces **zero** `PartOf` relations. The IFC aggregation
   relation arrives as `MemberOf`: 21 `IFCSPACE -> IFCBUILDINGSTOREY`, 10 stair parts
   `-> IFCSTAIR`, 1 slab `-> IFCROOF`. Walking `ContainedIn` and `PartOf` alone places
   only 52 of the 103 Level 1 elements (146 of 218 overall), stranding all 61
   furnishing elements, 4 members, 4 railings, 2 stair flights and 1 slab — the same
   shape of undercount the proof-of-concept transcript recorded for question 2.
   `StoreyOfEntity` therefore walks `PartOf`, `MemberOf` and `ContainedIn`, and the
   view text says why. Relation direction: `EntityA` is the child, `EntityB` the
   container, so the walk follows `EntityA -> EntityB`.

3. **Raw per-storey counts exceed the CSV element counts.** With the three relation
   kinds, `StoreyOfEntity` holds 114 rows for Level 1, 104 for Level 2, 15 for T/FDN
   and 10 for Roof, against the CSVs' 103 / 93 / 14 / 8. The extra rows are the storey
   itself at depth 0, its `IFCSPACE` entities, and aggregates such as `IFCSTAIR` and
   `IFCROOF` — none of which the analytics CSVs list as elements. Joined by GlobalId
   through `EntityText` to `nrc_analytics_elements.csv` the counts match the CSVs
   exactly, storey for storey, with no element unplaced and none misplaced. Both the
   joined and the raw numbers are asserted, so the difference stays documented.
   Track E should join through the elements CSV, or filter the view to the categories
   it cares about, rather than counting `StoreyOfEntity` rows directly.

4. **The view SQL is shared, not copied.** `BimOpenMcp.Ifc` already references
   `Ara3D.BimOpenSchema.DuckDb`, so `IfcDuck.CreateViews` executes
   `BosDuckDbViews.StoreyOfEntitySql` instead of holding a second copy. The plan asked
   for the same view in both files; one definition is the stronger form of the same
   guarantee. The three older views stay duplicated — folding them in is a separate
   change and outside this fence.

5. **Every test run of `BimOpenFlow.NrcWorkflows.Tests` pays the IFC conversion.**
   `Fixture` is a `[SetUpFixture]`, so its `OneTimeSetUp` runs even for a filtered run
   of CSV-only tests, which costs roughly twenty seconds of whole-file parsing and
   geometry loading that those tests never use. Left as written to avoid changing a
   shared fixture while tracks B and E are building on it. Deferred design note: build
   the database behind a `Lazy<string>` the model-backed tests touch, so a CSV-only
   run skips it.

6. **`Fixture.Roots` also registers a source named after the temp folder's GUID.**
   `SourceRegistries.FromRoots` names a `FileRoot` after the folder, so the database
   directory contributes a meaningless source name beside `duplex-enriched`. Harmless
   — no graph can name it — and the host has the same shape for `samples/tables`.
   Recorded rather than worked around.
