# v1-faces: face-meshing defects that break the version 1 contract on curved faces

Ticket: TKT-415, then TKT-401, then TKT-411
Status: ready: F1 | working: F3

## Chunks

| Id | Ticket | What | Expected |
|---|---|---|---|
| F1 | TKT-415 | keep a quad grid only when every element is within SurfaceChordal at refinement's samples; else the refined triangulation | 1.5 h |
| F3 | TKT-411 | three-edge sphere, cone and cylinder faces that throw ArgumentOutOfRangeException while their region is built | 2 h |
| F2 | TKT-401 | the bump solid's degenerate element at ElementIndex(1541) | 2 h |
| F1b | TKT-415 follow-up | size a refused grid instead of dropping it: QuadCountMismatch floors from the measured deviation, so a doubly curved four-sided face (torus, sphere zone, B-spline) gets a finer grid in the next round instead of a full refinement | not started; supervisor's call |

F3 runs before F2: it loses faces in 7 corpus files, and F2 is one element on a witness.

## Done

- F1 (TKT-415), commit in this folder, 2.5 h against 1.5 h: `grid-chordal.library.plato` (`GridUnlessFoldedOrCoarse`, `GridElementWithinChordal`, `FlatDistanceOf`, `QuadGridOnSidesWithin`), laws and cases in `grid-chordal.laws.plato`, `GridCase` in `grid-chordal.types.plato`. A grid is kept only when every element is within SurfaceChordal plus the length tolerance at the samples refinement uses (`TriangleNeedsRefinement`): the surface point at the parameter centroid and at the parameter midpoint of each side that is not a boundary segment, against the flat element; the corner mean and those sides' chord midpoints, against the surface. Otherwise no grid, and the face takes the refined triangulation. No new type in the library: the test reads the existing criteria.
  - Laws, current library plus staging (cpu64, budget 60 s): `Law_V1Faces_FourSidedMeshWithinChordal` fail (bump 0.3), `Law_V1Faces_BumpTopHasInteriorPoint` fail (bump 0.3), `Law_V1Faces_GridKeptUnlessCurvedBothWays` pass where it states library behaviour (the staged test refuses the bump top and the torus, keeps every other grid).
  - Wired copy (the merge instructions below applied to a `git archive` of HEAD cd33c998) plus staging: all three pass, 8, 7 and 8 cases.
  - Regression: the 16 law classes that mention grids, quads or PreferQuads (136 laws) pass 136 before and 136 after on the wired copy; `Law_LiftCaseReachesItsBranches` needs the second merge instruction below.
  - Witness check in the harness waits on the C# regeneration: `step-corpus-harness gallery witness:BSplinePatchSolid:0.3 out.glb --chordal 0.01` should give interior vertices and a digest other than `AC03233177AEA985`.

## Merge instructions

- `05-face-meshing/face-meshing.library.plato`, `QuadGridOnSides`: replace `m.GridUnlessFolded(f, m.QuadGrid(f, r, corners, c))` with `m.GridUnlessFoldedOrCoarse(f, r, m.QuadGrid(f, r, corners, c), c)` (the body of `QuadGridOnSidesWithin`; delete `QuadGridOnSidesWithin` after, and `GridUnlessFolded` once nothing calls it).
- `05-face-meshing/face-meshing-lift.laws.plato`, `LiftCaseCriteria`: the surface chordal argument becomes `quads ? 1.0 : MeshingOptions.WitnessOptions.Face.SurfaceChordal`, with the comment "A grid case's surface chordal bound is one model unit, so the grid test (GridUnlessFoldedOrCoarse) keeps the grids of doubly curved faces, whose cells exceed the witness bound: these cases test Lift on collapsed quads, not the bound." Without it `Law_LiftCaseReachesItsBranches` fails on `HemispheresQuads`, whose grid the test now refuses.
- Move `grid-chordal.*.plato` into `05-face-meshing`. After the merge `Law_V1Faces_GridKeptUnlessCurvedBothWays` compares the library with itself; keep it for its refusal half (bump top and torus get no grid) or drop the `before` side.

## Contract requests

None.

## Requests to other tracks

None.

## Findings

- The library's grid broke the chordal bound on every doubly curved four-sided face, not only on the bump: a cell's deviation is about the sum of its two directions' sagittas, and the boundary bounds each alone. Shown by a scratch law on the torus witness at chordal 0.01 (`QuadGridOnSides`'s grid, lifted, has elements beyond the bound). The same holds for hemispheres and sphere zones; cylinders and cones keep their grids.
- Cost: a refused grid is refined, and refining the whole torus witness (major radius 2.5) at chordal 0.01 exceeds a law's 60 s budget. Corpus tori are small fillets, so the corpus cost is likely small, but it is not measured; F1b would replace the refinement with a finer grid.
- The bump solid of bump 0.5 at chordal 0.01 exceeds 60 s in refinement (`ProjectBySearchBody` under `NeedsRefinementCarried`), the TKT-351 cost; left out of the cases.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading the grid path and the refinement tests | 25 min | none |
| Writing F1 (library, types, laws) | 20 min | none |
| Type check, first law runs (98 s compiles on the shared server, queued) | 25 min | 3 law runs |
| Torus probe and law correction | 15 min | 2 law runs |
| Wired-copy runs and regression (16 classes, before and after) | 30 min | 6 law runs |
| Harness build (Release, cold, -m:1) | 5.5 min | 1 build |

## Lessons

- The law server answered "no laws matched" twice right after an edit (2 s compile) and passed on a plain retry; rerun once before looking for a parse error.
- A staged law that compares staged code with library code says nothing after the merge (as D1 noted); state the refusal half separately.
- Generated C# marks every method `AggressiveInlining`, so an exception's stack names only the host's call, even in Debug; a probe that calls the steps one by one finds the failing step.
