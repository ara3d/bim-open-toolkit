---
id: TKT-502
title: STEP mesher: analytic curved faces (cylinder, cone, sphere, torus) meshed as structured grids sized by the closed-form chordal count, not by CDT and refinement
status: open
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/quad-formula/**, sandbox/step-brep-mesh/05-face-meshing/grid-formula.*, sandbox/step-brep-mesh/05-face-meshing/face-meshing.library.plato, sandbox/step-brep-mesh/05-face-meshing/grid-chordal.*, sandbox/step-brep-mesh/05-face-meshing/grid-keep.laws.plato, sandbox/step-brep-mesh/05-face-meshing/element-shape.library.plato, sandbox/step-brep-mesh/05-face-meshing/face-meshing-v1-keep.library.plato, sandbox/step-brep-mesh/05-face-meshing/pole-segments.library.plato, sandbox/step-brep-mesh/05-face-meshing/face-meshing-domain-once.library.plato, sandbox/step-brep-mesh/05-face-meshing/README.md, docs/plans/step-mesher-quad-formula-2026-10-22.md, deps/bim-open-data/src/data/Ara3D.StepBrep/**, deps.json]
workflow: [W3]
related: [TKT-405, TKT-409, TKT-415, TKT-435, TKT-323]
created: 2026-10-22
---

## Acceptance criteria

- [ ] QF1: the formula library and its laws pass on the warm server: the count's chord meets the budget and the next coarser does not; on the cylinder, cone, sphere and torus witnesses a grid at the formula's counts is kept by the gate's measure; on the cylinder and cone witnesses the boundary already carries the formula's counts
- [ ] QF2: QuadGridOnSides asks the formula's floors; every grid-chordal, grid-keep and triangulated-witness law keeps its verdict
- [ ] QF3: each grid node is evaluated once and each interior side projected once; the outcome agrees bit for bit with the current grid on every triangulated witness face and grid case
- [ ] QF4: a full sphere and torus witness take the grid with their synthetic cuts sampled at the formula's budget
- [ ] QF5: a corpus run on a regeneration from the committed library, against docs/plans/step-mesher-corpus-2026-10-22-late.csv: faces meshed, closed shells and contract holds on no fewer files; the face-stage time per surface kind before and after in a results note in docs/plans/

## Why

The owner wants the mesher about 10x faster, and mixed meshes with quads are acceptable. Faces are 76 s of about
177 s of warm stage time over the 88 u-blox files (`docs/plans/step-mesher-corpus-2026-10-22-evening.md`). TKT-405
showed the structured grid (`QuadGridOnSides`, `05-face-meshing/face-meshing.library.plato`) takes four-edge
cylinder faces from 1,693 ms to 321 ms; the refinement it replaced was driven by the 15 degree side-normal
criterion a chord over 30 degrees of arc can never meet (`docs/plans/step-mesher-ideas-evaluation.md`, run C,
idea 28). The grid is sized by the boundary's segment counts alone, so it is kept only where those counts happen
to be fine enough (the keep gate F1, TKT-415, and T1, TKT-435): a cylinder or cone face, whose circles layer 04
already sizes by the chordal formula, keeps it; a sphere or torus face, whose cells deviate by about the sum of
two sagittas, is refused and takes the refined constrained Delaunay triangulation.

## Design

The count a circular direction needs follows from its radius R, its sweep theta and a chordal budget d:
n = ceil(theta / (2 acos(1 - d / R))), which is layer 04's `ChordalArcAngle` and `ArcCriteriaCount`, capped as
`ArcSegmentCount` caps an edge (the minimum length), so the grid asks an edge for exactly the count the
discretizer would give a circle of that radius. Per surface kind (`BrepSurface`, layer 01), over the region's
parameter box [u0, u1] x [v0, v1]:

| Surface | u direction | v direction | budget per direction |
|---|---|---|---|
| Cylinder(R) | circular, radius R | straight: no count (one cell beyond what the boundary carries) | d |
| Cone(R, a) | circular, the largest radius on the face, max over [v0, v1] of abs(R + v tan a) | straight | d |
| Sphere(R) | circular, radius R max cos v over [v0, v1] | circular, radius R | d / 2 each |
| Torus(R, r) | circular, max over [v0, v1] of abs(R + r cos v) | circular, radius r | d / 2 each |
| others | no formula: the grid stays as it is today | | |

A face curved one way deviates by the sagitta of its one circular direction, so the budget is d. A face curved both
ways deviates, to first order, by the sum of the two sagittas (a cell of angular sizes a and b on a sphere of radius
R lies R (1 - cos(a/2) cos(b/2)) off the sphere at its centre), so each direction gets d / 2. The accuracy argument
is a law about the formula on the library's witnesses, checked with the gate's own measure (`GridElementKeptV1`,
`ElementWithinChordal`), not a new per-triangle test. The keep gate stays as the gate.

Where a side of a four-sided region is a model edge carrying fewer segments than its direction's formula count,
the face asks for the count through the existing count-request mechanism (`QuadGridOutcome.CountsDiffer`, the
floors `QuadCountRequests` turns into `QuadCountMismatch` requests): the floors are the larger of the matching
floors (`MatchingFloors`) and the formula's. Today the host answers blocking requests only (`BlockingOnly`,
`08-pipeline/pipeline-host-options.library.plato`); chunk Q1b of TKT-409 makes it answer quad count requests, after
which such a face takes its grid in the next round. A side that is a synthetic seam cut or a pole segment has no
edge to ask: its sampling (`CutSegmentCount`, `PoleStepCount`) is sized by the face criteria, and the second chunk
below sizes it by the formula's budget on faces curved both ways.

Finding 3 of `docs/plans/step-mesher-algorithmic-performance-2026-10-22.md` (the grid path evaluates each node
about 16 times and projects each shared side twice) is the inner loop of this work and is folded in as its own
chunk, bit-identical, with an agreement law.

## Chunks

| Id | Chunk (one commit) | Fence | Test |
|---|---|---|---|
| QF1 | `grid-formula.{types,library,laws}.plato`: `AnalyticGridFormula` (the directions, radii and budget per surface kind), `FormulaCount` from layer 04's arc formula, `FormulaFloors`; laws: the count's chord meets the budget and the next coarser does not; on the cylinder, cone, sphere and torus witnesses a grid at the formula's counts is kept by the gate's measure; on the cylinder and cone witnesses the boundary already carries the formula's counts, so no face that has a grid today changes | `S/quad-formula/` then `L/05-face-meshing/grid-formula.*` | its laws; `FaceMeshingGridChordalLaws`, `FaceMeshingGridKeepLaws`, `Law_NoQuadsUnlessPreferred` unchanged |
| QF2 | `QuadGridOnSides` asks the formula's floors beside the matching floors (`QuadGridOnSidesFormula`); the dense floors table built once per face, not per outcome (finding 9) | `face-meshing.library.plato` (the one wiring line) | the QF1 laws; every grid-chordal and grid-keep law; `TriangulatedWitnessLaws` |
| QF3 | Each grid node evaluated once: a positions array built by `QuadGrid`, read by the cell keep test, both diagonal splits of the keep gate, and `Lift` where it reads grid corners; each interior side's midpoint sampled and projected once (finding 3) | `face-meshing.library.plato` (`QuadGrid`), `element-shape.library.plato`, `face-meshing-v1-keep.library.plato`, `grid-chordal.library.plato` | `Law_QuadGridIndexedAgrees` (outcome equal, bit for bit, on every `TriangulatedWitness` face and the grid cases); a work claim of at most one evaluation per node |
| QF4 | Synthetic seam cuts and pole segments on faces curved both ways sampled at the formula's budget (d / 2), so a full sphere or torus takes the grid without a request | `pole-segments.library.plato`, `face-meshing-domain-once.library.plato` (the criteria handed to the cut), and the uv-regions call if its owner agrees | the sphere and torus grid cases keep a grid; `Law_V1Faces_GridRefusedWhereCurvedBothWays` restated |
| QF5 | Regeneration from the committed library (private export), corpus run against the 2026-10-22 late baseline, results note | `deps/bim-open-data/src/data/Ara3D.StepBrep/**`, `deps.json`, `docs/plans/step-mesher-quad-formula-2026-10-22.md` | faces meshed, closed shells and contract no fewer; face time per surface kind before and after |

Out of scope: B-spline faces (c211's 21.5 s of faces; a separate technique for ruled B-spline faces, another
track), surfaces of revolution (16 faces in the corpus), faces whose sides are not iso-lines (TKT-409's turning
corners feed the same `QuadGridOnSides`, so they get the formula's floors for free).
