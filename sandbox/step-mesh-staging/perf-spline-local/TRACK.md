# perf-spline-local: B-spline curve evaluation from the p + 1 local control points

Ticket: TKT-379
Status: merged: I2 (2026-10-21, into 01-geometry/bspline-local.{library,laws}.plato; the whole-polygon bodies kept as the reference the agreement laws compare against)

## Done
- I2, (this commit), about 0.3 h against 1.5 h expected: `BSplineLocalDerivative(d, order, t)` for
  `BSplineCurveData` (returns `Vector3D`) and `BSplineCurve2DData` (returns `Vector2D`), their shared
  core `LocalCurveDerivative(b, local, k, order, t)`, `LocalControls(d, k)` for both curve kinds, and
  `BSplineLocalDerivativeCounted(d, order, t): Counted<Vector3D>`. One `SplineSpan` lookup, the p + 1
  local homogeneous controls built once, then de Boor and the hodograph on them for each order (the
  existing `LocalDerivative`) and the existing `RationalDerivative`. The arithmetic is the old path's
  value for value, so results are bit-identical (the agreement laws compare with `==`). Types added:
  none; the function returns the types the wired names already return.

## Merge instructions
- `bspline-local.library.plato` moves to `01-geometry/` (or its functions move into
  `bspline-evaluation.library.plato`, section "Curves"); `bspline-local.laws.plato` moves beside it
  with the `Law_Perf_` prefix dropped. It reads layer 08's `CurveFixture`/`Curve2DFixture`, as
  `bspline-evaluation.laws.plato` already does.
- `BSplinePoint(d: BSplineCurveData, t)` => `d.BSplineLocalDerivative(0, t).ToPoint`
- `BSplineDerivative(d: BSplineCurveData, t, order)` => `d.BSplineLocalDerivative(order, t)`
- `BSplinePoint(d: BSplineCurve2DData, t)` => `{ var c = d.BSplineLocalDerivative(0, t); return UvCoordinate(c.X, c.Y); }`
- `BSplineDerivative(d: BSplineCurve2DData, t, order)` => `d.BSplineLocalDerivative(order, t)`
- Then delete `BSplinePointBody`/`BSplineDerivativeBody` for both curve kinds and `CurveDerivative`
  (no other caller). The agreement laws compare against those bodies; after the deletion drop
  `Law_Perf_BSplineLocalDerivativeAgrees`, `...AgreesOnFamily` and `...2DAgrees` (the library's
  `BsplineEvaluationLaws` then run on the new body), or keep them against the basis-sum oracles.
- `HomogeneousControls(BSplineCurveData)` stays: `04-discretization/bspline-sagitta.library.plato:78`
  reads it for `BezierControls`. `HomogeneousControls(BSplineCurve2DData)` has no caller left after
  the wiring; delete it.

## Contract requests
- none

## Requests to other tracks
- none

## Verdicts
Interpreter (warm server, `--staging`, budget 20 s) and compiled (pinned CLI, `--backend=csharp
--profile=cpu64 --budget=2`), the same verdicts on both:
"32 laws: 31 pass, 1 fail; backend csharp; 9 witnesses 0.2s; laws 2.1s summed, 0.8s wall; total 34.1s".
The slowest is `BsplineInverseLaws.Law_ProjectIsMinimal` at 0.48 s; every new law is under 0.03 s.

- `BsplineLocalEvaluationLaws.Law_Perf_BSplineLocalDerivativeAgrees` (5 space-curve fixtures, orders 0 to 2, inside and half a unit past either end, bit-identical): pass, both
- `BsplineLocalEvaluationLaws.Law_Perf_BSplineLocalDerivativeAgreesOnFamily` (degree 1 to 6, 7 to 70 points): pass, both
- `BsplineLocalEvaluationLaws.Law_Perf_BSplineLocalDerivative2DAgrees` (2 parameter-plane fixtures): pass, both
- `BsplineLocalEvaluationLaws.Law_Perf_LocalDerivativeReadsDegreePlusOne` (exact count p + 1 for every n): pass, both
- `BrepFoundationWorkLaws.Law_WorkIsWithinSlope` (8 claims, with `Witness_BSplineLocalDerivativeWork`): pass, both
- `BsplineEvaluationLaws` (12 laws), `BsplineInverseLaws` (10), `BrepGeometryLaws.Law_BSplineCurveMatchesBasisSum`,
  `Law_BSplineCurve2DMatchesBasisSum`, `BsplineSagittaLaws.Law_SagittaBoundsArc`, `Law_SagittaClosedForms`:
  pass, as in `verdicts-cpu64.tsv`.
- `BsplineSagittaLaws.Law_SagittaIsAttained`: fail (case k = 12, a = -9.3878..., b = -3), as in
  `verdicts-cpu64.tsv`; the staged code is not wired, so this is the baseline's failure.

Count witness: `Witness_BSplineLocalDerivativeWork`, slope `Insertions(1)` (control points read
per unit of degree plus one), sizes 8 and 64. The size is the degree plus one with the number of
control points held at 64, because the read is constant in n: with n as the size, the old O(n)
body would pass slope 1 too. Measured: 8 at size 8 (degree 7), 64 at size 64 (degree 63); the old
body reads all 64 at both sizes and fails at size 8.

## Findings
- The plan's test column and the dispatch name `Law_BSplineCurveMatchesOracle` and
  `Law_BSplineCurve2DMatchesOracle`; no law of that name exists. The laws that compare a curve to
  its definition are `BrepGeometryLaws.Law_BSplineCurveMatchesBasisSum` and
  `Law_BSplineCurve2DMatchesBasisSum` (`01-geometry/geometry.laws.plato`); those were run.
- Orders 1 and 2 still each difference the local values from scratch (the order-2 hodograph
  recomputes the order-1 differences): O(p^2) either way, so left as is to keep bit-identity simple.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, library, laws, fixtures) | 6 min | |
| Writing library and laws | 5 min | |
| Interpreter law runs | 1 min | 3 runs, green first time |
| Compiled run | 0.6 min | 1 run |
| TRACK.md, ticket, commit | 4 min | |

## Lessons
- The plan's test column named laws by an old name; grepping `verdicts-cpu64.tsv` for the name
  found nothing and pointed at the rename.
