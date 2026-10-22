---
id: TKT-461
title: STEP mesher: F3's pole expansion turns three-sided B-spline slivers into not-simple regions (POS/ANN-MB2.step faces 349, 946, 1035, 1654)
status: claimed
depends_on: []
owner: session 0d8c417b
session: 0d8c417b-f6aa-4828-ac07-a9d6f3b535c9
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-411, TKT-412]
created: 2026-10-22
claimed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] A law over a witness cut from ANN-MB2 face 349's region states that its expanded pole segment does not collide with itself or with the two segments that meet it, and fails on the current library
- [ ] POS/ANN-MB2.step meshes 2,088 of 2,088 faces and is closed again

Found 2026-10-22 by the v1-gate track (V1G-14) by the same bisection: 08b97f9e (V1G-7) meshes 2,088 of 2,088 ANN-MB2 faces and is closed; edb4ae49, the merge of F3 and F3b (TKT-411), reports faces 349, 946, 1035 and 1654 not simple, and 43dd439b (bim-open-data 66577fc) still does. Face 349 is a three-sided B-spline sliver: corners (0, 0) at vertex 318, (1.24e-5, 0) at vertex 1743 and (0, 1) at vertex 2362, with vertex 1743 on a collapsed line of the surface. The region tolerance is 1e-5 in u and 0.5 in v (the v speed vanishes near the collapsed line), so the face is 1.24 tolerance units wide in u. Before F3 the vertex stayed one point and the region was a triangle of three segments, which passed. F3's ExpandedPoint expands a pole once the gap exceeds the parameter's floor (PoleGapTolerance) instead of the point tolerance, so vertex 1743 becomes a pole segment from v = 0 to 1 in four steps of 0.25. Each step is half a v tolerance unit, so the segment's own pieces and the two segments arriving at and leaving it come within one tolerance unit of each other (gaps 0, 0.5, 1), and CollidingSegments flags all of them, although all those points are one 3D point (one source, FromVertex 1743). Two repairs to weigh: collisions between segments whose endpoints are identified sources (one 3D point) do not count, as V1G-6's pinch rule does for exact equality; or a pole segment is not sampled finer than the region tolerance along it. Owner: v1-faces (F3's track).
