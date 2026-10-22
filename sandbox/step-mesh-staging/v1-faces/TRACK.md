# v1-faces: face-meshing defects that break the version 1 contract on curved faces

Ticket: TKT-415, then TKT-401, then TKT-411
Status: merged: F1 in 1369e852 | ready: F3 | working: F2

## Chunks

| Id | Ticket | What | Expected |
|---|---|---|---|
| F1 | TKT-415 | keep a quad grid only when every element is within SurfaceChordal at refinement's samples; else the refined triangulation | 1.5 h |
| F3 | TKT-411 | three-edge sphere, cone and cylinder faces that throw ArgumentOutOfRangeException while their region is built | 2 h |
| F4 | TKT-421 | folded elements on needle cones and single-winding cylinder faces that F3 lets mesh | 2 h, after F2 |
| F2 | TKT-401 | the bump solid's degenerate element at ElementIndex(1541) | 2 h |
| F1b | TKT-415 follow-up | size a refused grid instead of dropping it: QuadCountMismatch floors from the measured deviation, so a doubly curved four-sided face (torus, sphere zone, B-spline) gets a finer grid in the next round instead of a full refinement | not started; supervisor's call |

F3 runs before F2: it loses faces in 7 corpus files, and F2 is one element on a witness.

## Done

- F1 (TKT-415), commit in this folder, 2.5 h against 1.5 h: `grid-chordal.library.plato` (`GridUnlessFoldedOrCoarse`, `GridElementWithinChordal`, `FlatDistanceOf`, `QuadGridOnSidesWithin`), laws and cases in `grid-chordal.laws.plato`, `GridCase` in `grid-chordal.types.plato`. A grid is kept only when every element is within SurfaceChordal plus the length tolerance at the samples refinement uses (`TriangleNeedsRefinement`): the surface point at the parameter centroid and at the parameter midpoint of each side that is not a boundary segment, against the flat element; the corner mean and those sides' chord midpoints, against the surface. Otherwise no grid, and the face takes the refined triangulation. No new type in the library: the test reads the existing criteria.
  - Laws, current library plus staging (cpu64, budget 60 s): `Law_V1Faces_FourSidedMeshWithinChordal` fail (bump 0.3), `Law_V1Faces_BumpTopHasInteriorPoint` fail (bump 0.3), `Law_V1Faces_GridKeptUnlessCurvedBothWays` pass where it states library behaviour (the staged test refuses the bump top and the torus, keeps every other grid).
  - Wired copy (the merge instructions below applied to a `git archive` of HEAD cd33c998) plus staging: all three pass, 8, 7 and 8 cases.
  - Regression: the 16 law classes that mention grids, quads or PreferQuads (136 laws) pass 136 before and 136 after on the wired copy; `Law_LiftCaseReachesItsBranches` needs the second merge instruction below.
  - Witness check in the harness waits on the C# regeneration: `step-corpus-harness gallery witness:BSplinePatchSolid:0.3 out.glb --chordal 0.01` should give interior vertices and a digest other than `AC03233177AEA985`.

