---
id: TKT-496
title: STEP mesher: ImageInFace rebuilds the face's coedge sites once per coedge
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/uv-regions.library.plato, sandbox/step-brep-mesh/05-face-meshing/face-meshing-domain-once.library.plato, sandbox/step-brep-mesh/05-face-meshing/uv-regions-given.laws.plato]
workflow: [W3]
related: [TKT-323]
created: 2026-10-22
---

## Acceptance criteria

- [ ] LoopToUv reads the face's seam set built once per face (SeamEdgesOnce) instead of IsSeamEdgeOf per coedge, and skips the seam test when the edge has no single pcurve on the face
- [ ] Law_ImageInFaceGivenAgrees and Law_LoopToUvGivenAgrees hold on every TriangulatedWitness
- [ ] The corpus digests are unchanged

Finding 5 of docs/plans/step-mesher-algorithmic-performance-2026-10-22.md: ImageInFace (uv-regions.library.plato) calls IsSeamEdgeOf per coedge, which rebuilds every coedge site of the face, O(C_f^2) per face, and the && evaluates it even when the edge has no pcurve on the face.
