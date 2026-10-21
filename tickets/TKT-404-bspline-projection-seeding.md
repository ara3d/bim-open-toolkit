---
id: TKT-404
title: STEP mesher B-spline projection: memo the global-search grid per surface and seed the refinement test's SurfaceDistance from its known uv (ideas 23 and 24)
status: open
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/bspline-seeding/**]
workflow: [W3]
related: [TKT-323, TKT-327, TKT-348, TKT-380, TKT-381]
created: 2026-10-21
---

## Acceptance criteria

- [ ] ProjectBySearchBody's Gu x Gv sample grid is built once per B-spline surface and reused by every query on that surface, with a law that the memoised search equals the unmemoised one bit for bit on every witness
- [ ] SurfaceDistance called from CentroidPointTest and SideSampleOf projects with ProjectNear seeded from the triangle's uv centroid or the side's uv midpoint, with a law that the result is never below the global search's distance (the upper-bound contract) and the verdict file re-established under cpu64
- [ ] An operation-count law over WorkClaim shows global searches per B-spline face bounded by the edge count, not the triangle count

Idea 12 of the speed-ideas evaluation, as run G reshaped it (docs/plans/step-mesher-ideas-evaluation.md, new ideas 23 and 24). Run G counted from source: refinement's SurfaceDistance costs about 2.5 global searches per tested triangle, about 85% of a B-spline face's searches; one search costs about 330 evaluations on the corpus median surface (degree (3, 1), 4 knot pieces; 96% of the 14,184 B-spline surfaces parsed are degree (3, 1)). A 33 x 33 grid with Newton polish was rejected: it changes every projection's bits and its build costs more than three median searches. Staging rules: sandbox/step-mesh-staging/README.md. Cannot be measured on the corpus until TKT-348 lets B-spline files past PrepareModel; the laws are the evidence until then.
