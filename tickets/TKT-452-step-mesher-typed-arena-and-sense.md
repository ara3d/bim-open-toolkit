---
id: TKT-452
title: STEP mesher: the layer 1 arena API takes typed parameters (CurveParameter, UvPoint) and returns Projection; topology senses are Sense, not Boolean
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/00-foundation/**, sandbox/step-brep-mesh/01-geometry/**, sandbox/step-brep-mesh/02-topology/**, sandbox/step-brep-mesh/03-step/**, sandbox/step-brep-mesh/04-discretization/**, sandbox/step-brep-mesh/05-face-meshing/**, sandbox/step-brep-mesh/06-mesh/**, sandbox/step-brep-mesh/07-validation/**, sandbox/step-brep-mesh/08-pipeline/**, sandbox/step-brep-mesh/10-editing/**, sandbox/step-brep-mesh/11-repair/**, sandbox/step-brep-mesh/reviews/verdicts-cpu64.tsv]
workflow: [W3]
related: [TKT-435]
confidence: medium
created: 2026-10-22
---

## Acceptance criteria

- [ ] Eval(g, c, t) takes a CurveParameter and Eval(g, s, uv) a UvPoint (01-geometry/geometry-curves.library.plato:86, geometry-surfaces.library.plato); ClosestParameter returns ClosestParameterResult and Project returns Projection; the typed views in 01-geometry/geometry-views.library.plato become the only form
- [ ] EdgeDiscretization.Parameters is Array<EdgeParameter>, and ToCurveParameter is the one conversion and reads SameSense (FINDINGS F-58 item 4)
- [ ] BrepEdge.SameSense, BrepFace.SameSense and FaceBound.Orientation are Sense, and CoedgeRunsForwardOnCurve is a Compose of senses (02-topology/topology.library.plato:470)
- [ ] The 25 NormalOr(..., +z) fallbacks become SurfaceNormal matches, or the commit lists why each stays
- [ ] All laws type-check and keep their verdicts, except named fixes

Review: docs/plans/step-mesher-types-review-2026-10-22.md (TKT-435). CurveParameter has 0 references in layers 3 to 11; 113 Number parameters in layers 0 to 2 are named t; UvCoordinate has 578 references against UvPoint's 69. Wrong unit or space is 5 of the 58 defects (UvGap over radians and millimetres; ToCurveParameter ignoring SameSense). The widest change in the review: layer by layer, bottom up, one commit per layer. Waits for the version 1 wave (TKT-323) to close: it edits library files the version 1 tracks read. Then a builder edits the library directly, one layer per commit, running the laws of each layer it touches before and after (python -I sandbox/step-brep-mesh/tools/plato_laws.py, cpu64); verdicts must not change except named fixes.
