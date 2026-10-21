# perf-constrained: boundary questions by table and grid, the in-circle test without allocation

Ticket: TKT-385
Status: ready: R3

## Done
- R3, (this commit), about 1.5 h against 2 h expected: ranked candidate 28 of
  `docs/plans/step-mesher-complexity.md`.
  - Type added: `BoundaryIndex` (`uv-boundary-index.types.plato`): a region under its tolerance
    with the next-boundary table, each boundary segment's end and loop, the boundary points raw
    and in tolerance units, and R4's `ChartGrid` of the segments' boxes in tolerance units grown
    by 2 units. It replaces the region and tolerance as the argument of the boundary questions, so
    the index is built once per refinement.
  - `uv-boundary-index.library.plato` (library `UvBoundaryIndex`): `LoopOffsets`, `SegmentEnds`,
    `SegmentLoops`, `NextBoundaryTable(r)` (the next boundary point of each boundary point on a
    loop of three or more points, else -1), `IsConstrainedIn(next, a, b)` (two table reads) and
    `IsConstrainedInCounted`, `IsBoundarySegmentBody(r, a, b)` (one pass over the loops, O(L), for
    callers without a table), `BoundaryIndexOf(r, tol)`, `IsStrictlyInsideIndexed(x, uv)` and
    `IsStrictlyInsideOnGrid` (gap only to the segments near uv's cell; ray crossings only in uv's
    grid row, each segment counted once at its first cell in the scanned range, plus Everywhere),
    `InCircleOfFourSorted` / `InCircleOfSorted` (a five-step sorting network on locals, parity
    from the six pairwise comparisons, no allocation), `IsFlippableCdtIndexed`,
    `DelaunayedIndexed(next, points, tris)`, `SplitSideSlotIndexed`, `SplitSideSlotOfIndexed`.
  - `triangulation-built-indexed.library.plato` (library `TriangulationBuiltIndexed`):
    `SurfaceFallbackIndexed`, `IsFlippableFourIndexed`, `FlipCavityIndexed`,
    `TryInsertionIndexed`, `SurfacePassIndexedCounted`/`SurfacePassIndexed`,
    `AnglePassIndexedCounted`/`AnglePassIndexed`, `RefineToSurfaceByInsertionIndexed`: R1's
    bodies with a `BoundaryIndex` (or its `Next`) in place of the region and tolerance.
  - `uv-boundary-index.laws.plato` (library `BoundaryIndexLaws`): agreement laws and the two count
    witnesses (see Verdicts).
  - The old functions stay as the references the agreement laws compare against.

## Merge instructions
- Move `uv-boundary-index.types.plato`, `uv-boundary-index.library.plato` and
  `triangulation-built-indexed.library.plato` into `05-face-meshing/` as they are; move
  `uv-boundary-index.laws.plato` too (the laws may drop the `Law_Perf_` prefix).
- `triangulation-fast.library.plato` `RefineToSurfaceByInsertion` => `=> m.RefineToSurfaceByInsertionIndexed(f, r, chart, t, c);`
- `triangulation-cdt-indexed.library.plato` `TriangulateRegionCdtIndexedCounted`: `r.Delaunayed(points, ...)` => `r.NextBoundaryTable.DelaunayedIndexed(points, ...)` (`BoundaryIndexLaws.CdtWithIndexedFlips` is that body).
- `uv-regions.library.plato` `IsBoundarySegment(r, a, b)` => `=> r.IsBoundarySegmentBody(a, b);` (O(L) for every caller left on the region: `TriangleNeedsRefinement`, `IsFlippableCdt` in `FlippableEdgeCount`, `SidesSharedByNeighbours`, `Law_BoundarySegmentIsElementSide`). `LoopOfBoundaryPoint` and `NextBoundaryPoint` keep their bodies; `ConstrainedAgreesOn` compares the table with `NextBoundaryPoint`.
- `triangulation-cdt.library.plato` `InCircleOf(points, a, b, c, d)` => `=> points.InCircleOfSorted(a, b, c, d);`, and `triangulation-built.library.plato` `InCircleOfFour(...)` => `=> InCircleOfFourSorted(a, b, c, d, pa, pb, pc, pd);`. Do these after the agreement law has run green on the merged tree, or keep the old bodies under other names for `Law_Perf_InCircleOfSortedAgrees` to compare against; once wired, the law compares a function with itself and can be dropped.
- After the wiring, `TriangulationBuilt`'s `TryInsertionInto`, `FlipCavity`, `SurfaceFallbackIn`, `SplitSideSlotOf`, `IsFlippableFour` and the `...Built` passes have no caller but `InsertionBuiltLaws`; R1's merge note already proposes pointing `UvDelaunay.SplitSideSlot` at `SplitSideSlotOf`: point it at `SplitSideSlotIndexed` instead only for callers that hold a table (`TriangulationFast.SurfaceFallback` has none; leave it).

