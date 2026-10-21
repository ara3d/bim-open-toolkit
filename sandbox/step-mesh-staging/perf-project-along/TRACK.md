# perf-project-along: one global search per edge, seeded inverse evaluation after

Ticket: TKT-380
Status: merged: I3 (2026-10-21, into 01-geometry/bspline-along.{library,laws}.plato; the staged image and bound copies deleted after wiring)

## Done
- I3, (this commit), about 1 h against 2 h expected. Functions added (no types: every value
  already has one, `Counted<T>` carries the work):
  - `along-geometry.library.plato` (library `BsplineInverseAlong`, layer 01):
    `ProjectAlong(g, s, points, tol)`, `ProjectAlongCounted`, `ProjectAlongBySearchCounted`,
    `PolishProjectionCounted`, `ProjectNearBySearchCounted`, `ClosestParameterNear(g, p, q, seed)`,
    `ClosestParametersAlong(g, p, points, tol)`, `ClosestParametersAlongCounted`,
    `ClosestParametersAlongBySearchCounted`, `NearestMinimizerFrom`, `PcurveSearchDomain`,
    `CanonicalOnDomain`.
  - `along-images.library.plato` (library `EdgeImagesAlong`): `CanonicalImagePointsAlong` (layer
    04) and `LiftedBoundAlong` (layer 02), the library bodies with the one projection line changed.
  - `along.laws.plato` (library `ProjectAlongLaws`): `Witness_ProjectAlongWork` and the
    `Law_Perf_*` laws below.

## Merge instructions
- `along-geometry.library.plato` moves to `01-geometry/` (or its functions into `BsplineInverse`).
- `PolishProjection(surface, g, p, start, w, radius)` => `surface.PolishProjectionCounted(g, p, start, w, radius).Value`
- `ProjectNearBySearchBody(surface, g, p, seed)` => `surface.ProjectNearBySearchCounted(g, p, seed).Value`
- In `PcurveClosestParameterBySearchBody`, the `period` and `d` locals => `var d = g.PcurveSearchDomain(p);`
- In `MinimizeOverDomain`, the `wrapped` local and the return => `return CanonicalOnDomain(eval, p, d, MinimizeOverCuts(...));`
- 04 `CanonicalImagePoints`, the `raw` local =>
  `img.Pcurve.IsNone ? m.PolesFilled(s, m.Geometry.ProjectAlong(s, d.Points, m.Tolerances.Length)) : m.Geometry.ClosestParametersAlong(img.Pcurve, d.Points, m.Tolerances.Length).Map(t => m.Geometry.Eval(m.Geometry.Pcurves[img.Pcurve].Curve, t))`;
  then delete `CanonicalImagePointsAlong`.
- 02 `LiftedBound`, the `raw` local => `m.Geometry.ProjectAlong(s, ordered.FlatMap(c => m.CoedgeSamples(b, c)), m.Tolerances.Length)`;
  then delete `LiftedBoundAlong` (and `along-images.library.plato`).
- `along.laws.plato` moves to `01-geometry/` beside `bspline-inverse.laws.plato` (it reads layer
  08's fixture arenas as that file does) with the `Law_Perf_` prefix dropped. Drop
  `Law_Perf_CanonicalImagePointsAlongAgrees`, `Law_Perf_LiftedBoundAlongAgrees` and
  `PerfImagesAgree`, `PerfImageAgrees`, `PerfBoundAgrees` once the two bodies are wired: they
  compare the old body with the new one.
- Laws to run at merge: the ones under "Verdicts", plus the laws of every reader of `ImagePoints`
  (04 `ImageChordDeviations`, `termination-discretize`, 05 `uv-regions` `Unwrap`) and of
  `IsPlainInParameters` (02 topology laws).

## Contract requests
- none. One signature differs from the dispatch: `ProjectAlong` and `ClosestParametersAlong` take
  the length tolerance (`LengthTolerance`) as a fourth parameter, since the fallback test needs it
  and a `GeometrySet` holds none. Both callers pass `m.Tolerances.Length`.

## Requests to other tracks
- I4 (TKT-381, `PolishProjectionCached`): build on `PolishProjectionCounted` here, which is
  `PolishProjection` with its iteration count; the count witness here then measures I4's change
  too. Not blocking.

## Verdicts
Interpreter (warm server, `--staging`, budget 20 s): 8 `ProjectAlongLaws` laws pass; 25 laws of
the chunk's test column plus `Law_WorkIsWithinSlope` pass (25 of 25). Compiled (pinned CLI,
`--backend=csharp --profile=cpu64 --budget=2`):
"9 laws: 9 pass; backend csharp; 22 witnesses 0.3s; laws 6.5s summed, 1.6s wall; total 41.1s"
for `ProjectAlongLaws,Law_WorkIsWithinSlope`; the slowest are
`Law_Perf_ProjectAlongIsNearlyMinimal` 1.30 s and `Law_Perf_ProjectAlongAgrees` 1.25 s over 25
cases. The column's library laws, compiled in an earlier run of the same files: all pass, slowest
`BsplineInverseLaws.Law_ProjectIsMinimal` 0.87 s.

