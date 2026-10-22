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

- [x] A closed edge whose seeds are only its two ends (no interior breakpoint) is split until each segment meets the angular bound: the corpus's 0.5 mm circles get at least 16 segments at the host's 1 mm chordal bound, not 3
- [x] A law witnesses it on the M2-JODY-W377 spline

Found while fixing TKT-431. Layer 4's bisection (BisectionCached.SegmentFailsCachedCounted, 04-discretization/discretization-ranged-bisection.library.plato) tests a seed span as one segment. On a closed edge with no interior breakpoint (a B-spline with simple knots), the only span is [start, start + period], whose two ends are the same point: the chord has zero length, so TangentDeviation reads 0 (AngleOrZero of a zero vector), the length limit passes, and the sagitta is the loop's diameter. When that diameter is within the chordal bound (the host's bound is 1 mm; the M2-JODY-W377 circles have radius 0.5, 0.45 and 0.2 mm), the span passes, the bisection keeps one segment, and RaisedToCount gives the closed-edge minimum of 3: a triangle, each segment turning 120 degrees against a 15 degree bound. After TKT-431's fix the 24 edges of the two M2-JODY-W377 files come out with 3 segments (8 for the radius-0.2 ones). Any closed clamped B-spline with simple knots and a diameter under the chordal bound has the same defect.

## Cause, checked (2026-10-22)

A probe over the decoded PCIE-UART model (C# regenerated with TKT-431's fix) shows edge 4263: range [0, 1], seeds [0, 1], one plane image, the whole span passes `SegmentFailsOrderedOn`, the bisection keeps 1 segment, and the entry has 3 (parameters 0, 0.25, 0.5, 1). Its two ends are equal, the chord is zero, and the sagitta (the diameter, just under 1 mm) is within the 1 mm bound at the file's 1e-7 tolerance. Edge 4422 (radius 0.2) has the range [5.7e-14, 1 + 5.7e-14]; its ends differ by rounding, a chord of noise in no meaningful direction, which fails the tangent test and is split to the length floor (8): right by accident.

## Fix (staged, track v1-jody, chunk J2)

`sandbox/step-mesh-staging/v1-jody/closed-span.library.plato`: `IsClosedSpan(m, a, b)`, a piece over two different parameters whose points lie within the length tolerance, fails the segment test first (`SegmentFailsClosedCounted`, with the library's `SplitSpanCachedCounted` and `BisectedCachedCounted` copied around it for staging). Only a seed span can have such ends, since the bisection keeps every piece at least the effective minimum length. Merge: the test becomes the first line of `SegmentFailsCachedCounted` and of `SegmentFailsOrderedOn` (TRACK.md).

Laws (`closed-span.laws.plato`, block `V1JodyClosedSpanLaws`, cpu64), with J1's: 8 pass. A clamped closed B-spline loop (ends equal by construction, simple knots, so no breakpoint) at a chordal bound of 1.5, above its diameter: the library bisects it into 1 segment, the staged test into at least 8, each within the angular bound or at the length floor. On every open edge of the ten positive witnesses, at chordal 0.01 and 1, the parameters are the library's. The witness copy of the 0.2 mm record gets the library's parameters.

Corpus check: C# regenerated from library 55a3223c with J1 and J2 wired in (0 degraded bodies), harness `time --path host --parallel --warmup`:

| File | J1 alone | J1 and J2 |
|---|---|---|
| M2-JODY-W377-00C_PCIE-UART | the 10 circles of radius 0.5 and 0.45 mm at 3 segments, the 2 of 0.2 mm at 8; 3,282 triangles | 16 and 8; 3,412 triangles; 0 undiscretized faces |
| M2-JODY-W377-01C_SDIO-UART | the same | the same |

In each file exactly those 10 edges change count; every other edge keeps its segment count.
