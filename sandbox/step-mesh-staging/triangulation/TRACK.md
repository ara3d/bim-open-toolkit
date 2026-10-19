# triangulation: constrained Delaunay by the in-circle determinant, refinement by insertion and flips

Ticket: TKT-343
Status: merged in 7d8dae2d; criterion 2 met except interior 30 degrees on curved side faces, see Findings

## Files

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

## Done

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

## Merge instructions

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

## Contract requests

- Additive: an angle bound in `FaceMeshingCriteria` (or `MeshingOptions.QualityAngle`), so
  `RefinementMinAngle` (30 degrees, hard-coded in layer 5) comes from the caller, and a later
  caller can enable `QualitySegmentRequestsCdt` on purpose.
- Not additive, for later: a `RefinementReason.TooCoarseForQuality` case; the staged requests use
  `TooCoarseInParameterSpace` until it exists.

## Requests to other tracks

- C (poles): none blocking. Faces with poles were left out of this track's samples
  (`ExpandedPoles` is bodiless here); after C merges, rerun `Law_Tri_*` with the sphere, torus,
  cone and sphere-by-pole-loops witnesses added to `TriWitnessIndices`. Pole triangles collapse
  when lifted, so the angle rule may refine near a pole needlessly; C may want to skip
  `IsBelowRefinementAngle` on triangles touching a collapsed line.
- F (B-spline): none blocking; add witness 7 to `TriWitnessIndices` after F merges.

## Findings

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

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading the plan, library and probes | 25 min | 0 |
| Writing laws, then bodies | 40 min | 0 |
| Type check through the shared server | 17 min, all of it queued behind other tracks | 1 (two more stopped) |
| CDT group through the pinned CLI | 1 min | 4 runs of 12 to 15 s |
| Refinement: three designs, probes outside the repository | 70 min | 9 probe runs, 17 to 91 s |
| Final run of every Law_Tri_ law | 3.5 min | 1 |
| Waiting on the supervisor's answer | 0 (worked on meanwhile) | |

## Lessons

- The shared plato server runs one request at a time; a layer 8 sweep from another track held my
  type check for 17 minutes. The pinned CLI (`C:/Users/cdigg/.plato-cli/88aa0277`) with the
  staging folder as an extra root compiles in 12 s and runs on its own; use it for tracks.
- The criterion's 30 degrees should have been checked against the witness geometry before the
  ticket was written: ten minutes of arithmetic showed it impossible on the box, and a probe on
  the cylinder would have shown the seam ratio.
- A law over every witness stops at the first host obligation, so step C's `ExpandedPoles` and step
  F's `ProjectBySearch` hid every verdict until the samples excluded those witnesses.
