---
id: TKT-348
title: STEP mesher: PrepareModel throws when one edge's closure test reaches an unwritten function, so 72 of the 88 corpus files mesh nothing
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/03-step/**]
workflow: [W3, W4]
related: [TKT-323, TKT-313]
created: 2026-10-19
kind: defect
---

## Acceptance criteria

- [ ] With BSplinePoint still bodiless (the library at bim-open-data a4298c8, or any later build before TKT-327 lands), CEL/LARA.STEP, CEL/LENA-R8.STEP and CEL/LEXI.STEP pass PrepareModel in the compiled C#: their plane and cylinder faces mesh, and each edge whose closure cannot be decided gets a located diagnostic (edge and curve instance ids) instead of an exception
- [ ] A law states that Reduced and every closure decision it calls return for every curve kind of BrepCurve, including a B-spline whose evaluation is unavailable; a clamped B-spline's closure is decided from its first and last control points, which needs no evaluation
- [ ] The corpus rerun (docs/plans/step-mesher-corpus-2026-10-19.md, How to rerun) reports no file whose cause is PrepareModel

Found 2026-10-19 by the corpus run, step H of docs/plans/step-mesher-v2.md (report: docs/plans/step-mesher-corpus-2026-10-19.md, per-file CSV beside it). Measured library: Ara3D.StepBrep at bim-open-data a4298c8, generated from Plato acbc9b94 and bim-open-toolkit 6aee137d (layers 00 to 07).

72 of the 88 u-blox files (every file with a B-spline edge) end in a NotImplementedException from PrepareModel, so StepMesher.Mesh returns Success with no geometry for 162,385 faces, of which 131,406 are planes and 12,262 cylinders the library already meshes. Only 15,580 faces are B-spline surfaces. Site: StepReading.Reduced, the lambda over m.Edges that calls GeometrySet.RunsBackToStart, then DecidesClosed, then Eval on the curve, which for a B-spline reaches the bodiless BSplineCurveData.BSplinePoint. Census over the 72 files, each edge's RunsBackToStart called alone: B_SPLINE_CURVE_WITH_KNOTS 38,721 of 38,721 edges throw (71 files), the rational complex B-spline 1,657 of 1,657 (34 files), SURFACE_CURVE 21 of 2,131 (1 file, SHO/NINA-B222-W1x2); LINE (340,527), CIRCLE (26,120), ELLIPSE (50) and SEAM_CURVE never throw. Examples: CEL/LARA.STEP edge #109 on curve #93500; CEL/LENA-R8.STEP edge #304815 on curve #301160; CEL/LEXI.STEP edge #4440 on curve #4443 (rational: CEL/LEXI.STEP edge #65038 on curve #65041).

B-spline evaluation itself is TKT-327 (step F). This ticket is the blast radius: an undecidable closure in one edge fails the whole file before any face is meshed, while the same gap in layers 4 and 5 costs only the faces it touches (StepPlatoMesher.Rows isolates them). The host cannot isolate it, because Reduced is one library call. Two fixes, either sufficient: decide clamped B-spline closure from the end control points (no evaluation), or have Reduced treat a closure test that cannot be evaluated as undecided with a diagnostic.
