---
id: TKT-416
title: STEP mesher: remove Law_RefinedInteriorMeetsMinAngle; a 30 degree minimum angle is not a version 1 goal
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3, W4]
related: [TKT-343, TKT-323]
confidence: high
created: 2026-10-21
---

## Acceptance criteria

- [ ] Law_RefinedInteriorMeetsMinAngle and any witness or helper used only by it are gone from sandbox/step-brep-mesh/05-face-meshing
- [ ] the law runner over layer 5 reports no new failure against reviews/verdicts-cpu64.tsv

Owner's decision 2026-10-21 (Q1 of docs/plans/step-mesher-v2.md): drop the law rather than waive TKT-343's criterion or add seam segments. The law was left failing at k = 1 when TKT-343 closed on 2026-10-19 because a single boundary segment along the seam makes 30 degrees unreachable on the cylinder and sector.
