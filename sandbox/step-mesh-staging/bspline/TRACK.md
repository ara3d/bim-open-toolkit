# bspline: mesh B-spline (freeform) faces

Ticket: TKT-327
Status: working

## Done

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
- Move `bspline-evaluation.library.plato` into `01-geometry` (it is layer 1 code); update the deferred-body count in `01-geometry/README.md` (six fewer deferred).

## Contract requests

## Requests to other tracks

## Findings

- Running the deferred evaluation on the library's own laws needs no new tolerance: layer 1's central-difference laws, its Cox-de Boor oracles, and three closed forms all pass under gpu32 on the fixtures. Two deliberate mutations of the quotient rule (the 2 w' C' term, the w_u S_v term of S_uv) each fail three laws, so the laws can see a wrong rational derivative.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading the plan, contracts and layer code | 25 min | |
| Laws and fixtures | 30 min | 2 CLI runs (15 s each) |
| Waiting on the shared law server | 45 min, abandoned | 1 server run, no answer |
| Evaluation bodies and mutations | 20 min | 3 CLI runs |

## Lessons

- The shared server on 8768 gave no answer in 45 minutes while four tracks used it; the pinned CLI (`C:/Users/cdigg/.plato-cli/93907bd7/Plato.CLI.dll run ... --laws --profile=gpu32`) compiles the library plus this folder in 15 s. Use the CLI when the server is loaded.
