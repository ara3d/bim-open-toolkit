---
id: TKT-500
title: STEP mesher: ruled (degree-1 direction) B-spline faces meshed as quad grids whose chordal accuracy is certified from the rails' Bezier hulls, with no surface projections
status: open
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/ruled-grid/**, sandbox/step-brep-mesh/05-face-meshing/ruled-grid*.plato, docs/plans/step-mesher-ruled-grid-2026-10-22.md]
workflow: [W3]
related: [TKT-404, TKT-415, TKT-435, TKT-455, TKT-494, TKT-409]
created: 2026-10-22
---

## Acceptance criteria

- [ ] A law states the per-cell bound on a ruled, non-rational B-spline face: every surface point over a grid cell lies within max(rail deviations) + |warp|/4 of both diagonal splits of the cell, checked at sample points on witness faces (a swept cubic profile and corpus faces from c211_case_with_odin_v1)
- [ ] The ruled decision never calls SurfaceDistance or a projection: on the ruled witnesses every grid element is certified and the fallback count is zero (a law on the decision's report)
- [ ] Where the face is not ruled, is rational, or a cell the certificate refuses, the decision is the shared GridUnlessFoldedOrCoarse, bit for bit (law)
- [ ] The grid keep laws (grid-keep.laws.plato, grid-chordal.laws.plato) and every previously passing law of the touched libraries keep their verdicts
- [ ] A corpus run against docs/plans/step-mesher-corpus-2026-10-22-late: faces meshed no fewer, closed shells no fewer, contract holds on no fewer files; B-spline face-stage time and c211_case_with_odin_v1's time before and after, timed back to back
- [ ] A results note in docs/plans/ names which corpus B-spline faces are ruled and which are not

Faces are 76 s of about 177 s over the 88 u-blox files, and c211_case_with_odin_v1 spends 21.5 s of 26.5 s in faces, mostly B-spline. The corpus census here: 837 B-spline surfaces in 12 of the 88 files; 357 are degree (3, 1) polynomial and 17 degree (1, 3) polynomial (ruled, 45%), 37 are ruled but rational with unequal weights, 426 are not ruled (274 of them degree (3, 2) rational). A degree-1 direction makes the surface a convex combination of two control-row curves within each knot span, so a bilinear cell between two rail chords deviates from the surface by at most the larger rail's parametric chord deviation (a Bezier hull certificate on the rail minus its degree-elevated chord), and a split triangle deviates from the bilinear cell by at most a quarter of the warp vector A - B + C - D. The decision therefore needs four evaluations per cell for the fold test and none for the chordal test. Rational ruled surfaces fall back to the shared decision. Staged in sandbox/step-mesh-staging/ruled-grid/, merged as new files ruled-grid.{types,library,laws}.plato in layer 05 with a one-line wiring of GridUnlessFoldedOrCoarse (grid-chordal.library.plato), which the analytic-grid track owns.
