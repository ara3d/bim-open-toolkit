# IFC mesher: accuracy first, then speed

Plan started 2026-10-11 from `ifc-mesher-roadmap.md`. Workflows served: 3 (a picture of the model is only as good as its mesh) and 5 (a claim needs another tool's number beside it). Goal 1 is accuracy against the four other meshers (two web-ifc builds, IFClite, IfcOpenShell); goal 2 is time. Code lives in `deps/bim-open-data` (`src/data/Ara3D.Ifc.Mesher`, `tests/data/Ara3D.Ifc.Mesher.Tests`, `tests/data/Ara3D.IfcMeshingComparison`, `bench/ifc-mesher`); commits land there with `Ticket:` trailers and the toolkit pin follows.

## Acceptance criteria

- Every quick-file parity in `bench/ifc-mesher/RESULTS.md` is at or above its committed floor (`ratchets.json`), and a drop fails a test.
- Every product where four meshers agree and ours differs is named in a committed discrepancy table with a cause or a ticket.
- B-spline curves with knots are evaluated, not approximated by their control polygon.
- AC20-FZK-Haus walls #67536 and #75347 are clipped by their roofs (TKT-188), measured against the web-ifc oracle.
- A warm timing per quick file and for Duplex exists under BenchmarkDotNet, with the web-ifc DLL beside it.

## Style rules for every chunk

Small files (under 200 lines) and small functions; pure functions over immutable types; `readonly record struct` for values that travel together (a plane as point and normal, a knot span, a sample count with a tolerance) instead of several scalar parameters; `IReadOnlyList<T>` on signatures; no LINQ in loops that run per triangle. House style: `~/.claude/skills/csharp-style/SKILL.md`.

## Baseline (2026-10-11, before wave 1)

Fast tests 143/143 in 3 s. Comparison parity, matrix, and example bounds tests: 13 pass, 1 fails (`Example_SharedEntityBoundingBoxesMatchOracle`, 115 of 116, pre-existing). Model files: `deps/bim-open-data/data/` and `ARA3D_IFC_TEST_DIRS=C:/Users/cdigg/git/ara3d/IFC-toolkit/test-files`.

## Wave 1 chunks

| Chunk | Ticket | Fence (under `deps/bim-open-data/`) | Test | Done |
|---|---|---|---|---|
| A | TKT-242 | `tests/data/Ara3D.IfcMeshingComparison/Harness/DiscrepancyTable*.cs`, `Harness/ProductDiscrepancy.cs`, `Tests/Comparison/DiscrepancyTableTests.cs`, `bench/ifc-mesher/discrepancies/**` | `DiscrepancyTableTests` | tables committed; TKT-65's products named |
| C1 | TKT-243 | `src/data/Ara3D.Ifc.Mesher/BSplineCurves.cs`, `BSplineEvaluator.cs`, `GeometryCoverage.cs`; `tests/data/Ara3D.Ifc.Mesher.Tests/BSplineCurveTests.cs` | `BSplineCurveTests` | NURBS quarter circle within 1e-4; coverage rows Supported |
| C2 | TKT-188 | `src/data/Ara3D.Ifc.Mesher/Booleans*.cs`, `AggregatedVoidHosts.cs`, `OpeningCarver.cs`; `tests/data/Ara3D.Ifc.Mesher.Tests/BooleanTests.cs`; `tests/data/Ara3D.IfcMeshingComparison/Tests/Corpus/FzkHausRoofClipTests.cs` | `FzkHausRoofClipTests` | the two walls' bounds within 5 % of web-ifc's |
| D1 | TKT-244 | `bench/ifc-mesher/Ara3D.Ifc.Mesher.Benchmarks/**`, `bench/ifc-mesher/timing.md`, `timing.json` | the benchmark runs | warm numbers committed |
| E1 | TKT-245 | `bench/ifc-mesher/ratchets.json`, `tests/data/Ara3D.IfcMeshingComparison/Tests/Comparison/ParityGates.cs` | `ParityGates` | floors read from the file |

Shared files no fence names (the supervisor writes them): `BimOpenData.sln`, `bench/ifc-mesher/RESULTS.md`, `README.md` files, `GeometryCoverage.cs` for any chunk but C1, `docs/nodes*`. Builders report the line they would add.

## Wave 2 (after wave 1)

Track B (kernel extraction into `Ara3D.MeshKernel`) waits for C2, since both touch `Booleans.cs` and `OpeningCarver.cs`. Track C items come from A's tables. D2 and D3 (profile, then products in parallel) wait for D1's numbers.

## Build log

| Chunk | Commit | Result |
|---|---|---|