- `ProjectAlongLaws.Law_Perf_ProjectNearCountedAgrees`: the counted seeded search equals
  `ProjectNearBySearchBody` bit for bit, any seed, any point, three fixtures. pass, both backends
- `Law_Perf_ProjectAlongAgrees`: 8 points between any two uv points of each surface fixture;
  each recovers its point within the length tolerance, points 3 and 7 name `Project`'s
  parameters within `UvToleranceAt`, and the run makes one grid search. pass, both
- `Law_Perf_ProjectAlongIsNearlyMinimal`: 4 points between any two points of space; each
  answer's distance is at most `Project`'s plus the length tolerance. pass, both
- `Law_Perf_ClosestParametersAlongAgrees`: 8 points of each pcurve fixture; recovered within the
  length tolerance, `ClosestParameter`'s within `ParameterFloorOf`, one global search. pass, both
- `Law_Perf_ClosestParametersAlongIsNearlyMinimal`: as for surfaces, 6 points. pass, both
- `Law_Perf_CanonicalImagePointsAlongAgrees`: 14 witness models, every edge at 12 samples, every
  image: the new body names the old body's parameters within `UvToleranceAt`. pass, both
- `Law_Perf_LiftedBoundAlongAgrees`: 14 witness models, every bound of every edge-loop face. pass, both
- `Law_Perf_ProjectAlongSearchesOncePerEdge`: the count witness's edge makes exactly one grid
  search at 16 and at 64 points. pass, both
- `BrepFoundationWorkLaws.Law_WorkIsWithinSlope` (8 claims with `Witness_ProjectAlongWork`): pass, both
- `BsplineInverseLaws` (all 11, including the 7 the chunk names), `BrepGeometryLaws.Law_Project*`
  (7), `Law_PcurveClosestParameterIsBounded`, `Law_SurfaceCurve*` (4),
  `EdgeDiscretizingLaws.Law_ImageChordWithinChordal`: pass on both, as in `verdicts-cpu64.tsv`.
  None reaches staged code before merge.

Count witness: `Witness_ProjectAlongWork`, slope `WorkBudgetOf(40, 0, 1, 0)` (at most 40 seeded
polish iterations, Evaluations, and one global grid search, Flips, per point), sizes 16 and 64,
along the bump patch curve u = 0.05 + 0.9 t, v = 0.2 + 0.6 t^2. Measured: 1 grid search at both
sizes; 60 polish iterations at 16 points and 250 to 252 at 64 (4 per seeded point). `Project`
per point made 16 and 64 grid searches, each a 9 x 9 grid of evaluations with every grid minimum
polished.

## Findings
- When an answer can differ from the per-point global search: a seeded answer is kept only when
  its point lies within the length tolerance of the input point. The global answer's distance is
  at least 0, so a kept answer's distance is at most the global one's plus the tolerance; every
  answer not kept is the global one, bit for bit. Where the surface or pcurve passes within the
  tolerance of a point once, both reach the same minimum and differ by the polish's stopping
  rounding (the agreement laws hold within `UvToleranceAt` and `ParameterFloorOf`). Where it
  passes within the tolerance twice (a seam, a pole, a surface folding back on itself), the seeded
  answer is the copy continuous with the run and the global one the tie its search order picks;
  `UnwrappedByContinuity` and `PolesFilled` then treat both the same way.
- The fallback cannot compare with the global distance without computing it, so the test uses the
  bound 0 for it. On an edge whose curve lies farther than the tolerance from the face's surface
  (a defective file, which `Law_OffSurfaceEdgeIsDiagnosed` reports), every point falls back and
  the cost is the old one plus one seeded polish per point.
- Each global `Project` on a fixture B-spline costs about 6 ms compiled under the law runner's
  parallel load (8 per case over 25 cases made 1.8 to 2.5 s). The agreement laws therefore compare
  with `Project` at two points of the run and check point recovery at all eight. Chunk I4
  (cached jets) and the B-spline evaluation chunk bear on this.
- Seen in every run, not from this chunk: 2 type errors in
  `07-validation/validation-checks-mesh.library.plato:679` (`CheckFaceMeshPointPairs`, CHK101 and
  CHK201 on `CheckGrid`), presumably another track mid-edit.
- `ClosestParameterBySearchBody` (space curves) has no seeded form here: no per-sample caller of
  it was named; `NearestMinimizerFrom` serves a space curve as it is.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, ticket, bspline-inverse, callers, primer, laws) | 25 min | |
| Writing (library, callers, laws, TRACK) | 25 min | |
| Law runs, interpreter | 8 min | 6 runs (one returned 0 laws, passed on rerun) |
| Compiled runs | 3 min | 3 (47 s, 38 s, 41 s) |
| Waiting | 2 min | |

## Lessons
- A reference law that calls the slow function per point costs the 2 s budget before the new
  function does: size the reference calls first.
