---
id: TKT-498
title: STEP mesher: per-point surface facts recomputed per call, per round and in Lift
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/uv-regions.library.plato, sandbox/step-brep-mesh/05-face-meshing/face-meshing-domain-once.library.plato, sandbox/step-brep-mesh/05-face-meshing/refinement-test-cached.*, sandbox/step-brep-mesh/05-face-meshing/triangulation-neighbours-carried.*, sandbox/step-brep-mesh/05-face-meshing/triangulation-fast-marks.*, sandbox/step-brep-mesh/05-face-meshing/face-meshing-lift.*, sandbox/step-brep-mesh/05-face-meshing/collapsed-lines-once.*]
workflow: [W3]
related: [TKT-323]
created: 2026-10-22
---

## Acceptance criteria

- [ ] The collapsed lines of a face's surface are computed once per face in the unwrap, in the refinement and in Lift (a work claim: two CollapsedAt calls per face)
- [ ] Point normals and collapsed-line flags are carried beside the positions through the refinement rounds and computed once per point (Law_CarriedNormalsArePointNormals; a work claim: normals per point at most one)
- [ ] Lift's normals read the collapsed lines once; a Lift from carried positions agrees with Lift (Law_LiftFromPositionsAgrees)
- [ ] The corpus digests are unchanged

Finding 4 of docs/plans/step-mesher-algorithmic-performance-2026-10-22.md.
