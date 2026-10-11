---
id: TKT-179
title: Move earcut and the shell mesher into Ara3D.Geometry, replacing PolygonTriangulator
status: done
depends_on: []
owner:
fence: [deps/ara3d-sdk/src/Ara3D.Geometry/**, deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Fragments/**, deps/bim-open-data/src/data/Ara3D.Ifc.Mesher/**]
workflow: [W1]
related: [TKT-172]
created: 2026-10-10
closed: 2026-10-11
---

## Acceptance criteria

- [x] Earcut and ShellMesher live in Ara3D.Geometry (ara3d-sdk) with their tests, return indices, and handle holes
- [x] The Fragments reader and Ara3D.Ifc.Mesher Approach1 (Brep.cs, faces with holes) use them; PolygonTriangulator is deleted or its known-issue tests pass

Found in the BOS formats wave (docs/plans/bos-formats.md, Architecture notes). The SDK's PolygonTriangulator fails its own rectangle-with-hole test and returns positions, so the Fragments reader ported earcut (733 lines).

Done 2026-10-11: ara3d-sdk `566f24d`, `c0abe6f`, `24939c1`; bim-open-data `80eee24`, `a0db841` (dropped faces reported; its trailer says TKT-176 by mistake). PolygonTriangulator keeps two forwarders for Studio examples: TKT-191. Approach1 curve density: TKT-190.
