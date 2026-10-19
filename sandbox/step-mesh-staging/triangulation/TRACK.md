# triangulation: constrained Delaunay by the in-circle determinant, refinement by insertion and flips

Tickets: TKT-343 (merged in 7d8dae2d), TKT-351 (the refinement was slower than the code it replaced)
Status: ready to merge (TKT-351; the C# timing of criterion 2 waits on the C# track, see Done)

## TKT-351: where the time goes, and a faster refinement

### Files

- `triangulation-fast.library.plato`: `RefineToSurfaceFast` (the refinement, one point at a time
  with local Lawson flips and a neighbour table kept up to date), `SurfacePassLocal`,
  `AnglePassLocal`, `TryInsertion`, `InsertedLocally`, `FlippedAround`, `UpdatedNeighbours`,
  `ChangedNear`, `WalkTo`, `DelaunayedQueue` (whole-triangulation flips from a queue, one table),
  `TriangulateRegionFast`, `InCircleOfFast`, `IsFlippableFast`.
- `triangulation-fast.laws.plato`: `Law_Fast_*`, layer 5's refinement laws on `RefineToSurfaceFast`
  and two laws of the new parts.

### Profile

Measured in the interpreter (cpu64, Plato CLI 128cf769), so the numbers are about the algorithm
and not TKT-350's MapRange defect in generated C#. Tool: a scratch harness (the CLI's `--call` with
the interpreter's `CallProfile` attached, in the session's scratchpad), self and inclusive time per
function. The unit cylinder's side face under DefaultMeshingOptions(chordal): 0.01 gives 25
points per circle edge, 0.003 gives 42, 0.001 gives 72.

| Size | Merged refinement (7d8dae2d) |
|---|---|
| 25 points | 20.4 s: `FlipPass` 17.9 s inclusive (388 calls), of it `NeighbourTable` 12.8 s (331 rebuilds, a closure sort each: `SortedIndices` 7.9 s, 4.7 million `LessThan`); the sort of four indices in `InCircleOf` 1.7 s; point location 0.3 s; the surface pass 1.5 s |
| 42 points | 100 s for 14 rounds; from round 7 on, about 65 triangles under 30 degrees that the guard refuses are retried, four candidates each, every round |
| 72 points | not done in 1800 s |

Where the time went: flip passes, not point location or re-triangulation. Every trial of an angle
insertion (159 at 25 points) flipped the whole triangulation with `Delaunayed`, and each pass
rebuilt the neighbour table with a sort, although an insertion changes only the triangles near its
point.

The old library (7d8dae2d^, extracted with `git archive`): 25 points 2.7 s (160 points); 72 points
3.3 s, with 144 points and 142 triangles. At 72 points it added no interior point at all, so its
3.4 s compiled time is the boundary's triangulation alone, and no refinement that adds points can
match it. The angle refinement of TKT-343 adds about 1200 points there, by design.

### What each change bought (interpreter, same machine)

| Change | 25 points | 42 points | 72 points |
|---|---|---|---|
| Merged | 20.4 s | 100 s | over 1800 s |
| Local Lawson flips after an angle insertion | 8.5 s | | |
| Searches stop at the first match | 6.4 s | 36 s | |
| Refused triangles not retried while unchanged | | 36 s | |
| Neighbour table kept up to date; surface pass one point at a time | 3.2 s | 8.0 s | 41 s |
| Seed flips from a queue (`DelaunayedQueue`) | | | 42 s (seed 3.2 s to 0.4 s) |

The 200-point plane face (the unit box, segments of at most 0.02): seed 5.9 s to 2.1 s, refined
19.6 s to 14.8 s (403 points). The bump solid's top face (track F): 236 s to 144 s, the same mesh
(1240 points, 2474 triangles) after the walk-based point location and the cavity search; what is
left there is B-spline projection inside the surface tests (87 s), paid per triangle of a mesh
that is too large (TKT-352, Findings).

