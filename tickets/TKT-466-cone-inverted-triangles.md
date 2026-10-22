---
id: TKT-466
title: Two inverted triangles on ANN-MB2's cone face 1466
status: claimed
depends_on: []
owner: session 0d8c417b
session: 0d8c417b-f6aa-4828-ac07-a9d6f3b535c9
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-323]
confidence: medium
created: 2026-10-22
claimed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] POS/ANN-MB2.step face 1466 meshes with no element whose normal points against the face normal

Corpus run 2026-10-22. POS/ANN-MB2.step face 1466, a one-loop cone face meshed by CDT into 23 triangles: elements 19 and 21 (uv corners near u -2.17 to -2.49, v -0.28 to -0.30) have real area (2*area/longest^2 0.03 and 0.024), every corner on the surface (gaps under 2e-11), and normals against the face normal. Not ANN-MB2's not-simple faces (v1-faces' ticket).

Owner: v1-faces (supervisor, 2026-10-22).


## Diagnosis (v1-faces, 2026-10-22)

The two flipped elements are [12, 21, 11] and [21, 20, 11] (corner indices of the face mesh), both at vertex 11 (uv (-2.4936, -0.3)), the sharp corner where the rim (v = -0.3) meets the edge running to point 12 (uv (-2.1746, -0.282)). Points 19, 20 and 21 are interior points refinement put into that thin wedge. The cone is nearly flat (x varies by 0.04 across the face), so v is almost a radial direction moving fast and a straight parameter-plane line is a spiral in space: a triangle across the wedge winds backwards in space with every corner on the surface (corner gaps under 2e-11). Refinement cannot split it: every point near the sharp corner lies within the effective minimum length of a corner and is refused. It is the same family as c211's strip folds (P2): only a finer edge near the corner helps. v1-jody's J9 (3be261bd, RefinementReason.FoldAgainstBoundary answered by the host's loop) reports on its scratch regeneration that ANN-MB2 loses every flipped element and its contract holds, so this ticket closes with J9's merge: check face 1466 in the corpus run after it.
