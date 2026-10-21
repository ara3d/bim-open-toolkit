# perf-chart: cut step counts with each step point evaluated once; a face chart from one pass over both sample sets

Ticket: TKT-389
Status: ready: R7

## Files

- `cut-count.library.plato` (library `CutSegmentCounting`, layer 05): `CutGridPoints`,
  `ShortestChord`, `CutGridMeetsCounted`, `CutSegmentCountFastCounted`, `CutSegmentCountFast`.
- `chart-speeds.types.plato` (layer 05): `MeanSpeeds` (both scales of a chart).
- `chart-speeds.library.plato` (library `ChartSpeeds`, layer 05): `BoxLow`, `BoxHigh`,
  `BoundaryPointCount`, `SpeedSample`, `CollapsedLineCount`, `KeptSamplesCounted`,
  `MeanSpeedOver`, `MeanSpeedBothCounted`, `MeanSpeedBoth`, `ChartOfBody2`; `QuadSidesIn` and
  `FaceQuadGridIn` (the four-sided test with the region tolerance given).
- `chart-cut.laws.plato` (library `ChartCutLaws`, layer 08: layer 07 witness models, layer 08
  witness options): eleven laws and one count witness.

## Done

- R7, (this commit), about 1.1 h against 1.5 h expected.
  - New laws, warm interpreter (cpu64, budget 20): the ten `Law_Perf_*` of `ChartCutLaws` and
    `Law_WorkIsWithinSlope`: 11 of 11 pass.
    - `Law_Perf_ChartOfBody2Agrees`: `ChartOfBody2` is `ChartByMeanSpeed` (ChartOf's body before
      this chunk, both `MeanSpeed` calls) and the witness's own chart, bit for bit, on all 42
      `TriangulatedWitness` faces.
    - `Law_Perf_ChartOfBody2AgreesOnWitnesses`: the same on every regioned face of all ten
      positive witness models (sphere, torus, cone, B-spline patch, sector, sphere by pole
      loops among them) and on the empty region of every face.
    - `Law_Perf_MeanSpeedBothEvaluates126`: exactly 126 partial evaluations (Evaluations) and no
      other work on every `TriangulatedWitness` face; `MeanSpeed` made 252.
    - `Law_Perf_MeanSpeedBothSkipsPoles`: the sphere's face has collapsed lines and its pole
      samples are dropped, so the agreement laws reach the collapsed-line path.
    - `Law_Perf_QuadSidesInAgrees`, `Law_Perf_QuadSidesInFindsFourSides`: `QuadSidesIn` with the
      witness chart's tolerance is `QuadSidesOf` on all 42 faces, and the unit box's face 0 is
      four-sided, so corners are compared.
    - `Law_Perf_CutSegmentCountFastAgreesOnCylinder` (12 cuts) and
      `Law_Perf_CutSegmentCountFastAgreesOnCurvedFaces` (10 cuts on the torus, the sphere through
      both poles, the cone and the B-spline patch): the same n as `CutSegmentCount`.
      `Law_Perf_CutSegmentCountFastStopsEveryWay` shows the cylinder cases reach every stop: the
      turn bound (12), the one-step cut (1), the minimum length (between 1 and 64), a length
      limit (4) and the cap (64).
    - `Law_Perf_CircleCutsTakeTheirSteps`: the witness's circle cuts take 8 and 64 steps, and
      `CutSegmentCount` agrees there.
  - Count witness `Witness_CutSegmentCountFastWork`: Evaluations are surface evaluations (grid
    points, step midpoints, face normals); slope `Evaluations(3)` per grid point the linear
    search places, n (n + 3) / 2 for n steps; sizes 44 and 2112 (n = 8 and 64, a whole period
    of the unit cylinder at mid height); measured exactly 68 and 2207 (probed by threshold laws,
    deleted). The bound 3 holds for any surface: a try at m evaluates at most
    m midpoints, m + 1 normals and the m + 2 points of the next grid. `CutSegmentCount` made
    about 7 per grid point (about 14,000 at 64 steps). The size is quadratic in n: see Findings.
  - Compiled (pinned CLI e37c032f, csharp, cpu64, `--budget=2`), filter: the ten `Law_Perf_*`,
    `Law_WorkIsWithinSlope` and the 45 preserved laws below: "56 laws: 55 pass, 1 fail; 85
    witnesses 1.2s; laws 2.8s summed, 1.9s wall; total 39.9s". The fail is
    `Law_RefinedInteriorMeetsMinAngle` on the cylinder, the baseline fail. Slowest of this chunk:
    `Law_Perf_ChartOfBody2AgreesOnWitnesses` 0.16 s, `Law_Perf_CutSegmentCountFastAgreesOnCurvedFaces`
    0.10 s; `Law_WorkIsWithinSlope` 0.94 s over 29 witnesses. "1 degraded bodies" is the library's
    (perf-assembly placed it).
  - Verdict preservation, warm interpreter, cpu64: `Law_RegionLoopClosesInPlane`,
    `Law_SeamCutCopiesRunOpposite`, `Law_ElementAreasSumToRegionArea`, every law of
    `TriangulatedWitnessLaws` (with `Law_BoxFacesStayTwoTriangles`), `UnwrapIndexedLaws`,
    `FaceMeshingChartsLaws` and `FaceMeshingDomainOnceLaws`: 45 laws, 44 pass, 1 fail
    (`Law_RefinedInteriorMeetsMinAngle`, fail in `reviews/verdicts-cpu64.tsv`); 0 differ. These
    run the unwired library; the agreement laws carry the claim to the wired one. Every chart and
    every cut count is bit for bit, so no CDT decision changes.
  - Types added: `MeanSpeeds` (the two scales computed together, so the counted form returns one
    value).

