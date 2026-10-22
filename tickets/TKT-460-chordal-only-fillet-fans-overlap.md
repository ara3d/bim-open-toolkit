---
id: TKT-460
title: STEP mesher: chordal-only refinement leaves tiny mitred fillets as boundary fans that overlap their neighbours, so SHO/ODIN-W160 is no longer closed (8 non-manifold, 16 misoriented edges since V1G-4)
status: claimed
depends_on: []
owner: session 5135435e
session: 5135435e-eb61-4194-b168-7b93c64dd2fe
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-399, TKT-421, TKT-455]
created: 2026-10-22
claimed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] A law over a witness cut from ODIN-W160's quarter-cylinder fillet (radius about 0.2 mm, two end arcs shared with mitred neighbours, bound 1 mm) states that no element of the face lies in the plane of a shared end arc, and fails on the current library
- [ ] SHO/ODIN-W160.STEP is closed and oriented again, with no rise in flipped elements elsewhere: ANN-MB2 at most 1 face with flipped elements, moon_buggy_asm.stp 0

Found 2026-10-22 by the v1-gate track (V1G-14), bisecting scratch regenerations over the merges since 6ee49f68 with the host and harness at bim-open-data 66577fc. 22dbd3d0 is closed and oriented; 568541ff, the merge of V1G-4 (curved faces refined against the chordal bound alone), has the 8 non-manifold and 16 misoriented edges that 43dd439b (bim-open-data 66577fc) still has. All bad edges are interior diagonals of four quarter-cylinder fillets, faces 3364, 3398, 3414 and 3431 (radius about 0.2 mm, quarter turn, about 13 mm long), each used by elements of two of these faces: the fillets meet at mitred corners and share their end arcs. Each face is now its 8 boundary points and 6 triangles (500 to 684 before V1G-4): its end arcs run diagonally in the face's parameters, so it gets no quad grid; the CDT fans each arc's points into flaps (for face 3364, triangles (1 2 0) and (2 3 0)) that lie in the arc's plane, at 52 to 63 degrees from the face normal, so both faces that share the arc cover the same planar patch. They are within the 1 mm chordal bound because the whole fillet is; chordal-only refinement never adds a point. F4b's edge-on mark (over 80 degrees) does not reach them, and an angle pass on edge-on triangles changes nothing. Before V1G-4 the 15 degree element-normal test split them. Tried on a scratch copy of 43dd439b: an element-normal bound of 45 degrees in the chordal round (in place of 180) makes ODIN-W160 closed and oriented, but the harness's contract check then finds flipped elements on 21 ANN-MB2 faces (1 at 43dd439b, 97 before V1G-4) and on moon_buggy's 3 cones (0 at 43dd439b). So the fix needs a rule that refuses flaps lying in a neighbour's arc plane without driving refinement where it folds elements: for example a covering test against the shared edge's other face, or a grid for four-sided faces whose sides are boundary curves rather than iso-lines. Owner: v1-gate (V1G-4's track).
