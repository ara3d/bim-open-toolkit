---
id: TKT-431
title: STEP mesher: 24 closed B-spline edges in the two M2-JODY-W377 files return 0 segments, leaving 24 one-edge plane faces undiscretized
status: open
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/v1-jody/**, tickets/**]
workflow: [W3]
related: [TKT-410, TKT-323]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [x] SHO/M2-JODY-W377-00C_PCIE-UART.step and SHO/M2-JODY-W377-01C_SDIO-UART.step report 0 undiscretized faces, or this ticket names the cause and the fix
- [x] A law witnesses the cause on a one-edge closed B-spline loop

Found by the TKT-410 corpus rerun (2026-10-22, Plato c8c83c8b). 24 B-spline edges, 12 in each of the two M2-JODY-W377 files (PCIE-UART edges 4263, 4264, 4265, 4422, 4423, ...), return 0 segments without an exception. Each is the only edge of a one-edge plane loop, so 24 plane faces are reported PIPELINE-FACE-UNDISCRETIZED. Before TKT-410 these edges threw in SagittaByHullBoundGiven. Suspect: a closed single-edge B-spline loop whose bisection or hull sagitta gives no interior points (layer 04-discretization).

## Cause (2026-10-22)

Every one of the 24 edges is an EDGE_CURVE from a vertex back to itself on a cubic B_SPLINE_CURVE_WITH_KNOTS with 19 control points, 23 knots of multiplicity 1, and its last 3 control points equal to its first 3: a periodic spline written unclamped (closed_curve .T., which the decoder does not keep). Ten are circles of radius 0.5 or 0.45 mm with uniform knots (PCIE-UART #64592 for edge 4263); two per file (4422 and 4423, PCIE-UART #66971 and #67024) are circles of radius 0.2 mm whose knots repeat only to the 13 digits the file prints, their end spacings differing by up to 2e-14.

Layer 3's `EndsClosure` (03-step/step.library.plato) decides a B-spline's closure from its record and returns Undecided for every unclamped one, so `ClosureMarks` writes no Closed mark and layer 1's `Domain` stays Aperiodic. Layer 2's `TraversalDomain` then gives a closed edge on an aperiodic curve the degenerate range [a, a], and layer 4's `DiscretizeEdgeRangedCounted` returns `Undiscretized` for `range.Start < range.End` false. No exception, 0 segments. Before TKT-410 the same edges threw in the generated stub instead.

## Fix (staged, track v1-jody, chunk J1)

`sandbox/step-mesh-staging/v1-jody/wrapped-spline-closure.library.plato`, `EndsClosureWrapped`: an unclamped record is decided closed, without evaluating it, when it is in wrapped form: at least 2p control points, the last p within the length tolerance of the first p with equal weights, and the end knot spacings equal to the start ones up to a mismatch whose first-order effect on the end point (p times the mismatch over the smallest start spacing times the spread of the start's control points) keeps the end gap within the tolerance. Every other unclamped record stays Undecided. Merge: `EndsClosure(d, tol)` => `d.EndsClosureWrapped(tol)` (TRACK.md has the steps).

Laws (`wrapped-spline-closure.laws.plato`, block `V1JodyWrappedSplineClosureLaws`, cpu64): 5 pass. Both corpus records are closed by the record test and Undecided by `EndsClosure`; their evaluated ends are their loop's vertex; a record with its last point or last knot moved stays Undecided; every catalog-arena record `EndsClosure` decides gets the same decision; and a closed edge on either record has the domain [0, 0] and is Undiscretized without the mark (the defect), and [0, 1] and discretized with it.

Corpus check: C# regenerated in a scratch clone (Plato c8c83c8b, library 55a3223c with the fix wired into `EndsClosure`; 0 degraded bodies), `step-corpus-harness time <file> <prefix> --path host --parallel --warmup`:

| File | Library 55a3223c | With the fix |
|---|---|---|
| M2-JODY-W377-00C_PCIE-UART | 12 edges with 0 segments, 12 undiscretized faces; 3,260 triangles | 0, 0; 3,282 triangles |
| M2-JODY-W377-01C_SDIO-UART | 12, 12; 3,260 triangles | 0, 0; 3,282 triangles |

The 24 edges now come out with 3 segments (8 for the radius-0.2 ones): too coarse for the 15 degree angular bound. That is a second defect, in layer 4's segment test, filed separately (see Related).

Not caused by this fix: the committed C# (bim-open-data e646e28) meshes PCIE-UART to 6,698 triangles; C# regenerated from library 55a3223c without the fix gives 3,260, 256 plane faces fewer triangles each (face 30: 24 to 10). That change comes from library commits after the committed C#.
