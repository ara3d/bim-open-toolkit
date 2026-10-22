---
id: TKT-474
title: STEP mesher: a planar face of POS/SAM_AP203 and AP214 (faces 7 and 19) fails PlanarFaceAreaMatchesGreen
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/07-validation/**]
workflow: [W3]
related: [TKT-441]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] PlanarFaceAreaMatchesGreen passes on both SAM files' prepared models, or the face's defect is named

Found by layer 7's checks on every corpus file (TKT-441; docs/plans/step-mesher-reliability-2026-10-22.md (TKT-441 section); run: step-corpus-harness all <corpus> <out> 300 --child laws, bim-open-data 97495d8, library before J5): fails on raw and prepared models of both files (worst 1, bound 0: the check's Boolean form), at KernelFace(7) in AP203 and KernelFace(19) in AP214. Cause not traced: a loop orientation, a hole outside its outer loop, or the oracle.
