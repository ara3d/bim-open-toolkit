---
id: TKT-477
title: STEP mesher: coincident pairs of manifold edges in one closed shell (LENA-R8 19, ANNA-B4 1, ODIN-W260 1) leave mesh boundary edges, and merging them makes non-manifold edges
status: open
depends_on: []
owner:
fence: []
workflow: [W3]
related: [TKT-467]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] Each of the 21 pairs is classified (two manifold edges of distinct faces meeting at one place, or one edge written twice) with the faces that cite them
- [ ] SHO/ANNA-B4.step and SHO/ODIN-W260.STEP mesh their pairs without boundary edges, and CEL/LENA-R8.STEP stays at 0 non-manifold and 0 misoriented edges

Found by TKT-467 (track v1-jody, J6, 2026-10-22). Within a declared-closed shell, pairs of edges at the same two vertices (after merging coincident vertices) along agreeing curves, each already cited by two faces: CEL/LENA-R8.STEP 19 pairs (B-spline edges on extrusion+plane faces, with 20 coincident vertex pairs), SHO/ANNA-B4.step 1, SHO/ODIN-W260.STEP 1 (line edges, plane+plane). A first version of J6's sewing merged them, which closed ANNA-B4 (4 boundary mesh edges to 0, 58/59 to 59/59 closed shells) and cut ODIN-W260's boundary from 17 to 13, but turned LENA-R8 from 0 to 20 non-manifold and 0 to 40 misoriented edges, since a merged pair becomes one edge of four faces. J6 now sews only edges cited once, so all 21 stay as written. The boundary edges in ANNA-B4 and ODIN-W260 are a mesh-assembly effect of two manifold edges at one place; LENA-R8's pairs show that merging is not the general answer.
