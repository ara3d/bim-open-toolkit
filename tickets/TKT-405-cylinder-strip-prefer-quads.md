---
id: TKT-405
title: STEP mesher: the structured quad strip meshes four-edge and two-loop cylinder faces (PreferQuads on), removing about 48% of face time; owner decides quads or triangles in the output
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Step.Mesher/Plato/**, sandbox/step-mesh-staging/eval-strip/**]
workflow: [W3]
related: [TKT-323, TKT-402, TKT-403, TKT-313]
created: 2026-10-21
---

## Acceptance criteria

- [ ] The owner has decided, in the ticket or in chat: (a) quads in the mesh output (the host's ToTriangleMesh3D already splits them; corpus triangle counts change) or a triangle-emitting strip through CellTriangles that keeps Law_NoQuadsUnlessPreferred; and (b) that the strip's dropping of the 15 degree SideNormalsTurn criterion on these faces is acceptable, since refinement cannot meet it on a chord spanning over 30 degrees of arc and the chordal bound still holds
- [ ] StepPlatoMesher.Criteria sets PreferQuads according to that decision, and on the four baseline files of docs/plans/step-mesher-ideas-evaluation.md every mesh is closed and oriented with 0 boundary, non-manifold or misoriented edges, and the four-edge cylinder family's median face is under 0.4 ms
- [ ] The four ellipse-bounded oblique cylinder cuts of ODIN-W160 that fall back to CDT are named in the plan or a follow-up ticket (idea 29)

Idea 3 of the speed-ideas evaluation, run C. Measured with the harness's --quads flag: 235 of 239 four-edge cylinder faces and 41 of 42 two-loop full cylinders take FaceQuadGridIn; the family goes from 1,693 ms to 321 ms (median per face 3.86 to 0.231 ms), full cylinders 173 to 44 ms, about 48% of all face time on EMMY-W1, NINA-B400, ODIN-W160 and LILY-W131. EMMY-W1's elements: 4,342 triangles to 644 triangles plus 392 quads. Rectangles also take the grid as one quad each (median 0.139 to 0.081 ms). No Plato change is needed for the one-line form; the triangle-emitting variant is about 2 h in staging.
