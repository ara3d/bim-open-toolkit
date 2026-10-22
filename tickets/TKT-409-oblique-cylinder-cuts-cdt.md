---
id: TKT-409
title: STEP mesher: ODIN-W160's four ellipse-bounded oblique cylinder cuts fall back to CDT at 70 to 96 ms each while the grid meshes the other 235 four-edge cylinder faces in under 0.5 ms (idea 29)
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-405, TKT-323]
created: 2026-10-21
kind: idea
---

Found by TKT-405's verification (bim-open-data 376273f, PreferQuads on): with the structured grid, 235 of the 239 four-edge single-loop cylinder faces of the four baseline files take FaceQuadGridIn, and the four that do not are ODIN-W160 faces 3364 (69.6 ms), 3398 (79.3), 3414 (92.4) and 3431 (96.3), the oblique cuts whose side edges are ellipses; together they are 385 of the file's 2,446 ms of face time against 8 ms for the other 98. Idea 29 of docs/plans/step-mesher-ideas-evaluation.md: a grid whose rows follow the ellipse edges, or a cheaper refinement when the boundary is a conic. ODIN-W160 face 3431 was also run E's cylinder profile face.
