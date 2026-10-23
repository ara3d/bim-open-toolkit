---
id: TKT-501
title: STEP mesher inverse searches: sample each curve and pcurve once per edge and reuse the samples on bounded domains (finding 2 of the 2026-10-22 algorithm report)
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/01-geometry/bspline-inverse*, sandbox/step-brep-mesh/04-discretization/**, sandbox/step-brep-mesh/02-topology/topology.library.plato]
workflow: [W3]
related: [TKT-404, TKT-323, TKT-327]
confidence: high
created: 2026-10-22
---

## Acceptance criteria

- [ ] A global curve or pcurve search over a bounded domain samples its entity once per edge (CurveSearchMemo) and every later query on that edge reads the samples; an unbounded direction keeps the per-query window and samples
- [ ] Agreement laws show the memoised ClosestParameter and pcurve ClosestParameter equal the plain ones bit for bit on every witness curve and pcurve, and a work claim shows a memo query makes no sampling evaluation
- [ ] SearchWindow on a domain with both ends finite makes no curve evaluation, and on one with an infinite end evaluates the anchor once and each trial once (agreement law against the former body)
- [ ] The edge stage of the corpus harness is measured before and after on the same machine load, with the times in a note under docs/plans

Finding 2 of docs/plans/step-mesher-algorithmic-performance-2026-10-22.md: MinimizeOverCuts re-samples the curve (25 to 257 evaluations) on every query, and AnchorCounted asks it once per bisection midpoint per pcurve image, EdgeDomain twice per edge. On a bounded domain the window, the cuts, the sample parameters and their points do not depend on the query point. TKT-404 covers the surface grid of ProjectBySearchBody; one memo type (InverseMemo) serves both, threaded down the bisection beside the images.
