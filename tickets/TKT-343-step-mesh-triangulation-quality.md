---
id: TKT-343
title: STEP mesher: constrained Delaunay triangulation and surface refinement by edge insertion and flips, in floats (replaces ear clipping and centroid splitting)
status: claimed
depends_on: []
owner: session ae00416c
session: ae00416c-c93c-426f-83b6-e7512ad06cfe
fence: [sandbox/step-mesh-staging/triangulation/**]
workflow: [W3, W4]
related: [TKT-323, TKT-324]
confidence: high
created: 2026-10-18
claimed: 2026-10-18
---

## Acceptance criteria

- [ ] a constrained Delaunay triangulation of a uv region with holes (TriangulateRegionCdt in the staging folder) keeps every boundary segment, and laws state it: every triangle has positive orientation, no edge is flippable by the in-circle determinant (written as the determinant in Number, not an angle sum), and the area of the triangles equals the region's area
- [ ] refinement to the surface inserts points on long or deviating edges and restores the Delaunay property by flips (RefineToSurfaceByInsertion); every triangle that touches no boundary point (so no boundary segment can forbid it) meets Cubit's 30 degrees, and the smallest angle is no worse than the library's (ear clipping, centroid and midpoint splits) on every sample face and better on the cylinder witnesses
  - Reworded 2026-10-18 by the supervisor (option b): with the boundary fixed, 30 degrees is out of reach. A 2 x 4 box face has only its corners, and a triangle on a length-4 side reaching 30 degrees needs its apex 1.155 from that side, so the two long sides' triangles would overlap in a strip of height 2. On the cylinder's seam corner 30 degrees is reachable only at exactly 30. Proof in the track's TRACK.md, Findings. Step A's box keeps 8 vertices and 12 triangles.
- [ ] every law of steps A and B still passes when the supervisor's merge instructions in TRACK.md point TriangulateRegion and RefineToSurface at the new functions, run under the gpu32 profile

Plan docs/plans/step-mesher-v2.md, track T. Findings F-52 items 1 and 2: TriangulateRegion is ear clipping with hole bridging and RefineToSurface splits at centroids, which cannot meet curved-face criteria. IsFlippable compares an Atan2 angle sum with pi + 1e-9; the owner decided 2026-10-18 that no exact predicates are needed for now, so the in-circle test is the plain determinant in Number, with a strict-positive flip rule so cocircular points never flip back and forth. Works only in sandbox/step-mesh-staging/triangulation (rules in its README).
