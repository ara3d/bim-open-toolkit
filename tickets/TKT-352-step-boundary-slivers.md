---
id: TKT-352
title: STEP mesher: a face whose boundary segments are long against its chordal bound refines into slivers along them; face meshing should ask for more segments on those edges
status: open
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/triangulation/**]
workflow: [W3, W4]
related: [TKT-351, TKT-327, TKT-343]
confidence: medium
created: 2026-10-19
kind: defect
---

## Acceptance criteria

- [ ] the bump solid's top face (Witness_BSplinePatchSolid(1/2), witness 7) under layer 8's witness options meshes in at most two refinement rounds with fewer than 600 triangles, every law of steps A to C still passing
- [ ] a staged edge request (TooCoarseInParameterSpace or a new reason, a contract request) names each edge whose boundary segment no interior point can meet SurfaceChordal next to, with a law stating it on the bump solid

Found 2026-10-19 by TKT-351 (triangulation track). The bump solid's top face has four boundary points (each straight edge is one segment, no length limit) and its surface rises from them. A triangle on a boundary segment of length 1 meets SurfaceChordal (0.01) only if it is thin, so refinement keeps inserting points along the boundary: 1240 points and 2474 triangles with TKT-351's staged refinement (144 s interpreted, most of it in B-spline projection for the surface tests), against 338 triangles, 12 degenerate, before TKT-343 (track F's TRACK.md). Thin triangles also fail the 30 degree angle, and the boundary cannot be split from inside the face. The same mechanism keeps interior triangles under 30 degrees on the cylinder side face (TKT-343 findings). Layer 5 already raises TooCoarseInParameterSpace for segments that stray in parameter space; this asks the same for segments too long for the face's chordal bound, through layer 8's refinement loop. Staged precedent: QualitySegmentRequestsCdt (unwired, triangulation-requests.library.plato). Step A's boxes must keep 8 vertices and 12 triangles (planes need no surface requests).

Note 2026-10-21, owner's decision: deferred to the improvement pass. Slivers are acceptable in version 1 (`sandbox/step-brep-mesh/README.md`, "Version 1 mesh contract"), as long as every element is within the chordal tolerance. Do not claim before that pass starts.
