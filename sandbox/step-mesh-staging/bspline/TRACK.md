# bspline: mesh B-spline (freeform) faces

Ticket: TKT-327
Status: ready to merge

## Done

Verdicts of every `Law_Bspline_` law (44), each run on a copy of the library wired by the merge instructions below (`wire.py` in the wave's notes folder), pinned CLI, budget 120 s:

| Library state | Profile | Pass | Not pass |
|---|---|---|---|
| before the G and T merges (tracks' own runs, listed below) | gpu32 | 44 | none |
| 848b66d6 (D2 and G merged, T not) | cpu64 | 35 of the 44 run there, the 12 pipeline laws: 7 pass | 3 fail (bump solid: 12 degenerate triangles, Error `ElementIsNotDegenerate`), 2 budget errors |
| 7d8dae2d and later (T merged), the current library | cpu64 | 35 | 9 budget errors, every one meshing the bump solid inside T's `AnglePass` / `TryAngleInsertion` |

So the bodies, the side tests, the oracles, the sagitta and the crescent criteria pass under both profiles; the bump solid's three criteria laws and the six general layer 8 laws that mesh it hold under gpu32 and wait on face meshing under cpu64 (Requests to other tracks).

- pipeline laws (`bspline-pipeline.laws.plato`) and the crescent witness (`Witness_BsplineCrescentSheet` in `bspline-witnesses.library.plato`): the ticket's three criteria and layer 8's general laws of steps A to C on both models. On the wired copy: 12 obligation before, 12 pass after (73 s). Facts: `Witness_BSplinePatchSolid(1/2)` meshes Ok in round 0, closed, oriented, Euler 2, 162 triangles, top area 1.0410 (bracket [1, 1.0889]), volume 1.0531 (exact 19/18 = 1.0556), and layer 8's three witness laws pass on witness 7; the crescent asks two `LoopSelfIntersects` requests, reports `PIPELINE-FACE-UNRESOLVED` with 0 rounds, and meshes Ok in 1 round under the witness options.

- layer 7 oracle bodies (`bspline-oracles.library.plato`), also not in the brief's list: validating the bump solid at the Oracle level reaches `AreaSegmentByQuadrature`, `SampledCurvatureBound` and `EdgeLengthByQuadrature` for any face or edge without a closed form. `BsplineOraclesLaws` (flat-patch potential, layer 7's area bracket at three bumps, the bump's principal curvatures, the quarter circle's length) on the wired copy: 4 obligation before, 4 pass after.
- side bodies (`bspline-sides.library.plato`), not in the brief's list but on the meshing path of every B-spline face (layer 5's degenerate sides reach `BSplineSideCollapses`): boundary control rows by de Boor at the side's knot, then convex-hull tests. `BsplineSidesLaws` on the wired copy: 3 obligation before, 3 pass after.
- sagitta body (`bspline-sagitta.library.plato`): branch and bound over Bezier pieces (blossom extraction), exact on polylines, a sampled estimate on other curves. `BsplineSagittaLaws` on the wired copy: 3 obligation before, 3 pass after; with a piece budget of 1 (the raw hull bound) 2 fail.
- inverse bodies (`bspline-inverse.library.plato`, `bspline-inverse.types.plato`): global search per smooth piece with regula falsi on the slope (curves, pcurves) and damped, projected Gauss-Newton (surfaces); local Gauss-Newton from a seed. `BsplineInverseLaws` (11 laws) on the wired copy: 10 obligation before (the eleventh was added with the bodies), first run 9 error (an `&&` guard that indexes -1), then 2 fail (stop at 32 roundoffs), then 11 pass. A mutation that keeps the first local minimum fails 4 laws.
- evaluation bodies (`bspline-evaluation.library.plato`): de Boor over homogeneous values, derivatives by the hodograph, the quotient rule, blossoms for Bezier extraction. `BsplineEvaluationLaws` on the wired copy: 11 obligation before, 11 pass after.
- laws and fixtures: 21 laws in `bspline-evaluation.laws.plato` and `bspline-inverse.laws.plato` on the fixtures of `bspline-witnesses.library.plato`. Before any body: 21 of 21 stop on a host obligation (BSplinePoint, ClosestParameterBySearch), gpu32.

## Merge instructions

