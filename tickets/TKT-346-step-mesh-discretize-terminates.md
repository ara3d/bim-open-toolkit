---
id: TKT-346
title: STEP mesher: edge discretization never returns when an edge does not lie on its face's surface (an inconsistent file hangs the mesher)
status: done
depends_on: []
owner: session 0e4f63ff
session: 0e4f63ff-c9b9-4b15-94b8-0d538d7cb10d
fence: [sandbox/step-mesh-staging/termination/**]
workflow: [W3, W4]
related: [TKT-323, TKT-313, TKT-324, TKT-328]
confidence: high
created: 2026-10-18
claimed: 2026-10-18
closed: 2026-10-19
kind: defect
---

## Acceptance criteria

- [x] a law states that Discretize and RefineEdge terminate on every input: an iteration or segment bound derived from the tolerance and the edge's length, after which the edge is reported as a located diagnostic (for example DISCRETIZE-NOT-CONVERGED) with whatever segments were made. Evidence: merged in 91e6b055; `Law_BoundedDiscretizeWithinSegmentBound` (196 cases) and `Law_RaiseSearchEndsAtCap` pass in reviews/verdicts-cpu64.tsv and on the warm checker 2026-10-19
- [x] a witness reproduces the hang without a file: the unit cube with its plane face #118 replaced by a sphere, cylinder or torus the cube's edges do not lie on; edge 3 now returns within the bound and the mesh reports the diagnostic instead of hanging. Evidence: `TermOffSurfaceCube`; `Law_DiscretizeReturnsOnOffSurfaceEdge`, `Law_RefineEdgeReturnsOnOffSurfaceEdge`, `Law_OffSurfaceCubeMeshReports`, `Law_OffSurfaceEdgeIsDiagnosed` pass in reviews/verdicts-cpu64.tsv (the first three rechecked on the warm checker 2026-10-19)
- [x] the same bound is checked against every other loop in layers 04 and 05 that refines until a tolerance is met, and each loop is either bounded or listed in TRACK.md with why it terminates. Evidence: the loop table in sandbox/step-mesh-staging/termination/TRACK.md, merged in 91e6b055

Found 2026-10-18 by the C# wiring track (TKT-313, bim-open-data f6e45b3): with plane #118 of unit-cube.stp replaced by a curved surface the edges do not lie on, discretizing edge 3 (#56) ran over 15 s alone and a test run hung 646 s; the repro is in the TKT-313 build-log entry of docs/plans/step-reader.md. A corrupt file must give a diagnostic, never a hang, because no exception guard can catch a loop. Possibly related: the topology track's whole-model laws on the torus witness ran past 900 s (plan v2 log). Plan docs/plans/step-mesher-v2.md: works in sandbox/step-mesh-staging/termination only.

## Log

- 2026-10-19, builder 0e4f63ff, staging folder `sandbox/step-mesh-staging/termination` (TRACK.md there has the merge instructions; Status: ready to merge). Cause: layer 4's `RaisedForImages` raised a line's or a conic's count one segment at a time, re-testing every image chord, up to the cap (edge length over the minimum length, 10^4 for the 1 mm line). An edge off its face's surface never passes the image test, so that is 5 x 10^7 segment tests. `RefineEdge` and bisection bisect to the length floor for the same unmeetable image.
- Criterion 1: `DiscretizeBounded` and `RefineEdgeBounded` (doubling then bisecting the raise; images the edge does not lie on left out and reported as `DISCRETIZE-EDGE-OFF-SURFACE` at `KernelEdge`; floor-stopped failures reported as `DISCRETIZE-NOT-CONVERGED`). `Law_Term_BoundedDiscretizeWithinSegmentBound` (196 cases) checks `SegmentBound`: seed spans + requested count + polyline length over the effective minimum length. `Law_Term_RaiseSearchEndsAtCap` reaches the bound and gets the diagnostic.
- Criterion 2: `TermOffSurfaceCube(k)`, the unit box with plane #118 replaced by a sphere, cylinder or torus. Before (pinned CLI acbc9b94, gpu32, budget 60 s): layer 4's `Discretize` of edge 3 exceeds the budget in `RaisedForImages`, `RefineEdge` exceeds it in `RefinedSpan`, and `MeshModel` exceeds it in `DiscretizeAll`. After: edge 3 returns 1 segment on all three, and `Law_Term_WiredMeshReportsOffSurfaceEdge` meshes the cylinder repro through layer 8's loop with the wiring applied, in 5.9 s, with edge 3's finding in the report. 7 of 7 laws pass; verdicts are in `verdicts-gpu32.tsv`. On consistent models nothing changes: equal bit for bit to `Discretize` on the 1 mm box and the cylinder, in 196 cases.
- Criterion 3: the loop table in TRACK.md. Every loop of layers 04 and 05 is either replaced (the raise, and the two bisections, which now leave out off-surface images) or bounded by its array, a pass limit (40, 200, 64) or the length floor, with the reason stated.
- Left for merge: the wiring lines in TRACK.md. The one-line `LoopReport` edit is in layer 08, track G's fence. A request to track T: refinement beside a boundary that is off its surface.
