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

- [x] a profile of RefineToSurfaceByInsertion on the cylinder side face names where the time goes (flip passes, point location, re-triangulation), recorded in TRACK.md
- [ ] the cylinder side face at 72 points per circle edge meshes in under 3.4 s in compiled C# (the old library's time), or the ticket records why it cannot and the bound reached
  - 2026-10-19, interpreter only (staged RefineToSurfaceFast, sandbox/step-mesh-staging/triangulation): 72 points 41 s (1372 points, 2598 triangles), from over 1800 s; 25 points 20.4 to 3.2 s. The old code's 3.4 s at 72 points added no interior point (142 triangles, about 5 degrees smallest angle; interpreted 3.3 s), so no refinement that reaches the angle can match it. The C# time waits on the C# track's regeneration with TKT-350 fixed.
- [x] track F's nine laws that hit the time budget while meshing the bump solid, and the plane faces of TKT-349, finish within their budgets, or the remaining cause is filed
  - 2026-10-19: with the staged refinement 2 of the 9 pass in the full sweep (Law_RoundLaws, Law_StateLaws; four layer 8 laws outside the nine also went from budget error to pass); the other 7 still exceed 120 s, every one meshing the bump solid, now in B-spline projection, Lift and validation of an oversized mesh (2474 triangles on its top face), filed as TKT-352. The plane faces of TKT-349: a 200-point plane face's seed 5.9 to 2.1 s interpreted; the corpus faces themselves were not rerun.

Found 2026-10-19 by the C# wiring track (TKT-313) after regeneration with TKT-343 merged: 25 points per circle edge 5.0 to 9.6 s (354 to 360 triangles), 42 points not done in 240 s; the previous generation did 72 points in 3.4 s (142 triangles). Track F (TKT-327) reports nine laws over budget in the same refinement; the corpus run (TKT-349) found 86 s to 8 minutes on large plane faces with the old triangulation. Works in the triangulation staging folder as staged replacements; merged by the supervisor.
