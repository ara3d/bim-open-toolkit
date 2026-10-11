---
id: TKT-190
title: FM_ARC_DigitalHub meshes to 1.45 times web-ifc's triangle count since small brep faces mesh
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Ifc.Mesher/**, deps/bim-open-data/tests/data/Ara3D.Ifc.Mesher.Tests/**, deps/bim-open-data/tests/data/Ara3D.IfcMeshingComparison/**, deps/bim-open-data/bench/ifc-mesher/**]
workflow: [W2]
related: [TKT-179, TKT-188]
created: 2026-10-10
kind: defect
---

## Acceptance criteria

- [ ] On FM_ARC_DigitalHub the triangle count is within 10 % of web-ifc's 311,811 and the merged-mesh score is back at 0.729 or above, without losing the 3599/3599 instances and 769/769 entity boxes

Found by chunk T179 (docs/plans/bos-middle-layer.md), 2026-10-10. Moving the mesher to Earcut made 2,266 of 2,290 previously dropped centimetre-scale brep faces mesh; triangles rose from 279,188 to 452,837 and the merged-mesh score fell from 0.729 to 0.705. The suspected cause is that the mesher's curve sampling (`CurveEvaluator` and the files split from it) is denser than web-ifc's; this was inferred from the counts, not measured per curve, and the first step is to measure it on a few of the brep faces. 24 folded rings are left out by Earcut.Deviation. The parity scorecard over the quick files is `deps/bim-open-data/bench/ifc-mesher/`; TKT-65 holds the other open gaps.
