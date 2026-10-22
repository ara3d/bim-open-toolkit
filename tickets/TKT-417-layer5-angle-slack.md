---
id: TKT-417
title: STEP mesher: layer 5's angular face laws allow the Tolerances.Angle slack layer 4's laws already allow
status: done
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3, W4]
related: [TKT-324, TKT-351]
confidence: high
created: 2026-10-21
closed: 2026-10-21
---

## Acceptance criteria

- [ ] every angular comparison in layer 5's face laws compares against the bound plus m.Tolerances.Angle.Value, as discretization.laws.plato does
- [ ] refinement uses the same slack, so a strip triangle between two 24-gons that turns by exactly 15 degrees is not split; the unit cylinder's 268-triangle side faces lose most of their 110 interior points (count before and after recorded here)
- [ ] the law runner over layer 5 reports no new failure against reviews/verdicts-cpu64.tsv

Owner's decision 2026-10-21, on the question raised in TKT-324's notes: SurfaceAngular and the edge angular bound are both 15 degrees and layer 5 compared without tolerance, so refinement split triangles at exactly the bound.

## Superseded, 2026-10-21

The version 1 mesh contract (`sandbox/step-brep-mesh/README.md`) takes layer 5's angular laws out of the version 1 gate (TKT-418), so widening them no longer matters for version 1. The improvement pass may take the slack up when it restates them.

## Closed with criteria unmet

2026-10-21: Superseded by the version 1 mesh contract (owner, 2026-10-21): layer 5's angular laws leave the version 1 gate (TKT-418)
