---
id: TKT-466
title: Two inverted triangles on ANN-MB2's cone face 1466
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-323]
confidence: medium
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] POS/ANN-MB2.step face 1466 meshes with no element whose normal points against the face normal

Corpus run 2026-10-22. POS/ANN-MB2.step face 1466, a one-loop cone face meshed by CDT into 23 triangles: elements 19 and 21 (uv corners near u -2.17 to -2.49, v -0.28 to -0.30) have real area (2*area/longest^2 0.03 and 0.024), every corner on the surface (gaps under 2e-11), and normals against the face normal. Not ANN-MB2's not-simple faces (v1-faces' ticket).
