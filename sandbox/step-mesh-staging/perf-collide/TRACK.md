# perf-collide: colliding boundary segments found once, on a uniform grid

Ticket: TKT-361
Status: ready: F2

## Done
- F2, (this commit), about 1.5 h against 2 h expected: `CollidingSegments(r, tol)` and its counted
  form, `IsSimpleRegionIndexed`, `SelfIntersectionRequestsFrom`, `MeshRegionBody`. Types added:
  `RegionSegment` (the (loop, index) pair every segment test passed as two Integers), `SegmentBox`
  (a segment's grown box in tolerance units), `SegmentGridEntry` (a segment in one grid cell).
  Laws: see "Verdicts" below.

## Merge instructions
- `uv-collide.types.plato`, `uv-collide.library.plato`, `face-meshing-collide.library.plato` move to
  `05-face-meshing/` as they are; `uv-collide.laws.plato` moves there too, with the `Law_Perf_`
  prefix dropped (it reads layer 07's `CatalogLoopAt` and `CatalogRegionAt` and layer 08's
  `RelativeMeshingOptions`, so it may instead go to `07-validation/`).
- `IsSimpleRegion(r, tol)` => `r.IsSimpleRegionIndexed(tol)` (then fold the body in and delete `IsSimpleRegionIndexed`).
- `SelfIntersectionRequests(m, f, d, r, tol)` => `m.SelfIntersectionRequestsFrom(f, d, r, r.CollidingSegments(tol))`.
- `MeshRegion(m, f, d, c)` => `m.MeshRegionBody(f, d, c)` (or move the body in; `NotSimpleOutcome` stays beside it).
- `EdgeCollides` has no caller left after the second line; delete it. `SegmentCollides` stays: the
  agreement laws read it as the reference, and the all-pairs fallback is its definition.
- Update the comment on `IsSimpleRegion` ("O(n^2) as written; a sweep is the implementation").

## Contract requests
- none

## Requests to other tracks
- R4 (TKT-386, `TriangulateRegionCdtIndexed`): the segment grid here (`SegmentBoxes`,
  `GridCellSize`, `GridOrigin`, `GridEntriesOf`, `CellRunEnd`) is reusable for its visibility tests.
  Not blocking.

## Verdicts
Interpreter: warm server, `--staging`, budget 20 s, 43 laws: 29 pass, 14 error. Every error is a
PolesLaws whole-model meshing law over its time budget. Compiled: pinned CLI, `--backend=csharp
--budget=2`, 20 laws: 20 pass, 1.2 s wall in total ("20 laws: 20 pass; backend csharp; laws 2.2s
summed, 1.2s wall"); the slowest is `Law_Perf_CollidingSegmentsAgreesOnModel` at 1.16 s over 14 cases.

- `UvRegionCollisionLaws.Law_Perf_CollidingSegmentsAgrees` (14 shapes): pass, both backends
- `UvRegionCollisionLaws.Law_Perf_CollidingSegmentsAgreesOnCatalog` (25 cases): pass, both
- `UvRegionCollisionLaws.Law_Perf_CollidingSegmentsAgreesOnModel` (14 model witnesses, every face): pass, both
- `UvRegionCollisionLaws.Law_Perf_MeshRegionBodyAgrees` (unit box faces, meshed): pass, both
- `UvRegionCollisionLaws.Law_Perf_CollidingSegmentsVisitsFewerPairs`: pass, both
- `BrepFoundationWorkLaws.Law_WorkIsWithinSlope` (3 claims, with `Witness_CollidingSegmentsWork`): pass, both
- FaceMeshingLaws `Law_MeshedFaceHasSimpleRegion`, `Law_RegionSegmentsSeparated`,
  `Law_BlockingRequestMeansEmptyMesh`, `Law_HoleInsideOuter`, `Law_RequestHasDiagnostic`,
  `Law_RequestsNameFaceEdges`, `Law_MeshFaceReadsOnlyFaceEdges`: pass on both, as in `verdicts-cpu64.tsv`
- `BrepCheckingProofsRegionsLaws` (7 laws): pass on both, as in `verdicts-cpu64.tsv`
- `PolesLaws`: the 9 region and limit-normal laws pass, as in the baseline. Two differ from
  `verdicts-cpu64.tsv`: `Law_ConeGaussBonnet` (baseline pass) and `Law_ConeFaceChecksHold`
  (baseline fail) are now time-budget errors, at 20 s and again alone at 60 s, inside
  `RefineToSurfaceByInsertion`. Neither law reaches staged code: nothing in the library calls a
  function of this folder, and no name declared here exists elsewhere, so no overload changed.
  The machine ran 43 dotnet processes (other builders) during these runs. A run without
  `--staging` was started to confirm and had not returned when this was committed.

Count witness: `Witness_CollidingSegmentsWork`, slope `Insertions(8)` (segment pairs visited per
boundary segment), sizes 32 and 128 on a regular polygon of radius 1 at tolerance 0.001. Measured:
32 pairs at 32 segments, 128 at 128 (one per segment, the two neighbours of each segment sharing a
cell); the all-pairs form visits n^2 (1,024 and 16,384).

## Findings
- The result is identical by construction, not up to a tolerance: every pair the grid tests is
  tested with `SegmentsSeparated` in the two orders `SegmentCollides` uses, and a pair it skips
  has grown boxes that do not overlap, so both of its point-to-segment gaps exceed one unit and
  it is separated. One caveat: `SegmentGap` asks `SegmentsIntersect` in raw parameters, not in
  tolerance units; a crossing found there is a real meeting up to rounding, which the one-unit
  margin on each box covers unless the tolerance is below about 1e-12 of the coordinates.
- A region with a NaN or infinite point in tolerance units (a NaN parameter, or a zero
  tolerance) falls back to all pairs, so its answer is still `SegmentCollides`'s (shapes 8 and 9).
- A segment whose grown box covers more than 16 cells is tested against every segment instead of
  entered in the grid, so one long segment beside many short ones (a planar face with one long
  straight edge opposite a finely sampled one) costs O(n) per long segment, not O(n^2) cells.
- `MeshRegion` asked for the blocking requests on every face, simple or not; the requests were
  O(E B^2) because `EdgeCollides`'s `&&` evaluated `SegmentCollides` for every segment of every
  edge. `MeshRegionBody` asks only when a flag is set, and then looks only at flagged segments.
- The warm server (plato_laws MCP) failed the whole compilation with "Circular expression" on a
  14-arm chained conditional (`i == 0 ? a : i == 1 ? b : ...`) that the pinned CLI accepted; an
  array literal indexed by i replaced it. The client printed "0 laws, 0 type errors" and the
  advice to run the CLI, which passed, so the cause was found only by calling the server
  directly and printing its raw error.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, ticket, uv-regions, face-meshing, primer, law runner) | 25 min | |
| Writing (types, library, laws, TRACK) | 30 min | |
| Law runs, interpreter | 15 min | 8 runs, two lost to the server's "Circular expression" |
| Compiled run | 1 min | 1 (35 s total) |
| Waiting (PolesLaws budgets, server queue) | 15 min | 3 |

## Lessons
- `plato_laws.py` hides the server's error text when the compile fails: print
  `result.content[0].text` when `ok` is false. A two-line fix in the tool would have saved
  ten minutes here.
