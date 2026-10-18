---
id: TKT-309
title: Curved faces are triangulated with no interior points, so interior triangles cut through the surface (a quarter cylinder of radius 2, height 1 gives area 3.98 against pi)
status: done
depends_on: []
owner: session 10b9c9c6
session: 10b9c9c6-0052-40f3-a1c2-c12f2f8861d7
fence: [deps/bim-open-data/src/data/Ara3D.MeshKernel/**, deps/bim-open-data/tests/data/Ara3D.MeshKernel.Tests/**, deps.json]
workflow: [W3]
related: [TKT-305, TKT-190]
confidence: medium
created: 2026-10-17
claimed: 2026-10-17
closed: 2026-10-17
kind: defect
---

## Acceptance criteria

- [x] faces on curved surface maps get interior points (or refinement) until every triangle lies within a stated chordal deviation of the surface
- [x] a test on the quarter cylinder asserts the deviation bound and an area within the bound's tolerance of pi
- [x] the refinement is a member of SurfaceMap, not a type test on CylinderMap, so cones, spheres and tori in the STEP mesher (TKT-305) use it

Found 2026-10-17 by the TKT-305 kernel-extraction builder. Earcut adds no interior points and only the boundary of a cylinder ring is densified (FaceMesher's cylinder densification is a type test on CylinderMap). Related to TKT-190 (triangle count versus web-ifc): refinement must be deviation-driven so it does not inflate flat-face counts.

Done 2026-10-17 in bim-open-data 9fa7674. `SurfaceMap.ChordDeviation(Vector2 uv, Vector3 chordPoint)` is a
virtual member (default: distance to `Unproject(uv)`; `PlanarMap` 0; `CylinderMap` exact), and `SurfaceMap.Sag(a, b)`
is its midpoint form. `FaceMesher.AddFace` takes `float maxDeviation = Tolerance.ChordDeviation` (1e-3 m: lengths are
in metres after scaling, 1 mm is the precision building dimensions are given to). Edges are held to 3/4 of the bound,
which keeps every point of a triangle within it over a locally quadratic surface. `RingDensification` cuts boundary
segments by sag, replacing the CylinderMap type test. Earcut triangulates, and `FaceRefinement` flips interior edges
to the less-sagging diagonal, splits those still over at their midpoint, and flips again. Splitting with no flips was
rejected: it gave area 3.1447 > pi (Schwarz's lantern). Quarter cylinder at 1 mm: 60 points, 58 triangles, no
interior point, deviation 7.3e-4, area pi - 3.8e-4. A sphere patch gets interior points and meets the bound. A planar
face's triangles are identical under a bound of 1e-9. Ara3D.MeshKernel.Tests 38+1 skipped to 41+1 skipped;
Ara3D.Ifc.Mesher.Tests 164 before and after, no assertion changed.