## Contract requests
- none. Every replacement has a new name; the wiring above keeps every existing signature.

## Requests to other tracks
- R2 (TKT-384, `TriangleNeedsRefinementCached`): it calls `r.IsConstrained` three times per triangle. Take the region's `NextBoundaryTable` (built once per refinement in `RefineToSurfaceByInsertionIndexed` as `x.Next`) and call `next.IsConstrainedIn(a, b)`; until then the `IsBoundarySegment` wiring above makes each call O(L). Not blocking.

## Verdicts
Interpreter (warm server, `--staging sandbox/step-mesh-staging/perf-constrained --budget 20`):
filter `BoundaryIndexLaws,Law_WorkIsWithinSlope,TriangulatedWitnessLaws,TriangulationLaws,InsertionBuiltLaws,TriangulationCdtIndexedLaws,Law_BoundarySegmentIsElementSide,Law_InteriorSideIsShared`: 50 laws, 49 pass, 1 fail (the plane laws were trimmed after this run; the final `BoundaryIndexLaws,Law_WorkIsWithinSlope` run: 14 laws, 14 pass). The fail is `TriangulatedWitnessLaws.Law_RefinedInteriorMeetsMinAngle` on the cylinder's lateral face, as in `verdicts-cpu64.tsv` (k = 1). Every law the chunk names keeps its verdict: `Law_CdtNoFlippableEdge`, `Law_RefinedNoFlippableEdge`, `Law_CdtKeepsEverySegment`, `Law_RefineMeetsContract` (42 witnesses each), `Law_InCircleOfAgreesWithInCircle`, `Law_FlipNeverUndone`, `Law_InCircleWitnesses`, `Law_BoundarySegmentIsElementSide`, `Law_InteriorSideIsShared`, `InsertionBuiltLaws` (4), `TriangulationCdtIndexedLaws` (5): pass.

