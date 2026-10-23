---
id: TKT-409
title: STEP mesher: ODIN-W160's four ellipse-bounded oblique cylinder cuts fall back to CDT at 70 to 96 ms each while the grid meshes the other 235 four-edge cylinder faces in under 0.5 ms (idea 29)
status: claimed
depends_on: []
owner: session 91d9a03f
session: 91d9a03f-2c31-4aad-b8fd-1aa9c41df7da
fence: [sandbox/step-mesh-staging/quads/**, sandbox/step-brep-mesh/05-face-meshing/**, sandbox/step-brep-mesh/08-pipeline/pipeline-host-options*.plato]
workflow: [W3]
related: [TKT-405, TKT-323]
created: 2026-10-21
claimed: 2026-10-22
kind: idea
---

Found by TKT-405's verification (bim-open-data 376273f, PreferQuads on): with the structured grid, 235 of the 239 four-edge single-loop cylinder faces of the four baseline files take FaceQuadGridIn, and the four that do not are ODIN-W160 faces 3364 (69.6 ms), 3398 (79.3), 3414 (92.4) and 3431 (96.3), the oblique cuts whose side edges are ellipses; together they are 385 of the file's 2,446 ms of face time against 8 ms for the other 98. Idea 29 of docs/plans/step-mesher-ideas-evaluation.md: a grid whose rows follow the ellipse edges, or a cheaper refinement when the boundary is a conic. ODIN-W160 face 3431 was also run E's cylinder profile face.

## Acceptance criteria

- [x] A law over NIST CTC 01's face 85 (a cylinder fillet whose one side is a 45 degree mitre, an ellipse) states that the straight-step four-sided test refuses it, and another that the turning test gives it a grid within the chordal bound (`sandbox/step-mesh-staging/quads/`, chunk Q1)
- [x] ODIN-W160 faces 3364, 3398, 3414 and 3431 take the grid in the harness on a regeneration with Q1 (3 quads each, were 20 triangles), and every baseline file's mesh stays closed and oriented
- [ ] The host's refinement loop answers quad count requests (Q1b), so CTC 01 faces 85 to 92 take the grid; `Law_V1Proof_StepAnsweringBlockingLeavesOnlyBlocking` restated over `HostAnswers`
- [ ] Merged into the library by the v1 supervisor (TRACK.md's merge instructions) and the gallery regenerated

## Log

- 2026-10-22: widened from the four ODIN-W160 faces after the owner asked for clean quads on CTC 01's base fillets. The four-sided test classed each boundary step as along u or along v, so any side running along neither (an ellipse on a cylinder) was refused; the fix finds corners by turning in the chart. Measurements in `sandbox/step-mesh-staging/quads/TRACK.md`.

