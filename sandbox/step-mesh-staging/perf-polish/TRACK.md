# perf-polish: one first jet per polish iteration, one span lookup per B-spline jet

Ticket: TKT-381
Status: merged: I4 (2026-10-21, into 01-geometry/bspline-polish.{types,library,laws}.plato; PolishProjectionCounted runs the cached loop, the B-spline arms of NormalOr and AreaElement read one jet)

## Done
- I4, (this commit), about 0.6 h against 2 h expected. Ranked candidate 25.
  - Types (`polish.types.plato`): `SurfaceFirstJet { Position; DerivativeU; DerivativeV }`, a
    surface's point and first partials from one call (the stdlib's `SurfaceJet3D` also holds the
    second partials, which the polish does not need and a B-spline pays three more homogeneous
    partials for); `PolishRun { Uv; Iterations; Halvings; Evaluations }`, the answer of one polish
    with its work, so the per-iteration cost can be stated exactly.
  - Functions (`polish.library.plato`, library `BsplinePolishCached`, layer 01):
    `LocalNet(d, ku, kv)`, `FirstJetFromNet`, `BSplineSurfaceFirstJet(d, uv)`,
    `BSplineSurfaceFirstJetCounted(d, uv)`, `PartialsCross(j)`, `FirstJet(surface, g, uv)` (any
    surface: the B-spline jet for `BSpline`, the basis jet with its senses for
    `RectangularTrimmed`, else Eval, PartialU and PartialV), `FirstJetByParts`, `Sensed`,
    `GaussNewtonStepAt(j, p)`, `ProjectedStepAt(j, p, uv, step, w)`,
    `PolishRunCached(surface, g, p, start, w, radius, limit)`, `PolishProjectionCached`,
    `PolishProjectionCachedCounted(..., limit)`.
  - Laws (`polish.laws.plato`, library `PolishCachedLaws`): `Witness_PolishProjectionCachedWork`
    and the `Law_Perf_*` laws under "Verdicts".
  - Every result is bit-identical to the library's: the B-spline jet runs the same
    `LocalDerivative` calls on the same weighted local controls and the same quotient rule as
    `RationalPartial` (the order-0 columns at v are computed once and serve both the point and
    S_u, which `HomogeneousPartial` computed twice with identical inputs); the polish takes the
    same steps from the same values. The agreement laws compare with `==`.
  - One deviation from the dispatch: the step functions take the jet, `GaussNewtonStepAt(j, p)`
    and `ProjectedStepAt(j, p, uv, step, w)`, instead of `(r, su, sv, ...)`; r is `j.Position - p`.

## Merge instructions
- `polish.types.plato` moves to `01-geometry/` (or its two types into
  `bspline-inverse.types.plato`); `polish.library.plato` moves to `01-geometry/` (or its functions
  into `bspline-evaluation.library.plato` "Surfaces" for the jet and `bspline-inverse.library.plato`
  "Surfaces: polishing" for the rest). `FirstJet` names layer-1 functions only.
- `PolishProjection(surface, g, p, start, w, radius)` => `surface.PolishProjectionCached(g, p, start, w, radius)`
- `PolishProjectionCounted(...)` (bspline-along.library.plato, I3's form, counting iterations) body =>
  `{ var run = surface.PolishRunCached(g, p, start, w, radius, Integer.PolishIterations); return Counted(run.Uv, Evaluations(run.Iterations)); }`.
  I3's witness then keeps its meaning (iterations) and measures the cached loop.
- `GaussNewtonStep(surface, g, p, uv)` => `surface.FirstJet(g, uv).GaussNewtonStepAt(p)`, and
  `ProjectedStep(surface, g, p, uv, step, w)` => `surface.FirstJet(g, uv).ProjectedStepAt(p, uv, step, w)`;
  or delete both: after the two lines above no caller is left (grep found only the polish loop).
- geometry-surfaces `NormalOr`, the `BSpline` arm => `BSpline(data) => data.BSplineSurfaceFirstJet(uv).PartialsCross.TryFromVector(fallback);`
- geometry-surfaces `AreaElement`, the `BSpline` arm => `BSpline(data) => data.BSplineSurfaceFirstJet(uv).PartialsCross.Length;`
- Optional, same arithmetic: geometry-jets `JetAt(surface, g, uv)` =>
  `{ var c = uv.ToUvCoordinate; var j = surface.FirstJet(g, c); return surface.JetWith(g, c, j.Position, j.DerivativeU, j.DerivativeV); }`.
  Not covered by a staged law; run `BrepGeometryJetsLaws` if applied.
- `polish.laws.plato` moves beside `bspline-inverse.laws.plato` with the `Law_Perf_` prefix
  dropped. After the wiring, `Law_Perf_PolishProjectionCachedAgrees`, `...AgreesOffSurface`,
  `Law_Perf_StepsFromJetAgree` and `Law_Perf_NormalAndAreaFromJetAgree` compare the new code with
  itself; keep them as cheap regression checks or drop them. `Law_Perf_FirstJetAgrees` and
  `Law_Perf_BSplineSurfaceFirstJetAgrees` stay meaningful (jet against Eval/PartialU/PartialV).
- Laws to run at merge: those under "Verdicts", plus `BrepGeometryLaws` area-element laws and the
  layer 05/07 laws that read `AreaElement` or `NormalOr` on B-spline faces (for example
  `BsplinePipelineLaws`), since those arms change.

## Contract requests
- none.

## Requests to other tracks
- none.

## Verdicts
Interpreter (warm server, `--staging`, budget 20 s):
- `PolishCachedLaws` (10 laws) and `Law_WorkIsWithinSlope` (17 claims with this one): all pass.
- The chunk's test column, 22 laws: `BsplineInverseLaws.Law_Project*` (4, with
  `Law_ProjectNearRecoversParameter`), `BrepGeometryLaws.Law_Project*` (7, with
  `Law_ProjectNearRecoversFromNearbySeed`), `Law_NormalIsUnit`, `Law_NormalOrthogonalToPartial`,
  `Law_NormalSenseMatchesParameterization`, `BsplineEvaluationLaws.Law_Surface*` (3),
  `ProjectAlongLaws` (5): all pass, as in `verdicts-cpu64.tsv`. None reaches staged code before
  merge; the agreement laws carry the verdicts across.

