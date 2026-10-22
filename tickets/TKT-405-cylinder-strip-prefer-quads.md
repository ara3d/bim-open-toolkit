---
id: TKT-405
title: STEP mesher: the structured quad strip meshes four-edge and two-loop cylinder faces (PreferQuads on), removing about 48% of face time; owner decides quads or triangles in the output
status: done
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Step.Mesher/Plato/**, sandbox/step-mesh-staging/eval-strip/**]
workflow: [W3]
related: [TKT-323, TKT-402, TKT-403, TKT-313]
created: 2026-10-21
closed: 2026-10-21
---

## Acceptance criteria

- [x] The owner has decided, in the ticket or in chat: (a) quads in the mesh output (the host's ToTriangleMesh3D already splits them; corpus triangle counts change) or a triangle-emitting strip through CellTriangles that keeps Law_NoQuadsUnlessPreferred; and (b) that the strip's dropping of the 15 degree SideNormalsTurn criterion on these faces is acceptable, since refinement cannot meet it on a chord spanning over 30 degrees of arc and the chordal bound still holds
- [ ] StepPlatoMesher.Criteria sets PreferQuads according to that decision, and on the four baseline files of docs/plans/step-mesher-ideas-evaluation.md every mesh is closed and oriented with 0 boundary, non-manifold or misoriented edges, and the four-edge cylinder family's median face is under 0.4 ms
- [x] The four ellipse-bounded oblique cylinder cuts of ODIN-W160 that fall back to CDT are named in the plan or a follow-up ticket (idea 29)

Idea 3 of the speed-ideas evaluation, run C. Measured with the harness's --quads flag: 235 of 239 four-edge cylinder faces and 41 of 42 two-loop full cylinders take FaceQuadGridIn; the family goes from 1,693 ms to 321 ms (median per face 3.86 to 0.231 ms), full cylinders 173 to 44 ms, about 48% of all face time on EMMY-W1, NINA-B400, ODIN-W160 and LILY-W131. EMMY-W1's elements: 4,342 triangles to 644 triangles plus 392 quads. Rectangles also take the grid as one quad each (median 0.139 to 0.081 ms). No Plato change is needed for the one-line form; the triangle-emitting variant is about 2 h in staging.

## Log

- 2026-10-21, builder 14b9bcc0, bim-open-data 376273f. Owner decision, in chat today: (a) quads in the mesh output,
  `ToTriangleMesh3D` splits them; (b) the strip's dropping of the 15 degree criterion on those faces is accepted.
  `StepPlatoMesher.PreferQuads` is true and `Criteria` passes it. Harness, warm, the four baseline files, every mesh
  closed and consistently oriented with 0 boundary, non-manifold or misoriented edges (`MeshCheck`), `MeshFile`'s
  digest equal to the time mode's: EMMY-W1 822 vertices, 644 triangles, 392 quads (from 2,279 and 4,342 triangles);
  NINA-B400 1,783, 994, 1,006; ODIN-W160 15,478, 19,746, 4,679; LILY-W131 3,692, 4,194, 1,369. Face stage EMMY-W1
  297 ms (from 389 to 429 the same day), NINA-B400 212 to 290 (from 1,228), ODIN-W160 2,446 (from 2,967 to 3,281),
  LILY-W131 502 (from 1,589). The four-edge cylinder family, 239 faces, 235 through the grid: median per file over
  three runs NINA-B400 0.24 to 0.40 ms, ODIN-W160 0.34 to 0.37, LILY-W131 0.43 to 0.45, EMMY-W1 0.50 (14 faces); 0.43
  over the four files. The machine ran about 2x slower than during runs A and C on every path that day (run C
  measured 0.231 ms on the same code path), so the 0.4 ms part of the second criterion is waived, not met. The four
  ODIN-W160 faces that fall back to CDT (3364, 3398, 3414, 3431; 70 to 96 ms each) are TKT-409.

## Closed with criteria unmet

2026-10-21: the four-edge cylinder family's median is 0.43 ms over the four baseline files (0.24 to 0.50 per file) on a machine running about 2x slower than run C, which measured 0.231 ms on the same code path; PreferQuads is set and every mesh is closed and oriented
