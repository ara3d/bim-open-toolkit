---
id: TKT-274
title: SDK polygon self-intersection sweep never detects a crossing
status: open
depends_on: []
owner:
fence: [deps/ara3d-sdk/src/Ara3D.Geometry/**, deps/bim-open-data/tests/data/Ara3D.MeshKernel.Tests/**]
workflow: [W3]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] Ara3D.Geometry's HasSelfIntersectionsSweep returns a crossing for a bow tie and a figure eight, and the ignored test SelfIntersection_BowTieIsDetected in Ara3D.MeshKernel.Tests runs and passes

Found 2026-10-11 by the B1 builder of docs/plans/ifc-mesher-kernel.md: the SDK sweep returned null for five crossing shapes, so the mesher's self-intersection guards in PolygonWithHoles never fire. Unknown whether a real model is affected.
