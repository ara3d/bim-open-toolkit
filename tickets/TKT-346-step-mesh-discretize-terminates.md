---
id: TKT-346
title: STEP mesher: edge discretization never returns when an edge does not lie on its face's surface (an inconsistent file hangs the mesher)
status: open
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/termination/**]
workflow: [W3, W4]
related: [TKT-323, TKT-313, TKT-324, TKT-328]
confidence: high
created: 2026-10-18
kind: defect
---

## Acceptance criteria

- [ ] a law states that Discretize and RefineEdge terminate on every input: an iteration or segment bound derived from the tolerance and the edge's length, after which the edge is reported as a located diagnostic (for example DISCRETIZE-NOT-CONVERGED) with whatever segments were made
- [ ] a witness reproduces the hang without a file: the unit cube with its plane face #118 replaced by a sphere, cylinder or torus the cube's edges do not lie on; edge 3 now returns within the bound and the mesh reports the diagnostic instead of hanging
- [ ] the same bound is checked against every other loop in layers 04 and 05 that refines until a tolerance is met, and each loop is either bounded or listed in TRACK.md with why it terminates

Found 2026-10-18 by the C# wiring track (TKT-313, bim-open-data f6e45b3): with plane #118 of unit-cube.stp replaced by a curved surface the edges do not lie on, discretizing edge 3 (#56) ran over 15 s alone and a test run hung 646 s; the repro is in the TKT-313 build-log entry of docs/plans/step-reader.md. A corrupt file must give a diagnostic, never a hang, because no exception guard can catch a loop. Possibly related: the topology track's whole-model laws on the torus witness ran past 900 s (plan v2 log). Plan docs/plans/step-mesher-v2.md: works in sandbox/step-mesh-staging/termination only.
