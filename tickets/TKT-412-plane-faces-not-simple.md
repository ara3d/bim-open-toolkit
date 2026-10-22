---
id: TKT-412
title: STEP mesher: 45 plane faces in 8 corpus files are reported not simple (colliding UV segments) and left unmeshed
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-313, TKT-343]
created: 2026-10-21
kind: defect
---

## Acceptance criteria

- [ ] The 27 twelve-edge single-loop planes (SHO/MAYA-W260_REVC.step and its two siblings, SHO/ODIN-W260.STEP) are shown to be either truly self-intersecting in the file, with the diagnostic kept, or a false collision from the region tolerance, fixed with a law on a witness cut from one of them
- [ ] The corpus rerun reports the not-simple count and each remaining face has a located diagnostic

Found by the corpus rerun of 2026-10-21 (library 8984df4b): FACE-NOT-SIMPLE on 45 plane faces in CEL/LENA-R8.STEP (face 1349, 66 edges), POS/ANN-MB2.step (faces 260, 445, 6 edges), POS/CAM.STEP, SHO/ANNA-B4.step, SHO/MAYA-W260_REVC.step, SHO/MAYA-W261_W271_REVC.step, SHO/MAYA-W266_W276_REVC.step and SHO/ODIN-W260.STEP. By shape: 27 faces with one loop of 12 edges, 7 with 6 edges, 3 with 54, 2 two-loop faces with 14 and 2 with 12. Each is an unmeshed outcome, not an exception; it leaves a hole in the solid. The 12-edge family in the three MAYA files is also where the only non-manifold and misoriented mesh edges of the corpus appear (TKT-413).