Compiled (pinned CLI, `--backend=csharp --profile=cpu64 --budget=2`), filter
`PolishCachedLaws,Law_WorkIsWithinSlope,BsplineInverseLaws,` the column's `BrepGeometryLaws` and
`BsplineEvaluationLaws` laws, `ProjectAlongLaws`:
"40 laws: 39 pass, 1 error; backend csharp; 20 witnesses 0.2s; laws 13.1s summed, 2.6s wall; total 44.7s".
The error is I3's `ProjectAlongLaws.Law_ProjectAlongIsNearlyMinimal`, 2.34 s over 25 cases under
the 40-law parallel load (I3 recorded 1.30 s alone; see Findings). Slowest of this chunk:
`Law_Perf_PolishProjectionCachedAgrees` 0.75 s, `Law_Perf_PolishEvaluationsAreTwoPlusHalvings`
0.73 s, `Law_Perf_PolishProjectionCachedAgreesOffSurface` 0.45 s; the rest under 0.3 s.

- `Law_Perf_BSplineSurfaceFirstJetAgrees`: the B-spline jet equals `(Eval, PartialU, PartialV)`
  bit for bit over each fixture's domain. pass, both backends
- `Law_Perf_FirstJetAgrees`: `FirstJet` equals `FirstJetByParts` on a B-spline, its trimmed copy
  with u reversed, and a sphere. pass, both
- `Law_Perf_SurfaceFirstJetReadsLocalNetOnce`: the jet reads exactly (p_u + 1)(p_v + 1) controls
  (16 on the bicubic 4 x 5 net) and the counted value equals the plain one. pass, both
- `Law_Perf_NormalAndAreaFromJetAgree`: the two wired arms equal `NormalOr` and `AreaElement`. pass, both
- `Law_Perf_StepsFromJetAgree`: `GaussNewtonStepAt`, `ProjectedStepAt` equal the library steps for
  any point and step on the three surfaces. pass, both
- `Law_Perf_PolishProjectionCachedAgrees`: in `ProjectNearBySearch`'s window and radius, the cached
  answer equals `PolishProjection`'s and its iterations equal `PolishProjectionCounted`'s. pass, both
- `Law_Perf_PolishProjectionCachedAgreesOffSurface`: over the whole domain toward any point of
  space, B-spline and trimmed B-spline. pass, both
- `Law_Perf_PolishEvaluationsAreTwoPlusHalvings`: Evaluations = 2 Iterations + Halvings on any
  run of the three surfaces. pass, both
- `Law_Perf_PolishHalvingsAreReached`: a fixed set of 18 runs reaches the halving loop (so the
  cost law above is not met only by runs that never halve). pass, both
- `Law_Perf_PolishWitnessRunsToItsLimit`: the witness's run takes 8 and 32 iterations with no
  halving. pass, both
- `BrepFoundationWorkLaws.Law_WorkIsWithinSlope` with `Witness_PolishProjectionCachedWork`: pass, both

Count witness: `Witness_PolishProjectionCachedWork`, slope `Evaluations(2)` (surface evaluations
per polish iteration: one first jet, one point per trial step; h halvings add h, which the exact
law covers), sizes 8 and 32 iterations, on the bump patch from (0.1, 0.1) toward its point at
(0.9, 0.85) with steps of at most 1/1024. Measured: 16 evaluations at 8 iterations, 64 at 32.
The library loop made 11 Eval, PartialU or PartialV calls per iteration on the same run (8 at uv,
3 at the accepted point), 4 more per halving; on a B-spline those were 18 + 6h homogeneous
partials (each PartialU or PartialV is two), against one jet (one span lookup per direction, one
local net, three u-evaluations over two column sets) and 1 + h points.

## Findings
- Per lifted vertex on a B-spline face, `NormalOr` made 4 homogeneous partials (2 for PartialU,
  2 for PartialV), each with two span searches and a fresh (p_u + 1)(p_v + 1) local net; the wired
  arm makes one jet. `AreaElement` likewise.
- `ProjectAlongLaws.Law_ProjectAlongIsNearlyMinimal` (I3, merged) ran 2.34 s compiled in a 40-law
  run, over the 2 s budget; I3 recorded 1.30 s in a 9-law run. Its cost is the per-point global
  `Project` reference; this chunk's polish change lowers it after merge (the reference's polish
  is the cached one then). Rerun alone: "5 laws: 5 pass; ... laws 4.6s summed, 1.6s wall", the
  law 1.53 s. It sits close to the budget under load; worth watching at merge.
- Seen during the chunk, not from it: one compiled run failed to resolve
  `EveryTriangulableFace` in the library, another session mid-edit; the rerun compiled.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, ticket, I2/I3 tracks, evaluation, inverse, along, surfaces, jets, witnesses) | 15 min | |
| Writing (types, library, laws, TRACK) | 15 min | |
| Law runs, interpreter | 2 min | 3 runs (23 s, 15 s, 12 s) |
| Compiled runs | 3 min | 3 (45 s, 38 s; one stopped by another session's edit) |
| Waiting | 2 min | |

## Lessons
- `short` and `long` as local names would have collided with C# keywords in the generated code;
  renamed before the first run.
