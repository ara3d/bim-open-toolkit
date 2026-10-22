---
id: TKT-424
title: STEP mesher: Law_SegmentFloorMet takes any EdgeDiscretization and criteria, not one Discretize made, so it fails on an empty generated discretization under ill-formed criteria
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/04-discretization/**]
workflow: [W3]
related: [TKT-418]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] Law_SegmentFloorMet states the floor on m.Discretize(e, c, floors) under CanDiscretize, as Law_ClosedEdgeHasMinSegments does, and passes

Found 2026-10-22 by the v1-gate track's triage (V1G-5). The failing case in reviews/verdicts-cpu64.tsv is d = EdgeDiscretization(BrepEdgeIndex(0), [], []) with a chordal bound of -2.36: a value Discretize never returns. Gate kind: structure (segment floors keep shared edges matching). Fence: v1-edges.
