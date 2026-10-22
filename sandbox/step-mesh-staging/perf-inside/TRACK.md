# perf-inside: the inside test with no allocation per query (idea 31)

Ticket: TKT-407
Status: merged: TKT-407 (2026-10-21, into 05-face-meshing/uv-boundary-index-inside.{types,library,laws}.plato; IsStrictlyInsideOnGrid delegates to IsStrictlyInsideOnGridInPlace, the old body kept as IsStrictlyInsideOnGridReference for the agreement laws, renamed Law_InsideOnGridAgrees*)

## Done
- TKT-407, this commit, about 0.5 h against 1 h plus the law expected. Idea 31 of `docs/plans/step-mesher-ideas-evaluation.md`. Run E measured `IsStrictlyInsideOnGrid`'s gap part on ODIN-W160 at 313 ms (23% of refinement) and 1 GB allocated.
  - `inside-on-grid.types.plato`: `LoopCrossings` (the two smallest loops above a threshold that one ray scan crosses, their crossing counts, and the crossings of every loop above the threshold). It replaces the `List<Integer>` of crossed loops.
  - `inside-on-grid.library.plato` (library `UvBoundaryIndexInside`):
    - `IsStrictlyInsideOnGridCounted(x: BoundaryIndex, uv: UvCoordinate): Counted<Boolean>` and `IsStrictlyInsideOnGridInPlace(x, uv): Boolean` (its `.Value`), the wiring target.
    - Helpers: `NextCrossedLoopCounted` (one scan of uv's grid row from the column before uv, each segment once at its first listed cell, then `Everywhere`, as the original scans), `WithCrossing`, `ParityHolds`, `CrossingParityOnGridCounted`, `SegmentIsClearOf`, `IsClearOnGridCounted`.
    - The parity comes first. Each scan settles two loops in increasing order and stops at the first failing loop, or when the scan saw no third loop. An inside point whose ray crosses the outer loop and at most one hole therefore takes one scan, as the original did.
    - The gap test runs only for points the parity puts inside. It reads `Starts` and `Items` of the 3 x 3 cells `ItemsInCells` would list, in the same order, then `Everywhere`, or every segment when u is not finite (`ItemsNear`'s other branch), and stops at the first segment within one unit.
    - No array or list is allocated. `Counted`, `WorkBudget` and `LoopCrossings` are structs in the C# writer.
  - `inside-on-grid.laws.plato` (library `InsideOnGridLaws`):
    - `Law_Perf_InsideOnGridAgrees` runs on every `TriangulatedWitness`, under the face's region tolerance. The probes are `InsideProbes` of both the refined and the constrained triangulation: their points, triangle centroids and side midpoints, and `NearBoundary`, which moves every boundary point and segment midpoint by -1.5 to 1.5 units on both sides of the boundary.
    - `Law_Perf_InsideOnGridAgreesOnStars` runs on star case k % 5 and jagged case k % 4 at an 11 x 11 lattice plus `NearBoundary`, and on `HolesRegion(13)` at a 21 x 21 lattice, where a ray crosses several holes and the parity takes several scans.
    - `Law_Perf_InsideOnGridAgreesOnWideSegments` runs on `LongSideRegion(96)`, a square whose bottom side is in `Everywhere` (the law asserts that).
    - `Law_Perf_InsideOnGridAgreesBeyondTheGrid` uses probes at finite parameters whose tolerance units overflow, which is `ItemsNear`'s every-segment branch.
    - Every case is an exact Boolean match with `IsStrictlyInsideOnGrid` under a usable index.
  - Count witness `Witness_InsideOnGridWork`, slope `Insertions(4)`, sizes 64 and 1024. Insertions counts segments read by the parity's row scans plus segments measured by the gap test; no element is copied.
    - The family is `CircleWithHole(n)`, n boundary points, with ceil(sqrt(n)) queries at pseudo-random points in [-2.3, 2.3] squared.
    - The claim is about 4 sqrt(B) segments per query. A cell along a curve lists about sqrt(B) segments because the grid has about sqrt(B) columns. A full scan at B per query fails it at 1024.
    - Measured on the interpreter: 219 at 64 (3.4 sqrt(B) per query), 631 at 256 (2.5), 2723 at 1024 (2.7), 4096 points 14260 (3.5).
  - Interpreter, from the repository root: `python -I sandbox/step-brep-mesh/tools/plato_laws.py "InsideOnGridLaws,Law_WorkIsWithinSlope,BoundaryIndexLaws" --staging sandbox/step-mesh-staging/perf-inside --budget 20`. 17 laws, 17 pass, 0 type errors. `BoundaryIndexLaws` keeps its baseline verdicts (all pass).
  - Compiled, from `C:/Users/cdigg/git/plato`: `dotnet C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll run stdlib/foundation stdlib/geometry stdlib/graphics C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-mesh-staging/perf-inside --recursive --exclude=brep.types.plato --exclude=brep.library.plato --exclude=brep.concepts.plato --laws --backend=csharp --profile=cpu64 --budget=2 --parallel=1 --filter=InsideOnGridLaws,Law_WorkIsWithinSlope,Law_IsStrictlyInsideIndexedAgrees`
    - Results: 8 laws, 7 pass, 1 budget error (`Law_WorkIsWithinSlope`, see Findings).
    - Times for the staged laws: `Law_Perf_InsideOnGridAgreesOnStars` 0.60 s over 14 cases, `Law_Perf_InsideOnGridAgrees` 0.40 s over 42, `Law_Perf_InsideOnGridAgreesOnWideSegments` 0.21 s over 1, `Law_Perf_InsideOnGridAgreesBeyondTheGrid` 0.00 s over 14.
    - The original inside laws in the same run: `Law_IsStrictlyInsideIndexedAgrees` 1.42 s, `...OnStars` 1.00 s, `...OnJagged` 0.55 s.
    - The witness alone, both sizes, in a throwaway law: 0.19 s.

## Merge instructions
- Move the three `.plato` files to `05-face-meshing/uv-boundary-index-inside.{types,library,laws}.plato`.
  - The library calls `CrossesRayAt`, `GridCellClamped`, `IsFiniteBox`, `DistanceToSegment` and `InToleranceUnits`.
  - The laws call `InsideProbes`, `NearBoundary`, `Lattice`, `PlaneTolerance` and `HolesRegion` of `BoundaryIndexLaws`, plus `StarCase`, `JaggedCase`, `StarLoop` and `JitterAt` of the CDT-indexed laws.
- `uv-boundary-index.library.plato` `IsStrictlyInsideOnGrid`: replace its body with `=> x.IsStrictlyInsideOnGridInPlace(uv);`.
  - Better: move `IsStrictlyInsideOnGridCounted`'s body into it and delete `IsStrictlyInsideOnGridInPlace`, keeping the counted form for the witness.
- Then the four `Law_Perf_InsideOnGridAgrees*` laws compare a function with itself. Delete them, or keep the old body as `IsStrictlyInsideOnGridReference` for them, and rename the kept laws to `Law_InsideOnGridAgrees*`.
  - `BoundaryIndexLaws.Law_IsStrictlyInsideIndexedAgrees*` still checks the wired function against UvRegions' `IsStrictlyInside`, the full-scan reference.

## Contract requests
- none.

## Requests to other tracks
- none.

## Findings
- **The verdict is bit-identical by construction.**
  - Every Number compared is computed by the same call on the same arguments: `DistanceToSegment(x.Units[s], x.Units[x.SegmentEnd[s]], u) > 1.0` and `x.CrossesRayAt(s, p)`. Its row and column come from the same `GridCellClamped` calls.
  - The gap test visits the same segments, the `ItemsNear(u, u)` cells and `Everywhere`, or every segment.
  - The parity counts each segment of the row scan at the same cell as the original, so each loop's crossing count is the original's.
  - Only the order of evaluation changes: parity before gap, early exit. Both tests are pure, so the conjunction is the same Boolean.
  - The laws found no disagreement on any probe.
- **The parity needs per-loop counts.** The original's verdict is: loop 0 crossed an odd number of times and every other loop an even number. A crossing counter per loop needs storage (`Integer` is 32 bits, so no bitmask for 33 or more loops).
  - Instead, each scan keeps the two smallest loops above the last one settled, plus a total for all loops above it. That is exact for any number of loops.
  - A ray that crosses k distinct holes takes about (k + 1) / 2 scans, against the original's one scan and one list.
  - The first version settled one loop per scan, which made the row scan two to three times as long for points inside holed faces. The two-loop tally with the total gives one scan whenever at most one hole is crossed.
  - If ODIN-W160's faces have many holes on one row, the harness will show the parity part rising above run E's 88 ms. Then the next step is a per-query fixed tally of more slots, or a per-index loop-parity buffer reused across queries (which needs a field on `BoundaryIndex`, a contract change).
- **The row scan's cost is sqrt(B), not constant.** A cell along a curved boundary lists about sqrt(B) segments, since `ChartGridOf` makes about sqrt(B) columns.
  - So both this chunk's gap test and R3's row scan read O(sqrt(B)) segments per query, and the witness claims that much. The original also did, plus the copy.
  - On the zigzag `StarWithHole` family the per-query reads grew faster than sqrt(B) (33 at 64 points, 204 at 1024): its 0.4-wide notch band packs more segments into each shrinking cell. That is why the witness uses a smooth `CircleWithHole`.
- **`Law_WorkIsWithinSlope` is over the 2 s compiled budget as a whole.** It took 2.54 s in one serial run and 5.43 s in the next, over all 42 claims; this chunk's witness is 0.19 s of it. In the same loaded runs `Law_ThirteenHolesAgree`, which this chunk does not touch, took 2.60 s, and in the parallel run every original inside law went over 2 s. The machine was shared with two other builders' compiles. `reviews/verdicts-cpu64.tsv` records no times, so this run cannot tell whether the slope law was over budget before this witness. A sweep on an idle machine decides; if it is still over, the claims need splitting into blocks, a defect of the law layout, not of this witness.
- The `TriangulatedWitness` laws ran over 6 cases in one interpreter run and 42 in the others. The witness list in layer 05 was probably being edited by another agent at the time; the compiled runs used 42.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (ticket, brief, README, evaluation run E, R2's track, the function, the grid, the laws, the primer's control flow) | 10 min | |
| Writing (types, library, laws, the two-loop tally, the witness family, TRACK.md) | 15 min | |
| Interpreter law runs | 6 min | 6 (2 to read the counts in binary, one per tally design) |
| Compiled runs | 11 min | 3 (203 s parallel, 255 s serial, 190 s for the witness's own time) |
| Waiting | 0 min | |

## Lessons
- The compiled CLI's per-law times depend on load: run with `--parallel=1` when other builders are compiling, or every law near 1 s reads as over budget.
- A count witness over a grid needs a smooth-boundary family; a notched star makes per-cell lists grow with B and hides the real slope.
