# perf-cdt: the constrained Delaunay seed without quadratic scans

Ticket: TKT-386
Status: ready: R4

## Done
- R4, (this commit), about 1.3 h against 2 h expected: `TriangulateRegionCdtIndexed(r, chart)` and
  its counted form `TriangulateRegionCdtIndexedCounted`, built from `CdtRingIndexedCounted` (holes
  bridged with the segments, their grid and the hole keys computed once), `HoleBridgedIndexedCounted`
  (ring positions tested nearest first, stopping at the first clear one), `BridgeIsClearOnGrid`
  (`BridgeIsClear` itself, asked of only the segments near the bridge), and
  `EarClippedIndexedCounted` (a linked ring with a frontier, a min-heap of slots to test again,
  and per-point watch lists). The triangles are identical to `TriangulateRegionCdt`'s, in the same
  order; no law needed a new verdict.
- Type added: `ChartGrid` (`triangulation-cdt-indexed.types.plato`), a uniform grid of chart boxes
  in CSR form (cell starts and items) with an Everywhere list for non-finite or wide items. It
  serves both lookups: boundary points for the ear test, boundary segments for the bridge test.
  F2's segment grid (`uv-collide`) works in tolerance units on the region, not in chart
  coordinates, and finds pairs by sorting entries, not by looking up a box, so it was not reused;
  only its `GridCellNumber` is.

## Merge instructions
- Move `triangulation-cdt-indexed.types.plato`, `triangulation-cdt-indexed.library.plato` and
  `triangulation-cdt-indexed.laws.plato` into `05-face-meshing/` as they are (the laws may keep or
  drop the `Law_Perf_` prefix).
- `TriangulateRegionCdt(r, chart)` => `r.TriangulateRegionCdtIndexedCounted(chart).Value` (or move
  the body of `TriangulateRegionCdtIndexedCounted` in and delete `TriangulateRegionCdtIndexed`).
- After the wiring, `HoleBridged`, `EarClipped` and `IsEar` (face-meshing.library.plato) have no
  library caller; the agreement laws read them (`CdtRingOriginal`, `CdtSeedAgreesOn`) as the
  reference. Keep them beside those laws, or delete them with the agreement laws once the merge
  has run green. `AllRingSegments` and `BridgeIsClear` stay: the indexed form calls both.

## Contract requests
- none

## Requests to other tracks
- none

