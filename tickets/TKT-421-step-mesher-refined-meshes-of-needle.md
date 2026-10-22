---
id: TKT-421
title: STEP mesher: refined meshes of needle cones and single-winding cylinder faces keep folded elements
status: claimed
depends_on: []
owner: session 0d8c417b
session: 0d8c417b-f6aa-4828-ac07-a9d6f3b535c9
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-411, TKT-401]
created: 2026-10-22
claimed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] SHO/MAYA-W160.step faces 3337 and 3638 and SHO/MAYA-W260_REVC.step faces 1411, 1431, 1577, 1588 and 1606 mesh with every element facing the face normal (WindingSign 1), or get a located diagnostic
- [ ] The three files' MeshCheck reports no more misoriented or non-manifold edges than on 2026-10-21 (MAYA-W160: 0 and 0; MAYA-W260_REVC: 4 and 4)

Found 2026-10-22 by the v1-faces track (sandbox/step-mesh-staging/v1-faces, chunk F3, TKT-411) on a scratch regeneration of the library with F1 and F3 wired in. Before F3 these faces threw ArgumentOutOfRangeException in face meshing and were holes. With F3 they mesh, but some elements fold (WindingSign -1, per-face check in the scratch harness): the two needle cones of MAYA-W160 (radius 6.1e-5, half-angle 4.1e-4 rad, a half-turn lune through the apex) have 2 of 12 elements folded and 4 directed edges used twice; the apex segment's points 2 to 13 are in no element, so the triangulation dropped them (the chart near the apex, or the tolerance there, likely makes them coincide); MAYA-W260_REVC's cones 1411 and 1431 are the same shape; its cylinder faces 1577, 1588 and 1606, one winding loop of about 50 points each, now reach CutWholePeriods and keep 1, 6 and 1 folded elements of 662, 352 and 671. MeshCheck: MAYA-W160 0 non-manifold and 0 misoriented edges before, 6 and 12 after; MAYA-W260_REVC 4 and 4 before, 10 and 16 after. Refinement is meant to split folds (LiftsFacingFaceNormal in TriangleNeedsRefinement), so either it stops early here or the dropped boundary points leave it nothing to split.