Compiled: from `C:/Users/cdigg/git/plato`, `dotnet C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll run stdlib/foundation stdlib/geometry stdlib/graphics C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-mesh-staging/perf-constrained --recursive --exclude=brep.types.plato --exclude=brep.library.plato --exclude=brep.concepts.plato --laws --backend=csharp --profile=cpu64 --budget=2 --filter=BoundaryIndexLaws,Law_WorkIsWithinSlope,TriangulatedWitnessLaws,TriangulationLaws,InsertionBuiltLaws,TriangulationCdtIndexedLaws,Law_BoundarySegmentIsElementSide,Law_InteriorSideIsShared`: "51 laws: 50 pass, 1 fail; laws 17.3s summed, 3.2s wall; total 53.0s", the fail the same baseline one. After the last trim, `--filter=BoundaryIndexLaws,Law_WorkIsWithinSlope`: "13 laws: 13 pass; laws 8.7s summed, 2.5s wall; total 59.0s"; slowest `Law_WorkIsWithinSlope` 1.47 s over 29 cases (every chunk's witnesses), `Law_Perf_IsStrictlyInsideIndexedAgreesOnStars` 1.33 s, `Law_Perf_IsStrictlyInsideIndexedAgrees` 1.03 s, the rest under 1 s. The compiled run reports "1 degraded bodies", as R1's and F4's did.

- `Law_Perf_IsConstrainedInAgrees` (42 `TriangulatedWitness`): `IsConstrainedIn` is `IsConstrained`, and `IsBoundarySegmentBody` is `IsBoundarySegment` both ways, at every side of `Cdt` and `Refined` and along the boundary (each index from -1 to B + 1 against its neighbours, -1, 0 and its `NextBoundaryPoint`); the table's entries are `NextBoundaryPoint`'s.
- `Law_Perf_IsConstrainedInAgreesOnStars` (14): every index pair of R4's `StarCase(k % 5)` (holes and a point hole), and the boundary pairs and triangulation sides of `JaggedCase(k)`.
- `Law_Perf_IsStrictlyInsideIndexedAgrees` (42): under the face's region tolerance, at every point, triangle centroid and side midpoint of `Refined`, and at 12 probes per boundary point within 1.5 tolerance units of it or of its segment's midpoint.
- `Law_Perf_IsStrictlyInsideIndexedAgreesOnStars`, `...OnJagged` (14 each): `StarCase(k % 3)`, `JaggedCase(k % 4)` under tolerance (0.01, 0.02), an 11 x 11 lattice past the region's box and the near-boundary probes; for the star also a zero tolerance (index not usable), which answers through the region. The sizes are capped because the reference scans every segment per probe.
- `Law_Perf_InCircleOfSortedAgrees` (random `Point2D` quadruples): all 256 index quadruples over four points, repeats included, `InCircleOfSorted == InCircleOf` exactly, and `InCircleOfFourSorted == InCircleOfFour` with the indices renamed 11, 4, 23, 7.
- `Law_Perf_DelaunayedIndexedAgrees` (42): the seed flipped by `DelaunayedIndexed` is the witness's `Cdt`, field for field. `...OnStars` (14): the same against `TriangulateRegionCdt` on the star and jagged regions.
- `Law_Perf_SplitSideSlotIndexedAgrees` (42): both split-side forms equal the originals at every triangle of `Cdt` and `Refined`.
- `Law_Perf_RefineIndexedAgrees` (42): `RefineToSurfaceByInsertionIndexed` from `Cdt` is the witness's `Refined`, point for point and triangle for triangle. `...OnStars` (14): the same against `RefineToSurfaceByInsertion` on the unit box's plane face 0 with `StarCase(k % 5)` moved into the unit square.
- `Law_Perf_ThirteenHolesAgree` (1 case): on the count witnesses' 13-hole region, built once, `IsConstrainedIn` along the boundary and at the triangulation's sides, the flips with the table, and the refinement on the plane face all agree with the originals.
- Mutation check, interpreter: counting a segment at every cell of the row it is listed in (the dedupe removed) fails `...IsStrictlyInsideIndexedAgrees` on its first witness and both plane laws on their first case; restored before the runs above. Growing the boxes by 0 instead of 2 units still passes: `ItemsNear` grows the query by a whole cell, so the margin is a second guard, not the only one.

Count witnesses: `Witness_IsConstrainedInOneHoleWork` and `Witness_IsConstrainedInThirteenHolesWork`, slope `Insertions(2)` (table entries read per query; the dispatch named `Insertions(1)`, but the test reads both directions, so two reads is what the function needs), sizes 64 and 512 queries on `HolesRegion(1)` (52 boundary points) and `HolesRegion(13)` (100). Queries mix boundary segments, other boundary pairs, indices past the boundary and -1, so the measured work is at most 2n: n reads for a pair with one index out of range, 2 for the rest. The old `IsConstrained` folded over the L loops in `LoopOfBoundaryPoint` up to six times per query, each step recomputing `LoopOffset` (a fold over the loops before it): O(L^2) loop visits per query, about 49 times more with thirteen holes (14 loops) than with one (2 loops).

## Findings
- No floating-point result changes. `IsStrictlyInsideOnGrid` evaluates `EdgeCrossesRay` and `DistanceToSegment` on the same numbers as `LoopContains` and `GapToLoop`; it skips only segments whose grown box misses uv's neighbourhood, which can neither be within one unit of uv nor be crossed by its ray (a crossing segment covers uv's row and, up to rounding of far less than the 2-unit margin, reaches past uv). The parity per loop and the all-gaps test are the originals' conjunction. A non-finite point, a non-positive tolerance, or a non-finite uv falls back to `IsStrictlyInside`, so NaN behaves as before.
- `InCircleOf`'s ranks with ties broken by position, and its inversion count with strict comparisons, are reproduced exactly: equal indices name the same point, so any correct sort picks the same four points, and the parity is the same six-comparison count.
- The row scan for crossings is O(columns + segments in the row), about O(sqrt B) on the grid's one-cell-per-item layout; segments covering more than 16 cells (a box face's four long sides) sit in Everywhere and are tested on every query, as in R4's bridge test.
- `NeedsRefinement` / `TriangleNeedsRefinement` still take the region (R2's chunk); see Requests.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, ticket, R1 and R4 TRACKs, layer 05 code, primer) | 20 min | |
| Writing (type, two libraries, laws) | 30 min | |
| Interpreter law runs | 15 min | 9 (2 mutation runs; 4 returned "0 laws" while other sessions edited the library and were rerun) |
| Compiled runs | 5 min | 4 (about 60 s each; two found laws over 2 s, trimmed) |
| Waiting | 0 min | |

## Lessons
- The warm server answered "0 laws" on the first run after each edit and ran them on the second, with no parse error; rerun once before reaching for the CLI.
- The reference `IsStrictlyInside` is O(B) per probe, so the plane agreement laws hit the interpreter's 20 s budget, and then the compiled 2 s budget, at 23 x 23 lattices over 60-point stars and with the 13-hole region rebuilt per case; the probe set, not the staged code, set the time. A value used by every case belongs in a one-case law (`_: Integer`) or a witness.
