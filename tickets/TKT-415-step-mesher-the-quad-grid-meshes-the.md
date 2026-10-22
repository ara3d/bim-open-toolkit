---
id: TKT-415
title: STEP mesher: the quad grid meshes the bump solid's B-spline top face as one flat quad, so a 0.3 bump vanishes (the mesh equals the unit box's)
status: claimed
depends_on: []
owner: session 0d8c417b
session: 0d8c417b-f6aa-4828-ac07-a9d6f3b535c9
fence: [sandbox/step-brep-mesh/05-face-meshing/**, sandbox/step-brep-mesh/reviews/**]
workflow: [W3]
related: [TKT-401, TKT-405, TKT-327]
created: 2026-10-21
claimed: 2026-10-21
kind: defect
---

## Acceptance criteria

- [ ] A law over Witness_BSplinePatchSolid(0.3) states that the top face's mesh deviates from the surface by at most the chordal bound at interior sample points, and fails on the current library
- [ ] The quad-grid path (FaceQuadGridIn) refuses a four-edge face whose interior deviates from the one-quad or n-by-m grid by more than the chordal bound, or subdivides until it does not
- [ ] Witness_BSplinePatchSolid(0.3) meshed at chordal 0.01 has a top face with interior vertices and a mesh hash different from Witness_UnitBox

Found 2026-10-21 while building the STEP mesher gallery (`docs/plans/step-mesher-gallery.md`). `step-corpus-harness gallery witness:BSplinePatchSolid:0.3 out.glb --chordal 0.01` meshes the six faces as six quads, and the mesh digest is `AC03233177AEA985`, the same as `witness:UnitBox`. The B-spline top face, raised 0.3 in the middle of a one-unit patch, takes layer 5's grid branch (`FaceQuadGridIn`, `PreferQuads` on since TKT-405) and comes out as the single quad through its four corners: the chordal bound appears to be tested only along the boundary edges, which are straight lines with zero deviation, so an interior bump is invisible to it. TKT-405's note that the grid "keeps the chordal bound" holds for cylinders, where the boundary circles carry the curvature, and not for a face curved only in its interior.

Corpus effect: every four-edge B-spline face with straight edges (6,530 B-spline faces meshed on 2026-10-21, how many with four straight edges is not counted) may be flattened the same way. The refinement path (`RefineToSurface`) does sample the interior; the grid path needs the same test or a limit to faces whose surface is ruled along the grid.