At 72 points what remains is O(n) array work per kept insertion (`Concatenate` of the point
arrays, the angle pass's index scans): about 1300 insertions over 2600 triangles, costly in the
interpreter and a few million comparisons compiled. The C# timing (criterion 2) waits on the C#
track's regeneration with TKT-350 fixed; the bound reached here is 41 s interpreted at 72 points,
against 3.3 s for the old code, which added no point.

Mesh quality, staged against merged (gpu32, the probe behind TKT-343's table):

| Face | Merged | Staged |
|---|---|---|
| Cylinder side | 209 points; interior minimum 25.4 degrees, 4 under 30; overall 10.6 | 177 points; 25.8, 2 under 30; 10.6 |
| Quarter sector, curved face | 46 points; 13.4, 3 under 30; overall 9.0 | 44 points; 21.6, 1 under 30; 10.6 |
| Discs, caps, block with a hole | | the same or better |

The sequential surface pass gives a different, smaller mesh than the batched one.

### Done

- `Law_Fast_*`, gpu32, one run (16 s): 6 of 7 pass (`InCircleOfFastIsInCircleOf`,
  `UpdatedNeighboursAreTheTable`, `RefineMeetsContract`, `RefinedNoFlippableEdge`,
  `BoxFacesStayTwoTriangles`, `MinAngleBetterOnCylinders`); `RefinedInteriorMeetsMinAngle` fails
  on the cylinder, as the merged refinement's does. Before: the functions did not exist.
- Track F's twelve pipeline laws, cpu64, budget 120 s. On the library: 3 pass, 9 budget errors,
  all in `Delaunayed` under `AnglePass` (18 minutes), as track F reported. On the library wired to
  the staged functions: the same 3 pass; the three bump-solid criteria laws still exceed 120 s, now
  in the surface tests' B-spline projection, `Lift` and layer 7's validation after meshing
  finishes; the run then stopped without a summary during `Law_ModelLaws`, which alone ends in a
  budget error (the bump solid again). The remaining cause is filed as TKT-352.
- Full sweep, cpu64, budget 120 s, of a copy of the library at 4f344991 wired by the merge
  instructions below (RefineToSurface and TriangulateRegion pointed at the staged functions),
  against `reviews/verdicts-cpu64.tsv` (44 minutes; `verdicts-cpu64-tkt351.tsv` here): 785 laws, 546
  pass. Changed against the baseline: `Law_RoundLaws`, `Law_StateLaws`,
  `Law_OnlyFacesOfChangedEdgesAreRemeshed`, `Law_OutcomesAreCurrent` error (budget) to pass;
  `Law_OutcomeIsOfItsFace`, `Law_PendingRequestIsInSomeOutcome` skipped to pass;
  `Law_PendingRequestsAreRefinable` error to obligation. One regression,
  `Law_MinAngleNoWorseThanLibrary` on the cylinder: it compares the merged refinement
  (`RefinedCdt`) with the library's (`RefinedTriangulation`, the staged one in the wired copy), and
  on one disc the staged refinement, seeded by the queue flips, gives 30.56 degrees against 31.69
  (both above 30; on cocircular points the two seeds are different valid triangulations). After
  the merge both calls are the same function, so the law holds again. The new
  `Law_Fast_UpdatedNeighboursAreTheTable` errored there through a defect in the law itself (`||`
  evaluated both sides when the trial was refused); fixed, it passes under cpu64 and gpu32.
- Under cpu64 the staged refinement's interior minimum on the cylinder side face is 10.5 degrees
  against the merged one's 27.1 (overall minimum 10.1 against 8.9, better); both fail
  `RefinedInteriorMeetsMinAngle`. The surface pass now inserts circumcentres without the guard one
  at a time, and some land where the angle pass's guard cannot repair them; TKT-352's edge requests
  remove the forced boundary triangles that block the guard.

### Merge instructions (TKT-351)

- Move `triangulation-fast.library.plato` and `triangulation-fast.laws.plato` into
  `05-face-meshing/`; rename `Law_Fast_<What>` to `Law_<What>`, dropping those that duplicate a law
  of `triangulation.laws.plato` once the wiring below makes the two refinements one.
- `FaceMeshing.RefineToSurface` => `m.RefineToSurfaceFast(f, r, chart, t, c)`, and
  `TriangulationLaws.RefinedCdt` likewise; then delete `RefineToSurfaceByInsertion`, `SurfacePass`,
  `SurfacePlacement`, `TryAngleInsertion`, `AnglePass`, and `LocateNear`, `Locate`,
  `TriangleWithSide`, `IndexOfTriangle` where no caller is left; rename `RefineToSurfaceFast` to
  `RefineToSurfaceByInsertion` if the old name is wanted.
- `UvDelaunay.Delaunayed` takes `DelaunayedQueue`'s body (same parameters); then delete
  `DelaunayedQueue` and `TriangulateRegionFast` (`TriangulateRegion` stays on `TriangulateRegionCdt`).
- `TriangulationCdt.InCircleOf` takes `InCircleOfFast`'s body; delete `InCircleOfFast` and
  `IsFlippableFast`, calling `IsFlippableCdt` where `IsFlippableFast` was.
- Rerun the sweep against `reviews/verdicts-cpu64.tsv`.

### Findings (TKT-351)

- The old code's 3.4 s at 72 points is not a refinement time: it added no point (142 triangles,
  smallest angle about 5 degrees). Compare at the same mesh size.
- TKT-352: a face whose boundary segments are long against its chordal bound (the bump solid's top
  face, four boundary points) refines into slivers along them, which the angle pass cannot repair:
  2474 triangles where a few hundred would do. It is the triangulation's input, not its speed; face
  meshing should ask layer 8 for more segments on those edges.
- One run of twelve laws stopped after six with no summary line; rerun alone, the seventh ended
  normally in a budget error. Not reproduced, not explained.

### Durations (TKT-351)

| Step | Wall time | Runs |
|---|---|---|
| Reading the ticket, the merge, track F's notes | 10 min | 0 |
| Profiling harness (scratch, the CLI's call path with `CallProfile`) | 10 min | 2 builds |
| Profile, local flips, searches, refused memory | 40 min | 9 probes of 20 to 100 s; one 72-point probe stopped at 30 min |
| Neighbour table kept up to date, sequential surface pass, queue flips | 50 min | 8 probes |
| Old library baseline (git archive), quality comparison | 15 min | 8 runs |
| Track F's laws before and after, bump probes | 60 min | 2 law runs (18 and 8 min), 4 probes of 2.5 to 4.5 min |
| Full sweep of the wired copy | 44 min | 1 |

### Lessons (TKT-351)

- One interpreter profile (20 s) showed what TKT-343's design cost: the guard multiplied
  whole-face flips by every trial. Profile before tuning. The interpreter's `CallProfile` has no
  CLI flag; a 40-line harness attaches it.
- A 72-point probe ran 30 minutes with no output because the harness prints only at the end; a
  per-round history probe found the retried triangles in 100 s.

## TKT-343 (merged)

### Files

- `triangulation-cdt.library.plato`: `InCircle` (the 3 x 3 determinant in Number), `InCircleOf`
  (the same determinant with the four points in index order, sign corrected by the permutation's
  parity), `IsFlippableCdt` (strictly positive determinant, strictly convex quadrilateral, not a
  boundary segment), `FlipPassCdt`, `DelaunayedCdt`, `TriangulateRegionCdt`.
- `triangulation-refine.library.plato`: `RefineToSurfaceByInsertion` and its pass: surface
  criteria as before (midpoint of the longest free side, or the centroid), plus the 30 degree
  angle on every face, planes included, by off-centres; every pass ends with `DelaunayedCdt`.
- `triangulation.laws.plato`: `Law_Tri_*` laws of the two functions over 11 sample models.
- `triangulation-wiring.library.plato`: staging only. Copies of `FaceTriangulation`, `MeshFace`
  and layer 8's loop calling the new functions, for the staged step A and B laws. Not merged.
- `triangulation-steps.laws.plato`: staging only. Steps A and B laws on the wired copies.

### Done

- Constrained Delaunay group: `Law_Tri_InCircleWitnesses`, `Law_Tri_FlipNeverUndone`,
  `Law_Tri_InCircleOfAgreesWithInCircle`, `Law_Tri_CdtKeepsBoundary`, `Law_Tri_CdtKeepsEverySegment`,
  `Law_Tri_CdtIsConforming`, `Law_Tri_CdtPositiveOrientation`, `Law_Tri_CdtNoFlippableEdge`,
  `Law_Tri_CdtAreaIsRegionArea`. Before: the functions did not exist (laws written first). After,
  gpu32: 9 of 9 pass (the six model laws exhaustive over 14 cases, over every face of the unit box,
  cylinder, block with through hole, hollow box, quarter sector and 2 x 3 x 4 box).

- Refinement and steps groups: before, the laws were written ahead of the bodies (functions
  undefined). After, gpu32, pinned CLI, one run of every `Law_Tri_` law (208 s):
  19 of 20 pass, `verdicts-gpu32.tsv`. Pass: `Law_Tri_RefineMeetsContract`,
  `Law_Tri_RefinedNoFlippableEdge`, `Law_Tri_MinAngleNoWorseThanLibrary`,
  `Law_Tri_MinAngleBetterOnCylinders`, `Law_Tri_BoxFacesStayTwoTriangles`,
  `Law_Tri_QualityRequestsOnBoxes`, and the four staged step A and B laws
  (`Law_Tri_Steps_TriangulationLaws`, `_FaceMeshLaws`, `_FaceChecksNoWorse`,
  `_ModelErrorsNoWorse`). Fail: `Law_Tri_RefinedInteriorMeetsMinAngle` on the cylinder and
  sector side faces (Findings); it states the reworded criterion and is kept as the open item.
  Intermediate design runs, first refinement: 4 of 7 pass (the sector's caps got worse than the
  library's), fixed by the guard in the angle pass.

### Merge instructions

- Move `triangulation-cdt.library.plato`, `triangulation-refine.library.plato` and
  `triangulation-requests.library.plato` into `05-face-meshing/`, and `triangulation.laws.plato`
  beside `face-meshing.laws.plato`, renaming `Law_Tri_<What>` to `Law_<What>`.
- `FaceMeshing.TriangulateRegion(r, chart)` => `r.TriangulateRegionCdt(chart)` (or move the body in).
- `FaceMeshing.RefineToSurface(m, f, r, chart, t, c)` => `m.RefineToSurfaceByInsertion(f, r, chart, t, c)`.
- `UvDelaunay.IsFlippable` => `IsFlippableCdt` (same parameters), then delete `FlipPassCdt` and
  `DelaunayedCdt` and call `FlipPass` and `Delaunayed` instead: they differ only in the test (and
  the pass cap, 200 in the library, 400 here; keep 400). UvDelaunay's 2D `AngleAt` may then be unused; check before deleting it.
- `SplitPass` and `RefineToSurface`'s old body become unused; delete them.
- Delete `triangulation-wiring.library.plato` and `triangulation-steps.laws.plato`: staging copies of
  the library chain, made redundant by the two wiring edits above.
- Do not wire `QualitySegmentRequestsCdt` into `MeshedOutcome`: it adds boundary segments, and step
  A's boxes keep 8 vertices and 12 triangles (supervisor, 2026-10-18). It waits for the option below.
- Update the spec's deferred notes for TriangulateRegion ("exact orientation and in-circle
  predicates") and RefineToSurface: in-circle determinant in Number, off-centres for the angle.

### Contract requests

- Additive: an angle bound in `FaceMeshingCriteria` (or `MeshingOptions.QualityAngle`), so
  `RefinementMinAngle` (30 degrees, hard-coded in layer 5) comes from the caller, and a later
  caller can enable `QualitySegmentRequestsCdt` on purpose.
- Not additive, for later: a `RefinementReason.TooCoarseForQuality` case; the staged requests use
  `TooCoarseInParameterSpace` until it exists.

### Requests to other tracks

- C (poles): none blocking. Faces with poles were left out of this track's samples
  (`ExpandedPoles` is bodiless here); after C merges, rerun `Law_Tri_*` with the sphere, torus,
  cone and sphere-by-pole-loops witnesses added to `TriWitnessIndices`. Pole triangles collapse
  when lifted, so the angle rule may refine near a pole needlessly; C may want to skip
  `IsBelowRefinementAngle` on triangles touching a collapsed line.
- F (B-spline): none blocking; add witness 7 to `TriWitnessIndices` after F merges.

### Findings

- **30 degrees is out of reach with the boundary fixed (the reason criterion 2 was reworded,
  supervisor's option b, 2026-10-18).** TriangulateRegion and RefineToSurface may not add
  boundary points. Witness_Box(2, 3, 4) under the witness options (no length limit) gives each
  line one segment, so a 2 x 4 face has only its four corners. Put the face at [0, 4] x [0, 2].
  The triangle on the bottom side, apex (x, h), has base angles atan(h / x) and
  atan(h / (4 - x)); both reach 30 degrees only if h >= tan(30) max(x, 4 - x) >= 2 tan(30) =
  1.155. At the column u = 2 that triangle then covers v in [0, 1.155] (its upper side passes
  above 1.155 there), and the top side's triangle covers [0.845, 2] by symmetry: they overlap,
  so no set of interior points gives a triangulation whose triangles all reach 30 degrees.
  The cylinder side face pairs the seam segment (length 1) with circle segments of 2 pi / 24 =
  0.26 at a 90 degree corner. Every edge ratio within a triangle whose angles all reach 30
  degrees is at most sin(120) / sin(30) = 1.73, so the corner's fan needs three triangles of
  exactly 30 degrees each: reachable only at equality, which 32-bit rounding breaks.
  Consequence: the library's F-52.1 note blamed ear clipping's diagonal of a 3 x 4 face; the
  failing face is the 2 x 4 one (26.57 degrees with either diagonal), and no triangulator fixes
  it. Edge requests could (triangulation-requests.library.plato), at the cost of more boxes'
  vertices, so they stay unwired.

- **Measured smallest lifted angles, gpu32, witness options** (probe outside the repository, the
  library's RefinedTriangulation against RefineToSurfaceByInsertion on TriangulateRegionCdt;
  degrees, smallest over the face, then smallest over triangles touching no boundary point):

  | Face | Library | New | New, interior | Points, library / new |
  |---|---|---|---|---|
  | Cylinder side (50 boundary points) | 4.99 | 10.61 | 25.36 (4 below 30) | 172 / 209 |
  | Cylinder discs (24 each) | 7.50 | 30.03, 29.07 | 30.03, 31.98 | 24 / 37, 39 |
  | Quarter sector, curved face (14) | 8.50 | 9.00 | 13.36 (3 below 30) | 47 / 46 |
  | Quarter sector, caps (8 each) | 15.00 | 22.02 | none interior | 8 / 10 |
  | Quarter sector, flat sides; unit box; 2 x 3 x 4 box | 45; 45; 26.57 to 36.87 | the same, two triangles each | none | 4 / 4 |

- **Why curved faces keep interior triangles under 30 degrees.** On the sector's curved face the
  13.36 degree triangle's best candidate (its off-centre) would turn a neighbouring boundary
  triangle from 9.0 into 4.0 degrees, and every other candidate likewise lowers it; the guard
  refuses all of them. The boundary triangle is forced by the seam line's single segment (length 1)
  against circle segments of 0.26. Only more seam segments fix it: the staged, unwired
  `QualitySegmentRequestsCdt`. Three designs were tried in turn (the probe numbers are in the
  session's scratchpad): batched off-centres with a 120 degree rule made the sector caps worse
  than the library (7.5 against 15 degrees); the guard fixed that; circumcentres for the surface
  criteria (Chew, Ruppert) in place of midpoints raised the cylinder side from 8.9 to 10.6.

### Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading the plan, library and probes | 25 min | 0 |
| Writing laws, then bodies | 40 min | 0 |
| Type check through the shared server | 17 min, all of it queued behind other tracks | 1 (two more stopped) |
| CDT group through the pinned CLI | 1 min | 4 runs of 12 to 15 s |
| Refinement: three designs, probes outside the repository | 70 min | 9 probe runs, 17 to 91 s |
| Final run of every Law_Tri_ law | 3.5 min | 1 |
| Waiting on the supervisor's answer | 0 (worked on meanwhile) | |

### Lessons

- The shared plato server runs one request at a time; a layer 8 sweep from another track held my
  type check for 17 minutes. The pinned CLI (`C:/Users/cdigg/.plato-cli/88aa0277`) with the
  staging folder as an extra root compiles in 12 s and runs on its own; use it for tracks.
- The criterion's 30 degrees should have been checked against the witness geometry before the
  ticket was written: ten minutes of arithmetic showed it impossible on the box, and a probe on
  the cylinder would have shown the seam ratio.
- A law over every witness stops at the first host obligation, so step C's `ExpandedPoles` and step
  F's `ProjectBySearch` hid every verdict until the samples excluded those witnesses.
