---
id: TKT-486
title: STEP mesher: Check_SplitVerticesDiffer rebuilds the split mesh for every pair of split vertices
status: open
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/v1-faces/**, sandbox/step-brep-mesh/07-validation/validation-checks-mesh.library.plato]
workflow: [W3]
related: [TKT-482, TKT-323]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] The check builds the split mesh once and compares only split vertices of one source vertex (a sort, then pairs within each source vertex's copies)
- [ ] An agreement law shows the new form gives the pairwise form's verdict on small witnesses that fail and hold
- [ ] The full sweep on HEAD plus sandbox/step-mesh-staging/gallery-witnesses passes its witness phase in about a minute, with no verdict changed

Check_SplitVerticesDiffer (07-validation/validation-checks-mesh.library.plato:642) runs Law_SplitVerticesDiffer (06-mesh/mesh-laws-once.laws.plato:207) on every pair of split vertices, and the law builds ToSplitTriangleMesh3D for each pair: n^2 whole-mesh rebuilds for n split vertices. TKT-482's full sweep hung 20 minutes in Witness_CounterboreMeshed's validation on it. Staged by the v1-faces track as F6 (split-differ.*.plato).