Each line gives a deferred library function the body on the right (the same parameters). A scratch script that applies exactly these lines to a copy of the library, used for every "after" verdict below, is `wire.py` in the shared notes folder of this wave.

- `01-geometry/geometry-splines.library.plato` `BSplinePoint(d: BSplineCurveData, t)` => `BSplinePointBody(d, t)`
- `BSplineDerivative(d: BSplineCurveData, t, order)` => `BSplineDerivativeBody(d, t, order)`
- `BSplinePoint(d: BSplineCurve2DData, t)` => `BSplinePointBody(d, t)`
- `BSplineDerivative(d: BSplineCurve2DData, t, order)` => `BSplineDerivativeBody(d, t, order)`
- `BSplinePoint(d: BSplineSurfaceData, uv)` => `BSplinePointBody(d, uv)`
- `BSplinePartial(d, uv, uOrder, vOrder)` => `BSplinePartialBody(d, uv, uOrder, vOrder)`
- `01-geometry/geometry-curves.library.plato` `ClosestParameterBySearch(curve, g, p)` => `ClosestParameterBySearchBody(curve, g, p)`
- `PcurveClosestParameterBySearch(g, p, q)` => `PcurveClosestParameterBySearchBody(g, p, q)`
- `01-geometry/geometry-surfaces.library.plato` `ProjectBySearch(surface, g, p)` => `ProjectBySearchBody(surface, g, p)`
- `ProjectNearBySearch(surface, g, p, seed)` => `ProjectNearBySearchBody(surface, g, p, seed)`
- Move `bspline-evaluation.library.plato`, `bspline-inverse.library.plato` and `bspline-inverse.types.plato` into `01-geometry` (layer 1 code) (it is layer 1 code); update the deferred-body count in `01-geometry/README.md` (ten fewer deferred).

## Contract requests

## Requests to other tracks

- T (triangulation, TKT-343), not blocking the merge of this track's bodies, blocking the bump-solid criterion under cpu64: `Witness_BSplinePatchSolid(1/2)` under layer 8's witness options does not mesh on the current library. Under cpu64 its top face (a biquadratic Bezier patch, unit square boundary) refines toward its boundary edges: before the T merge (848b66d6) the run ends with 338 triangles, 12 of them degenerate (a corner about 1.4e-6 inside a boundary edge, smallest altitude 8.6e-7 against the 1e-6 length tolerance); after it the run does not finish in 900 s (law budget) at chordal 0.01, nor in 7.8 hours at chordal 0.02 (a `--call` probe, which no budget stops), and finishes at once at chordal 0.03 and 0.05 (14 triangles). Time is spent in `AnglePass`, `TryAngleInsertion`, `FlipPass` under `RefineToSurfaceByInsertion`. The surface distances layer 5 measures through `Project` are right to 1e-15 there (checked: points 1e-3 above the patch at the boundary and corners measure 1e-3 / sqrt(1 + slope^2)). Repro: wire the library with `wire.py`, add this folder as a root, and run `--laws --filter=Law_Bspline_BumpSolidNeedsNoRound --profile=cpu64`.

## Findings

