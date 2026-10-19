# triangulation: constrained Delaunay by the in-circle determinant, refinement by insertion and flips

Ticket: TKT-343
Status: working

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

## Merge instructions

## Contract requests

## Requests to other tracks

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

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading the plan, library and probes | 25 min | 0 |
| Writing laws, then bodies | 40 min | 0 |
| Type check through the shared server | 17 min, all of it queued behind other tracks | 1 (two more stopped) |
| CDT group through the pinned CLI | 1 min | 4 runs of 12 to 15 s |

## Lessons

- The shared plato server runs one request at a time; a layer 8 sweep from another track held my
  type check for 17 minutes. The pinned CLI (`C:/Users/cdigg/.plato-cli/88aa0277`) with the
  staging folder as an extra root compiles in 12 s and runs on its own; use it for tracks.
- A law over every witness stops at the first host obligation, so step C's `ExpandedPoles` and step
  F's `ProjectBySearch` hid every verdict until the samples excluded those witnesses.