## Verdicts
Interpreter (warm server, `--staging`, budget 20 s), filter `TriangulationCdtIndexedLaws,
BrepFoundationWorkLaws, TriangulatedWitnessLaws, TriangulationLaws, TriangulationFastLaws,
TriangulationFastMarksLaws, FaceMeshingLiftIndexedLaws, FaceMeshingLaws`: 85 laws, 84 pass, 1 fail.
The fail is `TriangulatedWitnessLaws.Law_RefinedInteriorMeetsMinAngle` on the cylinder's lateral
face, as in the baseline (`TriangulationLaws.Law_RefinedInteriorMeetsMinAngle fail k = 1` in
`verdicts-cpu64.tsv`, and L4's TRACK).

Compiled (pinned CLI e37c032f, `--backend=csharp --profile=cpu64 --budget=2`), filter
`TriangulationCdtIndexedLaws,Law_WorkIsWithinSlope,TriangulatedWitnessLaws,TriangulationFastMarksLaws,FaceMeshingLiftIndexedLaws,FaceMeshingLaws`:
"79 laws: 78 pass, 1 fail; backend csharp; 93 witnesses 1.5s; laws 3.3s summed, 1.7s wall; total
43.1s". The fail is the same baseline one. The slowest new law is
`Law_Perf_TriangulateRegionCdtIndexedAgreesOnStars` at 0.65 s over 14 cases.

- `Law_Perf_TriangulateRegionCdtIndexedAgrees` (42 `TriangulatedWitness` values, every face of
  the six sample models): the ring, the seed and the whole `UvTriangulation` (points, sources,
  triangles, quads) equal the witness's `Cdt`. Pass, both backends.
- `Law_Perf_TriangulateRegionCdtIndexedAgreesOnStars` (14 cases: notched stars of 12 to 60
  points, 1 to 3 holes, a point hole on odd cases), `...AgreesOnJagged` (14 cases: star-shaped
  loops of 16 to 48 points at pseudo-random radii, 0 to 2 square holes), `...AgreesWhenWoken` (a
  ten-point polygon): pass, both.
- `Law_Perf_StarCasesRetestSlots`: pass, both.
- `TriangulatedWitnessLaws` `Law_CdtKeepsBoundary`, `Law_CdtKeepsEverySegment`,
  `Law_CdtIsConforming`, `Law_CdtPositiveOrientation`, `Law_CdtNoFlippableEdge`,
  `Law_CdtAreaIsRegionArea`, `Law_UpdatedNeighboursAreTheTable` (L4 moved these from
  `TriangulationLaws` and `TriangulationFastLaws` while this chunk was built): pass, both.
- `TriangulationFastMarksLaws` (1), `FaceMeshingLiftIndexedLaws` (2), `FaceMeshingLaws` (46):
  every verdict as in `verdicts-cpu64.tsv`.
- Mutation checks, interpreter: with the watch-list wake-up removed, only `...AgreesWhenWoken`
  fails (the stars and models never need it); with the right neighbour's wake-up removed, the same
  law fails. Both restored before the runs above.

Count witness: `Witness_TriangulateRegionCdtWork`, slope `Insertions(12)` (bridge tests plus ear
tests per boundary point), sizes 32 and 128, a star of 3n/4 points between radii 2 and 1.6 with a
centred circular hole of n/4 points. Measured (by a Python replica of the same steps): 1 bridge
test and 53 ear tests at 32 (54), 1 and 230 at 128 (231), 1 and 934 at 512: 1.7 to 1.8 per point.
The old seed made 24 and 96 bridge tests (768 and 12,288 segment checks) and 96 and 1,226 ear tests
(2,065 and 108,388 point checks).

## Findings
- The ear order is EarClipped's: the first ear by position. A slot behind the frontier is a known
  non-ear (reflex, or blocked by a point still in the ring); it changes only when a neighbour is
  clipped (its triangle changes) or when its recorded blocker leaves the ring (watch list, keyed
  by point, checked against the slot's version). A Python replica of both orders agreed on 30,000
  random star polygons; 21 of them needed the watch lists, and one is `WatchedCase`.
- The count is of tests, as the chunk asked. The points a test visits are not O(1) on this
  family: EarClipped's first-ear order clips a fan from the ring's last slot, whose long triangles
  span the grid, so the points visited grow as about B^1.5 (15.7 per point at 32, 28 at 128, 62 at
  512; the old seed's were B^2 to B^3: 65 and 847 per point). An ear order that resumes where it
  left off (earcut's) would make the triangles local and the visits linear, but it changes the
  seed, so the Delaunay flips start elsewhere; with ties in the in-circle test (cocircular points,
  every regular polygon here), the final triangulation, and every refinement after it, could
  change. Left for a chunk that is allowed to change the triangulation.
- The grids skip only items more than one cell from a query box. `BridgeIsClear`'s
  `SegmentsIntersect` and `IsEar`'s `InClosedTriangle` are sign tests of rounded areas; a point or
  segment a full cell away can satisfy them only through rounding noise on nearly collinear
  points, which the original would then have counted. None of the laws' cases does.
- A distance that is not finite (a NaN chart point) makes the bridge test every position and take
  `HoleBridged`'s fold, because a stable sort with NaN keys does not give the fold's order.
- `TriangulateRegionCdt`'s point holes are still inserted by `WithPointInserted`, O(T) each, and
  `Delaunayed` is unchanged; neither was in this chunk.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, ticket, layer 05 code, primer, F2's grid and TRACK) | 25 min | |
| Writing (types, library, laws) | 30 min | |
| Python replica: watch-list witness search and work measurement | 10 min | 3 |
| Law runs, interpreter | 10 min | 8 (2 mutation runs) |
| Compiled run | 1 min | 1 (43 s total) |
| TRACK and commit | 10 min | |

## Lessons
- L4 merged while this chunk was built and moved the `Law_Cdt*` laws to `TriangulatedWitnessLaws`:
  a filter on `TriangulationLaws` then ran 3 laws, not 9, without a warning. Compare the law
  count per block with the expected count before trusting a pass.
- A mutation run (remove one wake-up, expect a failure) showed the first agreement cases never
  reached the watch lists; a quick replica in Python found a case in seconds.
