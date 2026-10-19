---
id: TKT-343
title: STEP mesher: constrained Delaunay triangulation and surface refinement by edge insertion and flips, in floats (replaces ear clipping and centroid splitting)
status: open
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/triangulation/**]
workflow: [W3, W4]
related: [TKT-323, TKT-324]
confidence: high
created: 2026-10-18
---

## Acceptance criteria

- [ ] a constrained Delaunay triangulation of a uv region with holes (TriangulateRegionCdt in the staging folder) keeps every boundary segment, and laws state it: every triangle has positive orientation, no edge is flippable by the in-circle determinant (written as the determinant in Number, not an angle sum), and the area of the triangles equals the region's area
- [ ] refinement to the surface inserts points on long or deviating edges and restores the Delaunay property by flips (RefineToSurfaceByInsertion), and Law_TriangleMinAngleMeetsThreshold passes on the 2x3x4 box and the cylinder witnesses where ear clipping failed
- [ ] every law of steps A and B still passes when the supervisor's merge instructions in TRACK.md point TriangulateRegion and RefineToSurface at the new functions, run under the gpu32 profile

Plan docs/plans/step-mesher-v2.md, track T. Findings F-52 items 1 and 2: TriangulateRegion is ear clipping with hole bridging and RefineToSurface splits at centroids, which cannot meet curved-face criteria. IsFlippable compares an Atan2 angle sum with pi + 1e-9; the owner decided 2026-10-18 that no exact predicates are needed for now, so the in-circle test is the plain determinant in Number, with a strict-positive flip rule so cocircular points never flip back and forth. Works only in sandbox/step-mesh-staging/triangulation (rules in its README).
