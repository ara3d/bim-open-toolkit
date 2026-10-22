---
id: TKT-470
title: STEP mesher: zero-thickness double sheets (two coincident faces of opposite sense on the same edges) make 108 non-manifold and 216 misoriented edges in M2_JODY-W5 and W6 CARD
status: open
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/v1-jody/**, sandbox/step-brep-mesh/03-step/**]
workflow: [W3]
related: [TKT-467, TKT-323]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] A law over a witness box with a zero-thickness sheet glued in (two coincident faces of opposite sense bounded only by the edges they share with each other) states that preparation gives the box, with one located repair diagnostic naming both faces, and fails on the current library
- [ ] A pair whose edges other faces also cite is kept and reported, not dropped
- [ ] M2_JODY-W5 and W6 CARD mesh closed and oriented (0 non-manifold, 0 misoriented edges), and every other corpus file is unchanged

Found by track v1-close (2026-10-22): the 108 non-manifold and 216 misoriented edges of M2_JODY-W5 and W6 CARD come from two zero-thickness double sheets in the B-rep. Faces 168 and 1085 (surfaces 447 and 1311) and faces 622 and 897 (surfaces 1318 and 1312) are coincident planes at z = -1.292096 with opposite sense, sharing every position and bounded only by edges they share with each other (335, 1751, 2822 and 1397, 1953, 3015). Both faces of a pair triangulate the same polygon, so every interior diagonal is used four times. Rule (from the v1 supervisor): PrepareModel finds a pair of faces of one shell with opposite sense, on coincident surface geometry, bounded by the same edges, where those edges belong to no other face; it drops both faces and records a located repair diagnostic naming them. If a pair's edges are shared with other faces, it keeps the pair and reports it without dropping.
