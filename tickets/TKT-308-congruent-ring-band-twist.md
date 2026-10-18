---
id: TKT-308
title: A face with one hole of the same vertex count is meshed as a twisted band when the hole winds the same way as the outer ring
status: done
depends_on: []
owner: session 10b9c9c6
session: 10b9c9c6-0052-40f3-a1c2-c12f2f8861d7
fence: [deps/bim-open-data/src/data/Ara3D.MeshKernel/**, deps/bim-open-data/tests/data/Ara3D.MeshKernel.Tests/**, deps.json]
workflow: [W3]
related: [TKT-305]
confidence: medium
created: 2026-10-17
claimed: 2026-10-17
closed: 2026-10-17
kind: defect
---

## Acceptance criteria

- [x] PolygonWithHoles.TryTriangulateCongruentRing checks orientation and coverage as TryTriangulateOffsetRing does, and the face path applies the 1 % area check to its result
- [x] a test: a 4-vertex face with a clockwise 4-vertex hole yields triangles whose area equals the face area minus the hole (12 in the builder's case, not 24) and all face one way

Found 2026-10-17 by the TKT-305 kernel-extraction builder (bim-open-data 2b4104b), behaviour kept unchanged there. The quad-band shortcut for one hole with the outer ring's vertex count runs without the orientation and coverage check and skips the 1 % area check; a clockwise hole gives triangles covering twice the face area, facing both ways. IFC window openings in walls may hit it. The comment in the new Ara3D.MeshKernel.Tests face test records it.

Done 2026-10-17 in bim-open-data 02bb175. The band twists when the hole runs against the outer ring (the
title's "the same way" is the reverse; the test's hole is clockwise inside a counter-clockwise face). The
band is refused when a triangle winds against the band's total or the triangles miss the area between the
rings; its triangles come back counter-clockwise like earcut's; the face path falls through to earcut and
area-checks both. `AddFace_PlanarQuadWithClockwiseQuadHole_CoversTheRingOnceFacingOneWay` gives 12 (24
before). Ara3D.MeshKernel.Tests 35 passed 1 skipped before, 38 passed 1 skipped after; Ara3D.Ifc.Mesher.Tests
164 passed before and after. Left alone: `PolygonWithHoles.Triangulate` normalizes its hole to clockwise
before calling the band, so for extrusion caps the band is now always refused and earcut takes every
one-hole profile; it already fell to earcut through `CoversRing` before this change, so caps are unchanged.
