---
id: TKT-494
title: STEP mesher: certify B-spline grid cells by the Filip-Magedson-Markot derivative bound instead of the sampled, projected chordal test; measure first
status: open
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/bspline-bound/**, docs/plans/step-mesher-bspline-bound-2026-10-22.md]
workflow: [W3]
related: [TKT-404, TKT-323, TKT-327, TKT-415]
created: 2026-10-22
---

## Acceptance criteria

- [ ] A results note in docs/plans gives, over the corpus B-spline faces, cells the bound needs at 0.1 mm and 1 mm against the current element count, the true worst deviation of the bound-sized grid, the bound's looseness, bound time against face time, and the share of faces a grid covers; with a verdict
- [ ] If the verdict is yes: the bound is in the library as new files with a law that it holds on the witness surfaces against densely sampled deviation, wired as the certification of grid cells on polynomial B-spline faces, falling back to the sampled test elsewhere
- [ ] If yes: a corpus run against docs/plans/step-mesher-corpus-2026-10-22-late.csv shows no fewer faces meshed, closed shells or contract passes, with B-spline face time before and after

The current grid keep rule (DecideGridChordal, GridElementKeptV1) projects the corner mean and side midpoints of every cell onto the surface; on a B-spline face each projection is a global search of about 330 evaluations (TKT-404). The 2026-10-22 morning run's face tables put B-spline faces at 78% of summed face time (731 s of 940 s), 14,420 of 15,580 on the grid path with a median of one element, and 510 s of that in the grid stage. The bound of Filip, Magedson and Markot (1986): a triangle of parameter legs du, dv deviates from the surface by at most (1/8)(M_uu du^2 + 2 M_uv du dv + M_vv dv^2), with M the maxima of the second partials over the cell, read from the second differences of the control net (convex hull) on a polynomial B-spline. Agent (a) owns the shared grid code and (b) the ruled B-spline strips; this ticket adds new files only.
