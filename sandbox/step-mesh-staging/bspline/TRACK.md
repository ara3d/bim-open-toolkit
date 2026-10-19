# bspline: mesh B-spline (freeform) faces

Ticket: TKT-327
Status: working

## Done

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

## Findings

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

## Lessons

- The shared server on 8768 gave no answer in 45 minutes while four tracks used it; the pinned CLI (`C:/Users/cdigg/.plato-cli/93907bd7/Plato.CLI.dll run ... --laws --profile=gpu32`) compiles the library plus this folder in 15 s. Use the CLI when the server is loaded.
