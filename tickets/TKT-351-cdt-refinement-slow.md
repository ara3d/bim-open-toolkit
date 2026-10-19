---
id: TKT-351
title: Constrained Delaunay refinement (TKT-343) is much slower than the code it replaced: the unit cylinder's side face takes 5 to 10 s at 25 points per circle (72 points took 3.4 s before)
status: claimed
depends_on: []
owner: session ae00416c
session: ae00416c-c93c-426f-83b6-e7512ad06cfe
fence: [sandbox/step-mesh-staging/triangulation/**]
workflow: [W3, W4]
related: [TKT-343, TKT-327, TKT-349, TKT-335]
confidence: high
created: 2026-10-19
claimed: 2026-10-19
kind: defect
---

## Acceptance criteria

- [ ] a profile of RefineToSurfaceByInsertion on the cylinder side face names where the time goes (flip passes, point location, re-triangulation), recorded in TRACK.md
- [ ] the cylinder side face at 72 points per circle edge meshes in under 3.4 s in compiled C# (the old library's time), or the ticket records why it cannot and the bound reached
- [ ] track F's nine laws that hit the time budget while meshing the bump solid, and the plane faces of TKT-349, finish within their budgets, or the remaining cause is filed

Found 2026-10-19 by the C# wiring track (TKT-313) after regeneration with TKT-343 merged: 25 points per circle edge 5.0 to 9.6 s (354 to 360 triangles), 42 points not done in 240 s; the previous generation did 72 points in 3.4 s (142 triangles). Track F (TKT-327) reports nine laws over budget in the same refinement; the corpus run (TKT-349) found 86 s to 8 minutes on large plane faces with the old triangulation. Works in the triangulation staging folder as staged replacements; merged by the supervisor.
