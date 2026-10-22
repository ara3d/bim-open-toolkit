---
id: TKT-411
title: STEP mesher: 30 three-edge sphere, cone and cylinder faces throw ArgumentOutOfRangeException in face meshing (index out of range)
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-313, TKT-325]
created: 2026-10-21
kind: defect
---

## Acceptance criteria

- [ ] CEL/LENA-R8.STEP faces 202, 203 and 204 (sphere, 1 loop, 3 edges) and SHO/MAYA-W160.step face 3337 (cone, 3 edges) mesh, or get a located diagnostic, with no exception leaving MeshFace
- [ ] The corpus rerun reports no ArgumentOutOfRangeException

Found by the corpus rerun of 2026-10-21 (library 8984df4b): 18 sphere faces, 7 cone faces and 5 cylinder faces throw 'Index was out of range. Must be non-negative and less than the size of the collection. (Parameter index)' out of layer 5, in 7 files: CEL/LENA-R8.STEP, CEL/MPCI.STEP, POS/M2-ZED-F9T-25B-00.STEP, SHO/MAYA-W160.step, SHO/MAYA-W260_REVC.step, SHO/NORA-B100.step, SHO/NORA-B120.step. Every sphere and cone case has one loop of three edges (CEL/LENA-R8.STEP faces 202 to 204; POS/M2-ZED-F9T-25B-00.STEP face 753; SHO/MAYA-W160.step faces 3337 and 3638); the cylinder cases are SHO/MAYA-W260_REVC.step faces 1566, 1577 (8 edges) and 1588 (6 edges). The host isolates the throw (HOST-LIBRARY-THREW), so only these faces are lost. The harness's per-face stage table (time mode) names the stage; the stack is in the summary's failure line.
