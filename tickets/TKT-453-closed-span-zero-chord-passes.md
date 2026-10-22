---
id: TKT-453
title: STEP mesher: a closed edge's whole span passes the segment test when its ends coincide, so small closed B-spline loops are meshed as triangles
status: open
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/v1-jody/**, tickets/**]
workflow: [W3]
related: [TKT-431, TKT-323]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] A closed edge whose seeds are only its two ends (no interior breakpoint) is split until each segment meets the angular bound: the corpus's 0.5 mm circles get at least 16 segments at the host's 1 mm chordal bound, not 3
- [ ] A law witnesses it on the M2-JODY-W377 spline

Found while fixing TKT-431. Layer 4's bisection (BisectionCached.SegmentFailsCachedCounted, 04-discretization/discretization-ranged-bisection.library.plato) tests a seed span as one segment. On a closed edge with no interior breakpoint (a B-spline with simple knots), the only span is [start, start + period], whose two ends are the same point: the chord has zero length, so TangentDeviation reads 0 (AngleOrZero of a zero vector), the length limit passes, and the sagitta is the loop's diameter. When that diameter is within the chordal bound (the host's bound is 1 mm; the M2-JODY-W377 circles have radius 0.5, 0.45 and 0.2 mm), the span passes, the bisection keeps one segment, and RaisedToCount gives the closed-edge minimum of 3: a triangle, each segment turning 120 degrees against a 15 degree bound. After TKT-431's fix the 24 edges of the two M2-JODY-W377 files come out with 3 segments (8 for the radius-0.2 ones). Any closed clamped B-spline with simple knots and a diameter under the chordal bound has the same defect.
