---
id: TKT-418
title: STEP mesher: split layer 5's face laws into the version 1 gate (watertight, oriented, covering, chordal) and the improvement pass (quality)
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**, sandbox/step-brep-mesh/10-editing/**, sandbox/step-brep-mesh/tools/**]
workflow: [W3, W4]
related: [TKT-356, TKT-349, TKT-352, TKT-416, TKT-417]
confidence: high
created: 2026-10-21
---

## Acceptance criteria

- [ ] every law in sandbox/step-brep-mesh/05-face-meshing is listed as gate (states closure, orientation, coverage, or chordal tolerance) or quality (angles, aspect, side-normal turn, slivers, refinement targets), in the layer README
- [ ] quality laws move to the improvement pass's folder or are tagged so the version 1 law run skips them; the version 1 run reports only gate laws
- [ ] a gate law checks that both diagonal splits of every quad are within the chordal tolerance and oriented
- [ ] plane faces are triangulated from boundary and holes with no refinement, and the gate laws pass on the unit cube, the cylinder, and the bump solid witnesses

Owner's decision 2026-10-21: the version 1 mesh contract in sandbox/step-brep-mesh/README.md. Quality is a later pass; long thin elements are acceptable.
