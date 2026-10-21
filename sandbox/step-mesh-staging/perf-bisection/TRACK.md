# perf-bisection: the bisection carries its ends down; the estimated sagitta maps its samples once

Ticket: TKT-387
Status: ready: R5

## Files

- `bisection.types.plato` (layer 04): `ImageAnchor` (a point's parameter-space point in one
  image by the global inverse, and the pcurve parameter that seeds the next search),
  `BisectionEnd` (a span end: parameter, curve point, one anchor per image).
- `bisection.library.plato` (library `BisectionCached`, layer 04):
  - `SagittaGiven(m, e, t0, t1, p0, p1)`, `SagittaByHullBoundGiven(m, e, lo, hi, a, b)`: layer 4's
    Sagitta and the body of SagittaByHullBound with the chord's ends given.
  - `GoldenIterationBudget` (43), `EstimatedSagittaBody2Counted(m, e, lo, hi, a, b)`,
    `EstimatedSagittaBody2`: the 65 sample distances mapped once, one golden point per
    iteration, stop at resolution or the budget; at most 110 evaluations.
  - `AnchorCounted`, `AnchorsCounted`, `BisectionEndCounted`: one curve evaluation and one
    global inverse per image per parameter.
  - `SeededEndCounted`, `ImageExceedsCounted`, `ImagesExceedCounted`: the image test of a piece
    from its ends' anchors, reading the same parameter-space points as the reference.
  - `SegmentFailsCachedCounted` (length, tangent, sagitta, images; stops at the first that
    fails), `SegmentFailsOrderedOn(m, e, c, a, b, images)` (the same order for callers holding
    parameters).
  - `SplitSpanCachedCounted`, `SplitSpanCached`, `BisectedCachedCounted(m, e, c, images,
    range)` (returns the curve points with the parameters), `WithVertexEnds`,
    `DiscretizeBoundedOnCached(m, e, c, least, images, range, degenerate)`.
- `bisection-cases.types.plato` (layer 08, law support): `BisectionCase`, `BisectionCases`.
- `bisection.laws.plato` (library `BisectionCachedLaws`, layer 08): the count witness, four
  `Witness_Bisection*` case families, nine `Law_Perf_*`.

## Done

