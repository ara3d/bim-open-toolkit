---
id: TKT-343
title: STEP mesher: constrained Delaunay triangulation and surface refinement by edge insertion and flips, in floats (replaces ear clipping and centroid splitting)
status: done
depends_on: []
owner: session ae00416c
session: ae00416c-c93c-426f-83b6-e7512ad06cfe
fence: [sandbox/step-mesh-staging/triangulation/**]
workflow: [W3, W4]
related: [TKT-323, TKT-324]
confidence: high
created: 2026-10-18
claimed: 2026-10-18
closed: 2026-10-19
---

## Acceptance criteria

- [x] a constrained Delaunay triangulation of a uv region with holes (TriangulateRegionCdt in the staging folder) keeps every boundary segment, and laws state it: every triangle has positive orientation, no edge is flippable by the in-circle determinant (written as the determinant in Number, not an angle sum), and the area of the triangles equals the region's area. Evidence: merged in 7d8dae2d; `Law_CdtKeepsEverySegment`, `Law_CdtPositiveOrientation`, `Law_CdtNoFlippableEdge`, `Law_CdtAreaIsRegionArea` pass in reviews/verdicts-cpu64.tsv and on the warm checker 2026-10-19 (14 cases each, exhaustive)
- [ ] refinement to the surface inserts points on long or deviating edges and restores the Delaunay property by flips (RefineToSurfaceByInsertion); every triangle that touches no boundary point (so no boundary segment can forbid it) meets Cubit's 30 degrees, and the smallest angle is no worse than the library's (ear clipping, centroid and midpoint splits) on every sample face and better on the cylinder witnesses
  - Reworded 2026-10-18 by the supervisor (option b): with the boundary fixed, 30 degrees is out of reach. A 2 x 4 box face has only its corners, and a triangle on a length-4 side reaching 30 degrees needs its apex 1.155 from that side, so the two long sides' triangles would overlap in a strip of height 2. On the cylinder's seam corner 30 degrees is reachable only at exactly 30. Proof in the track's TRACK.md, Findings. Step A's box keeps 8 vertices and 12 triangles.
  - Status 2026-10-19: met except the interior 30 degrees on the two curved side faces (cylinder side: 4 interior triangles, smallest 25.4; quarter sector's curved face: 3, smallest 13.4). Every candidate point there lowers a boundary triangle forced by the seam line's single segment. No worse than the library on every face, better on both cylinder witnesses. TRACK.md, Findings.
- [x] every law of steps A and B still passes when the supervisor's merge instructions in TRACK.md point TriangulateRegion and RefineToSurface at the new functions, run under the gpu32 profile
  - Evidence: commit 7f578657 and TRACK.md "Done"; the merge sweep in 7d8dae2d had no regressions against the baseline (docs/plans/step-mesher-v2.md, Log 2026-10-19).
  - 2026-10-19: staged copies (triangulation-steps.laws.plato) pass on the unit box, cylinder, block with through hole, hollow box, quarter sector and 2 x 3 x 4 box: every layer 5 triangulation and face-mesh law, layer 7's face checks no worse, the whole pipeline's Error codes no worse at Oracle. Pole and B-spline witnesses wait for steps C and F.

Plan docs/plans/step-mesher-v2.md, track T. Findings F-52 items 1 and 2: TriangulateRegion is ear clipping with hole bridging and RefineToSurface splits at centroids, which cannot meet curved-face criteria. IsFlippable compares an Atan2 angle sum with pi + 1e-9; the owner decided 2026-10-18 that no exact predicates are needed for now, so the in-circle test is the plain determinant in Number, with a strict-positive flip rule so cocircular points never flip back and forth. Works only in sandbox/step-mesh-staging/triangulation (rules in its README).

2026-10-19, closer (supervisor of docs/plans/step-mesher-v2.md): closed with criterion 2 waived on the supervisor's decision of 2026-10-18 (option b, recorded above and in TRACK.md Findings): with the boundary fixed, 30 degrees is out of reach. The two curved faces still short of it fail for the same cause (the seam line's single boundary segment); `Law_RefinedInteriorMeetsMinAngle` stays in the library failing at k = 1 (rechecked on the warm checker) as the open record, and more seam segments (`QualitySegmentRequestsCdt`, unwired) are the fix.

## Closed with criteria unmet

2026-10-19: criterion 2 relaxed by the supervisor's decision of 2026-10-18 (option b, recorded in the ticket and in sandbox/step-mesh-staging/triangulation/TRACK.md Findings): with the boundary fixed 30 degrees is out of reach; the curved faces' remaining interior triangles fail for the same cause, and Law_RefinedInteriorMeetsMinAngle stays as the open record