- The ticket's "its MaxRefinementRounds 0 variant reports PIPELINE-FACE-UNRESOLVED" cannot hold of `Witness_BSplinePatchSolid`: its edges are lines and its top's loop is a simple square, so no face asks for refinement and 0 rounds mesh it the same, Ok (`Law_Bspline_BumpSolidNeedsNoRound`). The criterion is met on the crescent sheet instead, the model that also gives the `LoopSelfIntersects` request. The supervisor or owner may want to reword the criterion.
- Under gpu32 the region tolerance of face meshing is 0.0019, the witness tolerances' parameter floor (computed for coordinates up to 1000). Two boundary segments closer than that collide, so any face with a near-tangent corner never resolves: the first crescent, whose arcs met at 0.1 degrees, stayed unresolved after 5 rounds as refinement made its corner segments shorter. Under cpu64 the floor is about 1e-11 and the same face would resolve. Witnesses that must resolve under both profiles need gaps above 0.0019 everywhere.
- The bump solid's validation reports Warnings only: `Law_LengthToleranceResolvable` (gpu32, as above), four triangle-quality thresholds (track T's territory), and `CornerNormalIsFaceNormal`, not investigated here.
- Ticket criterion 3 (every law of steps A to C on the B-spline witness through the interpreter and the C# backend under cpu64, agreeing law by law) is not met: the laws pass in the interpreter under gpu32 only; cpu64 waits on TKT-315, and the C# backend run on track E.

- `SagittaByHullBound` is a certificate only on B-splines and polylines. Hyperbolas, parabolas, ellipse arcs of half a turn or more, offsets, composites, trimmed and surface curves get `EstimatedSagitta` (64 samples and golden-section search), which can miss a second hump between samples. A follow-up could map trimmed and composite segments onto their basis's certificate.

- gpu32 cannot honour `Tolerances.Witness_Tolerances` (length 1e-6) away from the origin: one float32 step at magnitude 8 is 9.5e-7, and layer 0's own ResolutionAt(1) is 1.9e-6, so `IsResolvable` is false for the witness tolerances under gpu32 everywhere above magnitude 0.5. Recovery laws pass only because the fixtures stay within about 4 of the origin (the search fixture's parabola was shrunk to focal distance 0.02 for this). Expect recovery-law verdicts to change when cpu64 lands; under gpu32 they test luck as much as code.
- `&&` and `||` evaluate both sides (primer D.4); the first inverse run errored on `i > 0 && xs[i - 1]`. Every guard in this track's code is a conditional.
- A root finder stopped at layer 0's ResolutionAt (32 roundoffs of the parameter) leaves a slope that `Law_ClosestParameterIsStationary` rejects at distance 6 from the curve; stopping at 4 roundoffs passes.

- Running the deferred evaluation on the library's own laws needs no new tolerance: layer 1's central-difference laws, its Cox-de Boor oracles, and three closed forms all pass under gpu32 on the fixtures. Two deliberate mutations of the quotient rule (the 2 w' C' term, the w_u S_v term of S_uv) each fail three laws, so the laws can see a wrong rational derivative.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading the plan, contracts and layer code | 25 min | |
| Laws and fixtures | 30 min | 2 CLI runs (15 s each) |
| Waiting on the shared law server | 45 min, abandoned | 1 server run, no answer |
| Evaluation bodies and mutations | 20 min | 3 CLI runs |
| Inverse bodies, two fixes, mutations | 35 min | 8 CLI runs |
| Sagitta body and mutation | 10 min | 3 CLI runs |
| Side bodies (found on the meshing path) | 10 min | 3 CLI runs |
| Layer 7 oracle bodies (found on the meshing path) | 20 min | 4 CLI runs |
| Bump solid meshing, crescent witness (three designs) | 60 min | 9 CLI runs, 1 to 1.5 min each |
| Pipeline laws | 10 min | 2 CLI runs (14 s, 73 s) |
| Full sweeps, unwired and wired (gpu32, stale copy) | 30 min | 2 CLI runs (13 and 17 min) |
| cpu64 rerun after the D2, G and T merges, diagnosis of the bump solid | 70 min of runs | 6 CLI runs (18 min, 15 min, 6 min, 3, 1, 1) |
| Idle: waiting on probes that a missing budget let run | about 8 h | 3 probes, one of 7.8 h |

## Lessons

- The session went idle for about eight hours waiting on three background probes. `--budget` does not stop a `--call` run (the step B notes say so), so the probe at chordal 0.02 ran 7.8 hours, and its completion notice never woke the session. Every probe now runs under `timeout 600`, and a wait on a background run gets a time limit and a check of its output file instead of an open-ended wait.
- The library moved under the track (D2, G and T merged during the work), and a full sweep on a wired copy made before those merges reported three false regressions. Rewire from the current library before every sweep.

- The brief listed 8 bodies; meshing a B-spline face reached 5 more deferred functions (two side tests, three layer 7 oracles). Running the target witness end to end on a wired copy early would have shown the whole list on the first day; a brief could name "everything the witness's pipeline reaches" instead of a list.
- A `--call` probe that returns the discretizations and colliding segment pairs found the gpu32 region tolerance in one run, after two witness designs built on a guess about the cause.

- The shared server on 8768 gave no answer in 45 minutes while four tracks used it; the pinned CLI (`C:/Users/cdigg/.plato-cli/93907bd7/Plato.CLI.dll run ... --laws --profile=gpu32`) compiles the library plus this folder in 15 s. Use the CLI when the server is loaded.