- F3 (TKT-411), 3.5 h against 2 h (over: three causes, not one, and a scratch regeneration to prove them on the corpus files): `pole-closure.library.plato` (`ClosedAtPole`, `ClosedAlong`, `IsFreeAlongAt`, `ExpandedWinding`, `ShiftedAfter`, `IsBandPairGuarded`, `PoleGapTolerance`, `ExpandedPointAtPole`), laws in `pole-closure.laws.plato`, `PoleLune` in `pole-closure.types.plato`. A probe that calls the region's steps one by one (the generated C# inlines every frame) put the throw in `AddMissingSeamsAndPoles` on a polar lune of half a turn. Three causes:
  1. Unwrap places the point that leaves a pole next to the pole point, whose free parameter is the arriving value; at half a turn the two copies tie, past it the nearer copy is a period off, so the loop winds once. `ClosedAtPole`, run on every unwrapped loop, moves the points after the first interior pole point by the whole periods the loop would wind once its poles are expanded: a loop through a pole cannot wind round that pole's free parameter.
  2. `IsBandPair`'s `&&` chain reads `winding[1]` when one loop winds (the operator does not guard what follows it): that was the `ArgumentOutOfRangeException`. `IsBandPairGuarded` tests the count first, so a single winding loop that is no band reaches `CutWholePeriods`.
  3. `ExpandedPoint` expands a pole only when the arriving and leaving values differ by more than the point tolerance, which at a pole is its cap, half the period: a half-turn lune kept its pole as one point and its region ran diagonally to the second meridian. `PoleGapTolerance` is the parameter's floor.
  - Laws, current library plus staging: `Law_V1Faces_LuneRegionFromUnwrap` errors on the three-quarter turn with `ArgumentOutOfRangeException` in `IsBandPair` (the corpus failure, reproduced); `Law_V1Faces_LuneClosesAtPole` fails on the half turn (its pole is not expanded); `Law_V1Faces_SingleWindingLoopIsNoBandPair` passes (25 cases).
  - Wired copy (the F3 merge instructions on a `git archive` of HEAD cd33c998) plus staging: all three pass, 25 cases each.
  - Regression: the 32 law classes of layers 0 to 8 that mention poles, unwrap, spheres, cones, hemispheres, regions or MeshFace (515 laws): 456 pass, 25 fail, 28 skipped, 6 error before and after; no law changed verdict.
  - Corpus files on a scratch regeneration of the library with F1 and F3 wired (`regen-step-brep.ps1 -LibraryRoot <scratch git repo> -OutputRoot <scratch copy>`; the committed C# is untouched), harness `time --parallel`: no face throws in CEL/LENA-R8.STEP, SHO/MAYA-W160.step or SHO/MAYA-W260_REVC.step. LENA-R8's sphere lunes 202 to 205 and 216 mesh with 24 elements each, every one facing the face normal, no directed edge repeated; LENA-R8 boundary edges fall from 1779 to 1619, still 0 non-manifold and 0 misoriented. MAYA-W260_REVC faces 1566 and 1595 report FACE-NOT-SIMPLE (located, not thrown).
  - Not clean, filed as TKT-421 (F4): the needle cones (MAYA-W160 3337 and 3638, MAYA-W260_REVC 1411 and 1431: radius 6.1e-5, half-angle 4.1e-4 rad) and the single-winding cylinders (MAYA-W260_REVC 1577, 1588, 1606) now mesh but keep folded elements, so MAYA-W160 goes from 0 non-manifold and 0 misoriented edges to 6 and 12, MAYA-W260_REVC from 4 and 4 to 10 and 16. Before F3 those faces were holes with HOST-LIBRARY-THREW. The supervisor decides: merge F3 now (no throw, sphere lunes right, seven faces folded instead of missing) or together with F4.
  - Witness check for F1 on the same build: `gallery witness:BSplinePatchSolid:0.3 --chordal 0.01` gives 15 vertices, 16 triangles, 5 quads, digest `A05ACC8F74D84B8C` (before: the unit box's 6 quads, `AC03233177AEA985`), closed and oriented.

## Merge instructions

- `05-face-meshing/face-meshing.library.plato`, `QuadGridOnSides`: replace `m.GridUnlessFolded(f, m.QuadGrid(f, r, corners, c))` with `m.GridUnlessFoldedOrCoarse(f, r, m.QuadGrid(f, r, corners, c), c)` (the body of `QuadGridOnSidesWithin`; delete `QuadGridOnSidesWithin` after, and `GridUnlessFolded` once nothing calls it).
- `05-face-meshing/face-meshing-lift.laws.plato`, `LiftCaseCriteria`: the surface chordal argument becomes `quads ? 1.0 : MeshingOptions.WitnessOptions.Face.SurfaceChordal`, with the comment "A grid case's surface chordal bound is one model unit, so the grid test (GridUnlessFoldedOrCoarse) keeps the grids of doubly curved faces, whose cells exceed the witness bound: these cases test Lift on collapsed quads, not the bound." Without it `Law_LiftCaseReachesItsBranches` fails on `HemispheresQuads`, whose grid the test now refuses.
- Move `grid-chordal.*.plato` into `05-face-meshing`. After the merge `Law_V1Faces_GridKeptUnlessCurvedBothWays` compares the library with itself; keep it for its refusal half (bump top and torus get no grid) or drop the `before` side.

- F3: move `pole-closure.*.plato` into `05-face-meshing`, then:
  - `05-face-meshing/face-meshing-domain-once.library.plato`, `UnwrapCountedIn`, and `05-face-meshing/uv-regions-indexed.library.plato`, `UnwrapCounted`: the return becomes `return Counted(m.ClosedAtPole(f, dom, UvLoop(placed.Freeze(), l.Sources)), Insertions(n + steps.Count + probes));`. Both, so that the law of `08-pipeline/pipeline-domain-once.laws.plato` comparing them still holds.
  - `05-face-meshing/uv-regions.library.plato`, `WithSeamCut`: `m.IsBandPair(f, loops, winding)` becomes `m.IsBandPairGuarded(f, loops, winding)`; or give `IsBandPair` the guarded body and delete `IsBandPairGuarded`.
  - `05-face-meshing/pole-segments.library.plato`, `ExpandedPoint`: `(leaving - arriving).Abs > m.PointToleranceAlong(f, uv, which)` becomes `(leaving - arriving).Abs > m.PoleGapTolerance(f, which)`; delete `ExpandedPointAtPole` (a copy kept for review), and `PointToleranceAlong` if nothing else calls it.
  - After the merge `Law_V1Faces_LuneRegionFromUnwrap` states the region half of `Law_V1Faces_LuneClosesAtPole`; keep one.

## Contract requests

None.

## Requests to other tracks

None.

## Findings

- The library's grid broke the chordal bound on every doubly curved four-sided face, not only on the bump: a cell's deviation is about the sum of its two directions' sagittas, and the boundary bounds each alone. Shown by a scratch law on the torus witness at chordal 0.01 (`QuadGridOnSides`'s grid, lifted, has elements beyond the bound). The same holds for hemispheres and sphere zones; cylinders and cones keep their grids.
- Three-edge pole faces are polar lunes: two meridians (or cone generators) meet at the pole (or apex), closed by a parallel (or rim arc). The corpus has them at half a turn, the exact tie of nearest-copy unwrapping.
- A lune narrower than the pole's point tolerance along u kept its pole as one point; the parameter floor now decides (F3, cause 3).
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
| F3: probe harness (scratch copy, stack, step-by-step region probe) | 35 min | 4 builds, 5 file runs |
| F3: lune laws, pole tolerance, guard | 40 min | 8 law runs |
| F3: regression, 32 classes before and after | 19 min | 2 law runs |
| F3: scratch regeneration and harness on 3 corpus files | 30 min | 1 regeneration (63 s), 2 builds, 6 file runs |

## Lessons

- The law server answered "no laws matched" twice right after an edit (2 s compile) and passed on a plain retry; rerun once before looking for a parse error.
- A staged law that compares staged code with library code says nothing after the merge (as D1 noted); state the refusal half separately.
- The law runner draws random values for a witness type's fields besides its Witness_ cases; a law over a record of numbers needs a validity guard.
- Shell heredocs that contain an apostrophe fail in this session's Bash tool; write scripts with the Write tool.
- Generated C# marks every method `AggressiveInlining`, so an exception's stack names only the host's call, even in Debug; a probe that calls the steps one by one finds the failing step.