## Merge instructions

- Move `cut-count.library.plato`, `chart-speeds.types.plato` and `chart-speeds.library.plato` to
  `05-face-meshing/` (for example `uv-regions-cut-count.library.plato`,
  `face-meshing-chart-speeds.{types,library}.plato`), and `chart-cut.laws.plato` to
  `08-pipeline/` (`pipeline-chart-cut.laws.plato`).
- 05 `uv-regions.library.plato`: rename the body of `CutSegmentCount(m, f, a, b, c)` to
  `CutSegmentCountByScan` (the agreement laws' reference), and give `CutSegmentCount` the body
  `=> m.CutSegmentCountFast(f, a, b, c)`; in `chart-cut.laws.plato`, `CutAgrees` then compares
  with `m.CutSegmentCountByScan(...)`. `CutStepsMeetCriteria`, `CutStepMeetsCriteria` and
  `ShortestCutStep` are then called only by `CutSegmentCountByScan`.
- 05 `uv-regions.library.plato` `ChartOf(m, f, r)` => `m.ChartOfBody2(f, r)`. Keep `MeanSpeed`:
  the spec names it and `ChartByMeanSpeed` (the laws' reference) calls it.
- 05 `uv-regions.library.plato` `QuadSidesOf(m, f, r)` =>
  `r.QuadSidesIn(m.RegionTolerance(f, m.ChartOf(f, r)))` (the body moves to `QuadSidesIn`).
- 05 `face-meshing-domain-once.library.plato` `MeshedOutcomeIn`: `m.FaceQuadGrid(f, d, r, c)` =>
  `m.FaceQuadGridIn(f, d, r, tol, c)`, so a face meshed with quads preferred builds its chart
  once, not twice.
- After wiring, `Law_Perf_QuadSidesInAgrees` compares `QuadSidesIn` with itself through
  `QuadSidesOf`: keep it as the wiring check or delete it. Keep the other laws and the witness
  under non-Perf names.

## Contract requests

- none

## Findings

- The stopping test of `CutSegmentCount` (stop at n when the n steps meet the criteria, or when
  n + 1 steps would make one shorter than the minimum length) is not monotone in n, so no
  doubling or binary search returns the linear search's n in general: the chordal test on a
  surface of revolution whose profile has a sharp bend at its middle passes with two steps (the
  bend is a step end) and fails with three; the shortest-chord test can pass at n + 1 and fail at
  n + 2 where a curve folds back. The ticket's count criterion (evaluations per cut at most c n)
  needs such a search. This chunk keeps the linear search, so every count is the old one, bit
  for bit, and cuts the work per try: each grid point is evaluated once (the next grid's points,
  evaluated for the shortest-step test, are the next try's points), each step's tests run
  cheapest first, a try stops at its first failing step, and a step shares its end normal with
  the next step. The work is still quadratic in n: at most 3 evaluations per grid point placed,
  n (n + 3) / 2 points for n steps, against about 7 before (14,000 evaluations at 64 steps
  before, 2,207 now on a whole period of the unit cylinder). A doubling search would place about
  4 n points (about 260 evaluations at 64 steps) and returns the same n where the test is
  monotone, which holds for cuts along circles, lines and helices (every step congruent); it is
  the owner's call whether a different, still valid, count on other surfaces is acceptable.
  Every count is at most 64 and a cut is made only for a band face or a whole torus, so the
  quadratic term is bounded per face.
- A whole-period cut takes one step when the surface chordal bound is at least the cut circle's
  diameter: the cut's two ends are the same 3D point, so the one step has length 0 (within any
  length limit), its midpoint is a diameter away from the chord's midpoint, and the end normals
  agree. `WholePeriodRectangle` then makes a side with no interior point, a degenerate loop on
  the surface. Reached only with a chordal bound larger than the face; `Law_Perf_CutSegmentCountFastStopsEveryWay`
  pins it (count 1 with chordal 3 on the unit cylinder).
- `MeanSpeed`'s two calls use different sample sets (each runs along its own parameter at the
  other's quarter lines), so "both speeds from one sample set" would change the chart; the
  saving is in evaluating only the partial each set averages (126 per face, one per sample),
  which is the count the plan named. `FirstJet` is not needed: no sample needs both partials.
- `QuadSidesOf` built the chart (126 more partials after this chunk, 252 before) a second time
  for a face meshed with quads preferred; `FaceQuadGridIn` takes the tolerance
  `MeshRegionOnce` already holds.
- The warm server's filter matches law names only: a library name (`ChartCutLaws`) matched
  nothing, as R6 found for a qualified name.
- A 30 degree turn bound is met by 12 equal steps of a circle only up to rounding: the search
  gives 13. The agreement law keeps that case; the stop law uses 31 degrees.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan rows, staging README, ticket, uv-regions, I5's domain-once file, L4's witnesses, primer, R6's TRACK.md) | 20 min | |
| Writing the four files | 25 min | |
| Law runs, warm server | 8 min | 7 runs (new laws 3 times, 2 probe runs, preservation once, one parse probe through the pinned CLI) |
| Compiled runs | 1 min | 1 run, 40.2 s |
| Waiting | 5 min | the server matched no law while a merge (L7) was half applied in the library |
| TRACK.md, ticket, commit | 8 min | |

## Lessons

- A `match` on a call's result failed at run time in the interpreter ("match subject is not a
  sum type"); a helper with the sum as its parameter works, as the brief says for locals.
- The warm server answers "no laws matched" both for a library-name filter and while another
  session's merge leaves the library unparsable; check `git status sandbox/step-brep-mesh`
  before suspecting your own file.
