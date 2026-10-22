---
id: TKT-425
title: STEP mesher: Law_SagittaIsAttained fails on B-spline fixture 12 (k = 12, a = -9.39, b = -3)
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/04-discretization/**]
workflow: [W3]
related: [TKT-410]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] Law_SagittaIsAttained passes on every generated case, or the failing case is shown to be outside the law's intent (both parameters clamped to one end of the domain) and the law guards it

Found 2026-10-22 by the v1-gate track's triage (V1G-5); cause not named in the time box. Both a and b lie below the domain, so DomainAt may clamp t0 and t1 to the same end, giving an empty interval on which Sagitta and EstimatedSagitta disagree; or fixture 12's estimate is short of the true sagitta, which would make the edge chordal bound unsafe on that spline. Gate kind: chordal (an edge's segments within the chordal bound). Fence: v1-edges.
