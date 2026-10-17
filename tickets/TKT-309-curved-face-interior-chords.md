---
id: TKT-309
title: Curved faces are triangulated with no interior points, so interior triangles cut through the surface (a quarter cylinder of radius 2, height 1 gives area 3.98 against pi)
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.MeshKernel/**, deps/bim-open-data/tests/data/Ara3D.MeshKernel.Tests/**, deps.json]
workflow: [W3]
related: [TKT-305, TKT-190]
confidence: medium
created: 2026-10-17
kind: defect
---

## Acceptance criteria

- [ ] faces on curved surface maps get interior points (or refinement) until every triangle lies within a stated chordal deviation of the surface
- [ ] a test on the quarter cylinder asserts the deviation bound and an area within the bound's tolerance of pi
- [ ] the refinement is a member of SurfaceMap, not a type test on CylinderMap, so cones, spheres and tori in the STEP mesher (TKT-305) use it

Found 2026-10-17 by the TKT-305 kernel-extraction builder. Earcut adds no interior points and only the boundary of a cylinder ring is densified (FaceMesher's cylinder densification is a type test on CylinderMap). Related to TKT-190 (triangle count versus web-ifc): refinement must be deviation-driven so it does not inflate flat-face counts.
