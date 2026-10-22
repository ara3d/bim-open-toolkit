---
id: TKT-459
title: STEP mesher: a B-spline surface parameter's floor is the length tolerance in parameter units, so B-spline regions are judged 13 to 1000 times too loosely
status: claimed
depends_on: []
owner: session 0d8c417b
session: 0d8c417b-f6aa-4828-ac07-a9d6f3b535c9
fence: [sandbox/step-brep-mesh/01-geometry/geometry-surfaces.library.plato, sandbox/step-brep-mesh/01-geometry/*.laws.plato, sandbox/step-mesh-staging/v1-faces/**]
workflow: [W3]
related: [TKT-412, TKT-411, TKT-421]
created: 2026-10-22
claimed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] A B-spline strip witness about 0.2 mm wide whose parameters move 10 and 24 mm per unit meshes (before: FACE-ZERO-WIDTH)
- [ ] Unit-speed parameters (planes, cylinder and cone heights, lines) and angle parameters keep exactly today's floor, stated by a law over the witness models
- [ ] SHO/c211_case_with_odin_v1.step's B-spline faces 32, 45, 82, 92, 94, 259, 260, 262, 263 and POS/ANN-MB2.step's 349, 946, 1035, 1654 mesh, and the corpus files whose faces mesh on 2026-10-22 keep meshing every face

Found 2026-10-22 by v1-faces while grouping the corpus run's 53 unmeshed faces (library 43dd439b). ParameterFloorAlong (01-geometry/geometry-surfaces.library.plato) gives every parameter that is not an angle the length floor, tol.LengthParameter, which is the length tolerance itself (ResolvableLength). That is right for a unit-speed parameter. A B-spline surface's parameters move at any speed: c211's B-spline faces move 24 to 25 mm per unit in u and 13 to 15 in v, so the floor (0.01 in parameter units) is 0.13 to 0.25 mm in space and swamps the speed-based tolerance 0.01/(2 x 24) = 2e-4 in RegionTolerance and PointTolerance. Real strips 0.17 to 0.3 mm wide (face 92: 15 mm long) read as FACE-ZERO-WIDTH (32, 82, 92, 94), and segments 0.2 mm apart read as colliding (45, 259, 260, 262, 263). ANN-MB2's four three-edge faces (12 x 3 micrometres, u speed 1010, file tolerance 1e-5) became not simple when F3 (edb4ae49) expanded their collapsed corner into a pole segment: the strip that leaves is 1.24e-5 wide in u against a u floor of 1e-5. The curve floors (ParameterFloorOf in geometry-curves.library.plato) have the same shape for B-spline curves; not measured.
