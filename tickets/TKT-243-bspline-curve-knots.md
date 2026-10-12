---
id: TKT-243
title: B-spline curves evaluated from knots and weights instead of the control polygon
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Ifc.Mesher/BSplineCurves.cs, deps/bim-open-data/src/data/Ara3D.Ifc.Mesher/BSplineEvaluator.cs, deps/bim-open-data/src/data/Ara3D.Ifc.Mesher/GeometryCoverage.cs, deps/bim-open-data/tests/data/Ara3D.Ifc.Mesher.Tests/BSplineCurveTests.cs]
workflow: [W3]
related: [TKT-65, TKT-190]
created: 2026-10-11
---

## Acceptance criteria

- [ ] IFCBSPLINECURVEWITHKNOTS and IFCRATIONALBSPLINECURVEWITHKNOTS are evaluated with their knots and weights (de Boor), and a quarter circle expressed as a rational quadratic NURBS samples within 1e-4 of the true circle
- [ ] The three B-spline curve rows move from Partial to Supported in GeometryCoverage with a [GeometryCoverage] test each

Track C of docs/plans/ifc-mesher-roadmap.md; DigitalHub has 20,904 trimmed curves and 1,314 advanced breps and is TKT-190's file.
