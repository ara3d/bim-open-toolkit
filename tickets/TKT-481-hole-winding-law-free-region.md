---
id: TKT-481
title: STEP mesher: Law_UvHoleWindingNegative quantifies over arbitrary regions, so it fails on a generated region drawn with the JODY W5/W6 witness
status: open
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/v1-jody/**, sandbox/step-brep-mesh/05-face-meshing/**, sandbox/step-brep-mesh/07-validation/**]
workflow: [W3]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [x] Law_UvHoleWindingNegative takes RegionOf's inputs (m, f, d, c, h) under CanRegion, as Law_UvRegionWindingPositive does (decision F-54), and the claim UvHoleWindingNegative(m, f, r, h) keeps the contracts and layer 7's checks
- [x] The restated law passes on every witness case the runner draws, the JODY W5/W6 witness (case 12) included

Found by V1G-19's merge (v1-gate/TRACK.md): FaceMeshingLaws.Law_UvHoleWindingNegative fails on case 12, the witness model Witness_JodyW5W6Faces322And444And584 (v1-reliability's R2-A, 640a2005). The law takes the region r as a free parameter, so the runner pairs the model with a generated UvRegion unrelated to its faces (case 12: an outer loop with no points, holes at made-up coordinates such as (2, -4.23), sources such as FromEdge(BrepEdgeIndex(-3)); hole 3 winds positively). It asserts a property only RegionOf's result has. Its sibling Law_UvRegionWindingPositive was restated under decision F-54 to take RegionOf's inputs; this law was left with the free region. Not the file's data and not the closed B-spline unwrap.

## Log

- 2026-10-22, session 260aa3fa (track v1-jody, J10): staged as v1-jody/J10.patch. On a patched copy the restated law and the seven region-proof laws pass (25 cases each), and every face of the JODY W5/W6 witness, regioned at the host's 1 mm bound, has no hole, so the failing hole was the generated region's alone.
