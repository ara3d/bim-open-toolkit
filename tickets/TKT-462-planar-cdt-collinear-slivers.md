---
id: TKT-462
title: Planar CDT emits sliver triangles with collinear corners (12 u-blox files)
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-323, TKT-412]
confidence: high
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] no element of the 2026-10-22 corpus has 2*area/longest^2 below 1e-9 (today: slivers on 12 files)
- [ ] a law over a witness plane whose boundary holds three or more collinear consecutive points shows no triangle has collinear corners

Corpus run 2026-10-22 (docs/plans/step-mesher-corpus-2026-10-22.md), chunk P7. Layer 5's triangulation of plane faces with many collinear boundary points emits triangles whose three corners lie on one line: RCB-F9T face 874 (12 loops, 559 edges) has a triangle with corners 186, 187 and 169 on y = -12.72, z = 0.5, spanning x = -32.8 to 33.8 mm (2*area/longest^2 2.7e-17). Files: SARA, SARA-G3xx-02, SARA-N2, SARA-R4-N4, SARA-R5xx, NORA-B100, B101, B106, NEO, PAM, M2-ZED-F9T-20B-00, RCB-F9T; 2 to 22 slivers (relative area under 1e-6) per failing face. The harness reported them as degenerate, flipped or over chordal (separate ticket). Found with a probe over bim-open-data b2cfaf3; the meshes are MeshFile's (digests equal).
