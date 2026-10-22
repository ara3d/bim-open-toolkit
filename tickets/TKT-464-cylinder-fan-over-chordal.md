---
id: TKT-464
title: Face refinement leaves fan triangles over the chordal bound on a cylinder (c211 face 339)
status: open
depends_on: []
owner: v1-gate
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-323]
confidence: high
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] c211_case_with_odin_v1 face 339 meshes within its chordal bound plus tolerance (exact deviation today 1.324 against 1.01)

Corpus run 2026-10-22. u-blox SHO/c211_case_with_odin_v1.step face 339: a one-loop, 7-edge cylinder face of radius 6, meshed by CDT and refinement into 19 triangles, several of them fans from one vertex spanning about 1.3 rad (uv corners (5.80,4.85) (5.80,-2.4) (6.42,1.56) and the like). The exact distance from the cylinder at a sample of triangle 3 is 1.324, equal to the library's SurfaceDistance, so the excess is real, not the harness's. Refinement stopped with elements whose sagitta exceeds the bound.

Owner: v1-gate: chordal-only refinement leaving fans unsplit (supervisor, 2026-10-22).