- R5, (this commit), about 1.6 h against 2 h expected. Types added: `ImageAnchor` and
  `BisectionEnd` (a span end with its point and image coordinates is the value the chunk carries
  down; no library type holds a point with per-image anchors), and `BisectionCase` and
  `BisectionCases` (the shared witnesses of strategy part a for the agreement laws).
  - New laws, warm interpreter (cpu64, budget 20): `BisectionCachedLaws` and
    `Law_WorkIsWithinSlope`, 9 of 9 pass.
    - `Law_Perf_BisectionCachedAgrees`, `Law_Perf_DiscretizeBoundedOnCachedAgrees`,
      `Law_Perf_SegmentFailsOrderedAgrees`, over four `BisectionCases` witnesses built once per
      sweep (conics: cylinder, sphere, cone; the crescent sheet's two B-spline arcs on a
      B-spline surface; the five B-spline curve fixtures; the unit box with a pcurve bottom edge
      at speeds 1 and 2; every evaluable edge at chordal 0.01 and 0.001): the parameters equal
      `BisectedParametersGiven`'s bit for bit and the points PointOnEdge's;
      `DiscretizeBoundedOnCached` equals `DiscretizeBoundedOnRanged` bit for bit at least 1 (the
      bisection's points kept) and at three above the bisection's count (the raise path);
      `SegmentFailsOrderedOn` equals `SegmentFailsOn` on every bisection segment and on the whole
      domain.
    - `Law_Perf_SagittaGivenAgrees`: `SagittaGiven` equals `Sagitta` bit for bit on the curve
      fixtures in both parameter orders and on the cylinder's circle.
    - `Law_Perf_EstimatedSagittaWithinBudget`: 67 <= evaluations <= 110 per call.
    - `Law_Perf_SagittaAttainedVerdictAgrees` (25 cases) and
      `Law_Perf_SagittaAttainedBaselineFailKept` (the tsv's failing case k = 12, a =
      -9.387846216274355, b = -3): Law_SagittaIsAttained's verdict is the same with
      `EstimatedSagittaBody2` as with `EstimatedSagitta`, so it keeps its baseline fail once
      wired.
    - `Law_Perf_BisectedCachedWitnessSizes`: the witness sizes are the family's parameter counts.
  - Compiled (pinned CLI e37c032f, csharp, cpu64, `--budget=2`, filter
    `BisectionCachedLaws,Law_WorkIsWithinSlope,Law_SeedsAreSampled,Law_TighterChordalNeverFewerPoints,Law_EdgeReversalLeavesDiscretization,Law_BoundedAgreesOnConsistentModels,BsplineSagittaLaws,EdgeRangedLaws,EdgeTablesLaws,EdgeGuardsLaws,Law_CertifiedSagittaWithinChordal`):
    23 laws, 22 pass, 1 fail (`Law_SagittaIsAttained`, the baseline fail, same case), total
    52.1 s, laws 1.5 s summed; slowest of this chunk `Law_Perf_DiscretizeBoundedOnCachedAgrees`
    0.28 s; witnesses 2.8 s for 62, `Witness_BisectionCrescent` 1.12 s (reference bisection with
    a global Project on a B-spline surface per test); `Law_WorkIsWithinSlope` 0.53 s over all 28
    witnesses.
  - An earlier form ran the reference bisection inside each agreement law and went over 2 s
    compiled on the crescent and the cubic fixture (2.0 to 3.9 s); moving the two bisections into
    shared `BisectionCases` witnesses brought every law under 0.3 s.
  - Count witness `Witness_BisectedCachedWork`: Evaluations are PointOnEdge calls the bisection
    makes itself (seeds and midpoints; not the tangents or the sagitta's), Projections the
    inverse maps (global anchors, and seeded searches of image tests on images without a
    closed-form inverse). Slope `Evaluations(2).Add(Projections(2))`, size the parameter count of
    a family of four edges (the cylinder's two circles, two closed-form images each; the
    crescent's upper arc, one B-spline-surface image; CurveEdgeModel(0)'s cubic, no image) at
    DefaultCriteria(0.01) and (0.0002): sizes 106 and 770. Measured per edge (parameters,
    Evaluations, Projections): at 0.01 (33, 33, 66), (33, 33, 66), (5, 5, 9), (35, 35, 0); at
    0.0002 (257, 257, 514) twice, (33, 33, 65), (223, 223, 0). Totals 106 Evaluations and 141
    Projections at size 106, 770 and 1093 at size 770: one evaluation per parameter, one global
    inverse per image per parameter. The reference evaluated each final parameter 5 to 9 times
    and made two inverse maps per image per test, about four per image per parameter.
  - EstimatedSagittaBody2: evaluations over an 11 x 11 grid of [t0, t1] fractions per fixture,
    largest per fixture: 96, 94, 110, 93, 95 (fixture 2, with a corner, hits the budget).
    EstimatedSagitta made 252 (65 x 2 + 60 x 2 + 2).
  - Verdict preservation, warm interpreter and compiled, cpu64: `Law_SeedsAreSampled` (now
    `EdgeDiscretizingWitnessLaws`, chunk L3), `Law_TighterChordalNeverFewerPoints`,
    `Law_EdgeReversalLeavesDiscretization`, `Law_CertifiedSagittaWithinChordal`,
    `Law_BoundedAgreesOnConsistentModels`, `BsplineSagittaLaws` (`Law_SagittaBoundsArc` pass,
    `Law_SagittaClosedForms` pass, `Law_SagittaIsAttained` fail as in the tsv, same case),
    `EdgeRangedLaws`, `EdgeTablesLaws`, `EdgeGuardsLaws`: 0 differ from
    `reviews/verdicts-cpu64.tsv`. These run the unwired library; the agreement laws carry the
    claim to the wired one.

## Merge instructions

- Move `bisection.types.plato` and `bisection.library.plato` to `04-discretization/` as
  `discretization-ranged-bisection.{types,library}.plato` (sorting after
  `discretization-edge-domain`, whose functions it calls), `bisection-cases.types.plato` and
  `bisection.laws.plato` to `08-pipeline/` as `pipeline-bisection-cases.types.plato` and
  `pipeline-bisection.laws.plato`.
- 04 `discretization-edge-domain.library.plato` `DiscretizeBoundedOnRanged(m, e, c, least, images, range, degenerate)` => `m.DiscretizeBoundedOnCached(e, c, least, images, range, degenerate)` (or move the body in)
- 04 `discretization-edge-domain.library.plato` `BisectedParametersGiven(m, e, c, images, range)` => `m.BisectedCachedCounted(e, c, images, range).Value.Parameters`
- 04 `termination-discretize.library.plato` `BisectedParametersOn(m, e, c, images)` => `m.BisectedParametersGiven(e, c, images, m.EdgeDomain(e).Range)` (E2's line; `discretization-edge-tables.library.plato` line 62 still calls it)
- 04 `termination-discretize.library.plato` `SegmentFailsOn(m, e, c, a, b, images)` => `m.SegmentFailsOrderedOn(e, c, a, b, images)` (the findings' floor counts, `discretization-edge-domain` line 383 and `discretization-edge-tables` line 133, and layer 4's `SegmentFails`)
- 04 `bspline-sagitta.library.plato` `SagittaByHullBoundBody(m, e, t0, t1)` => `m.SagittaByHullBoundGiven(e, t0.Min(t1), t0.Max(t1), m.PointOnEdge(e, t0.Min(t1)), m.PointOnEdge(e, t0.Max(t1)))`
- 04 `bspline-sagitta.library.plato` `EstimatedSagitta(m, e, lo, hi)` => `m.EstimatedSagittaBody2(e, lo, hi, m.PointOnEdge(e, lo), m.PointOnEdge(e, hi))`
- After wiring, `SplitSpanOn` (termination) and `HalvesKeepMinLength` (discretization) have no
  caller: delete them. `Law_Perf_BisectionCachedAgrees`, `Law_Perf_DiscretizeBoundedOnCachedAgrees`,
  `Law_Perf_SegmentFailsOrderedAgrees`, `Law_Perf_SagittaAttainedVerdictAgrees` and
  `Law_Perf_SagittaAttainedBaselineFailKept` then compare a function with itself: delete them
  with the four `Witness_Bisection*` witnesses and the two case types, or keep them as
  determinism checks. Keep `Law_Perf_SagittaGivenAgrees` (Sagitta against SagittaGiven stays a
  real comparison), `Law_Perf_EstimatedSagittaWithinBudget`, `Witness_BisectedCachedWork` and
  `Law_Perf_BisectedCachedWitnessSizes` under non-Perf names.

## Contract requests

- none

## Requests to other tracks

- none

## Findings

- Bit identity of the image test needs the reference's second end: ProjectAlong (and
  ClosestParametersAlong) map a piece's second point by a search seeded with the first point's
  answer, not by the global inverse. So a piece [a, b] reads a's global anchor (carried) and b's
  seeded answer from a, which differs from b's own global anchor by up to the polish's rounding
  on a surface without a closed-form inverse. The cached form keeps one global inverse per
  image per parameter and adds one seeded local search per image test on such images (the
  crescent: 9 Projections for 5 parameters at 0.01, 65 for 33 at 0.0002). Seeding each point
  once from its left neighbour would make it one inverse per image per parameter everywhere,
  but would change decisions near the bound; not done.
- `SeededEndCounted` repeats the i = 1 step of layer 1's `ProjectAlongBySearchCounted` and
  `ClosestParametersAlongBySearchCounted` (kept answer, fallback to the global inverse). Layer 1
  could expose that step as one function both loops and this file call; it is outside this
  chunk's fence. Filed here as debt.
- EstimatedSagittaBody2 changes results within rounding where the distance is smooth at its
  maximum: largest difference from EstimatedSagitta over an 11 x 11 grid per fixture 6.7e-16,
  3.2e-16, 6.0e-16 and 5.5e-16 on fixtures 0, 1, 3, 4. On fixture 2, whose corner is a kink in
  the distance, the iteration budget stops the bracket at about 1e-9 of two sample steps and the
  answer is lower by up to 6.4e-12, far below the length tolerance the consuming laws use
  (1e-6). Law_SagittaIsAttained, Law_SagittaBoundsArc, Law_SagittaClosedForms and
  Law_CertifiedSagittaWithinChordal keep their verdicts (the last three read the hull
  certificate or a closed form, not the estimate).
- No witness has a pcurve that is not straight, so the seeded pcurve branch of
  `SeededEndCounted` (ClosestParameterNear) is not reached by the agreement laws; the pcurve box
  reaches the straight branch only. Its code is the transcription of
  `ClosestParametersAlongBySearchCounted` at i = 1.
- `SagittaByHullBoundGiven` repeats `SagittaByHullBoundBody`'s match until the merge wires one to
  the other.
- The criteria run length, tangent, sagitta, images: the hull certificate and the estimate cost
  more than the three tangents, so the sagitta follows the tangent test, not the order of the
  reference's ||.
- The compiled run again reported "1 degraded bodies" without naming it, as E1 and E2 found.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, ticket, E1 and E2 tracks, bisection, sagitta, ProjectAlong, witnesses) | 20 min | |
| Writing the four files | 30 min | |
| Law runs, warm server | 10 min | 7 runs; one 40 s full recompile after other merges, two empty answers while the library was mid-merge |
| Probes (sizes, sagitta differences) | 5 min | 4 `--call` runs, about 22 s each |
| Compiled runs | 8 min | 6 runs, 44 to 57 s each; one stopped by another session's half-merged R6 |
| TRACK.md, ticket, commit | 10 min | |

## Lessons

- The pinned CLI's `--call=Integer.<Name>` prints any value of a `_`-receiver function: faster
  than probing equalities in a failing law to read a count.
- Agreement laws that rebuild the reference inside the law went over the 2 s budget only under
  load; holding the built values in a `Witness_*` value moved the cost out of every law.
