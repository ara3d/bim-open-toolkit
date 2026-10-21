# perf-edge-domain: each edge's domain computed once per edge

Ticket: TKT-365
Status: merged: E2 (2026-10-21, into 02-topology/topology-edge-domain.library.plato, 04-discretization/discretization-edge-domain.library.plato, 08-pipeline/pipeline-edge-domain.laws.plato; the pipeline path and the four segment laws wired, the per-helper wirings left as references and filed as debt)

## Files

- `edge-domain-topology.library.plato` (library `EdgeRangedTopology`, layer 02):
  `FarthestEdgePointFromGiven(m, e, p, range)`, `IsDegenerateEdgeGiven(m, e, range)`.
- `edge-domain-discretize.library.plato` (library `EdgeRangedDiscretizing`, layer 04): the
  `...Given` forms of every layer 4 function that asked `EdgeDomain` on the discretize,
  refinement and findings paths: `IsEvaluableGiven(d, range)`, `SeedCandidatesGiven`,
  `EdgeSeedsGiven`, `SampledTurningGiven`, `TotalTurningGiven`, `TurnFloorGiven`,
  `MinimumSegmentCountRanged`, `ConicCountGiven`, `ConicCapGiven`, `GapProbeGiven`,
  `IsOffSurfaceAt(m, probe, img, c)`, `UsableImagesGiven`, `UniformExceedsGiven`,
  `RaisedForImagesGiven`, `BisectedParametersGiven`, `DiscretizeBoundedOnRanged`,
  `DiscretizeRanged`, `DiscretizeEdgeRangedCounted`, `DiscretizeAllRangedCounted`,
  `DiscretizeAllRanged`; the four segment laws past their guard (`CertifiedSagittaHolds`,
  `TangentDeviationHolds`, `SegmentMaxLengthHolds`, `ImageChordHolds`),
  `SegmentMeetsCriteriaGiven(m, d, c, i, images, evaluable)`, `MeetsCriteriaRanged`;
  `RefinedHalfGiven`, `RefinedSpanGiven`, `RefinedParametersGiven`, `RefineEdgeBoundedRanged`,
  `RefineEdgeRangedIn`, `RefineRanged`; `EdgeFindingsGiven`, `EdgeFindingsRangedIn`,
  `DiscretizationFindingsRanged`.
- `edge-domain.laws.plato` (library `EdgeRangedLaws`, layer 08): the count witness, the exact
  once-per-edge law, five agreement laws.

## Done

- E2, (this commit), about 0.75 h against 2 h expected. Types added: none (the range is the
  library's `NumberInterval`, the count the existing `Counted<T>` and `Projections`).
  - New laws, warm interpreter (cpu64, budget 20): `EdgeRangedLaws` and
    `Law_WorkIsWithinSlope`, 7 of 7 pass, first run.
    - `Law_Perf_EdgeDomainOncePerEdge`: Projections is exactly the edge count on the cylinder
      (3) and the box (12), and 0 on G1's box with an index out of range.
    - `Law_Perf_DiscretizeAllRangedAgrees` (box, block with a through hole, cylinder,
      `TermOffSurfaceCube(1)`), `...OnOddModels` (`GuardsUnindexedBox`, `TablesDigonBox`,
      `Witness_Sphere`), `...OnSplines` (`Witness_BSplinePatchSolid`): the table is
      `DiscretizeAll`'s bit for bit (`SameTables`), the Insertions and Flips are
      `DiscretizeAllTabledCounted`'s, and `RefineRanged` is `Refine` bit for bit for E1's two
      requests where `IsRefinable` holds.
    - `Law_Perf_DiscretizationFindingsRangedAgrees` (cubes k 0 to 3, findings criteria): field
      for field; the cube k 0 has findings.
    - `Law_Perf_MeetsCriteriaRangedAgrees`: equal to `MeetsCriteria` on every catalog entry of
      the box, the cylinder and the off-surface cube and on each entry coarsened to one segment;
      the coarsened cylinder circle fails.
  - Compiled (pinned CLI e37c032f, csharp, cpu64, `--budget=2`, filter
    `EdgeRangedLaws,Law_WorkIsWithinSlope,Law_SeedsAreSampled,Law_EdgeDomainIsForward,Law_EdgeDomainEndsAtVertices,Law_EdgeDomainEndsCheckAgrees,EdgeTablesLaws,EdgeGuardsLaws`):
    16 laws, 16 pass, total 45.5 s, laws 1.3 s summed; slowest of this chunk
    `Law_Perf_DiscretizeAllRangedAgreesOnSplines` 0.19 s; `Law_WorkIsWithinSlope` 0.62 s over
    all 18 witnesses.
  - Count witness `Witness_DiscretizeAllRangedWork`: Projections are `EdgeDomain` computations
    (two `ClosestParameter` inversions each) made by `DiscretizeAllRangedCounted`; slope
    `Projections(1)`, sizes 3 (unit cylinder: two circles and a seam) and 12 (unit box).
    Measured 3 and 12. The reference made about 12 + 3I + n per edge. Every other function in
    the folder takes the range as a parameter; `EdgeDomain` appears in it at four call sites
    only, one per entry point: `DiscretizeEdgeRangedCounted`, `RefineEdgeRangedIn`,
    `EdgeFindingsRangedIn` and `MeetsCriteriaRanged`.
  - Verdict preservation, warm interpreter, cpu64: `EdgeDiscretizingLaws`, `TermLaws`,
    `EdgeTablesLaws`, `EdgeGuardsLaws`, `Law_SeedsAreSampled`, `Law_EdgeDomainIsForward`,
    `Law_EdgeDomainEndsAtVertices`, `Law_EdgeDomainEndsCheckAgrees`: 53 laws, 52 pass, 1 fail
    (`Law_SegmentFloorMet`, failing in `reviews/verdicts-cpu64.tsv` too); 0 differ from the
    baseline. These run the unwired library; the agreement laws carry the claim to the wired
    one.

## Merge instructions

- Move `edge-domain-topology.library.plato` to `02-topology/` (for example
  `topology-edge-domain.library.plato`), `edge-domain-discretize.library.plato` to
  `04-discretization/` (`discretization-edge-domain.library.plato`), `edge-domain.laws.plato`
  to `08-pipeline/` (`pipeline-edge-domain.laws.plato`).
- 04 `discretization-guards.library.plato` `DiscretizeAllIndexed(m, c, floors)` => `m.DiscretizeAllRanged(c, floors)`
- 04 `discretization-edge-tables.library.plato` `DiscretizeAllTabled(m, c, floors)` => `m.DiscretizeAllRanged(c, floors)`
- 04 `discretization-edge-tables.library.plato` `DiscretizeTabled(m, t, two, e, c, floors)` => `m.DiscretizeRanged(t, two, e, c, floors, m.EdgeDomain(e).Range)`
- 04 `discretization-edge-tables.library.plato` `DiscretizeBoundedOnIndexed(m, e, c, least, images)` => `m.DiscretizeBoundedOnRanged(e, c, least, images, m.EdgeDomain(e).Range, m.IsDegenerateEdge(e))`
- 04 `discretization-edge-tables.library.plato` `RefineTabled(m, d, requests, c)` => `m.RefineRanged(d, requests, c)`
- 04 `discretization-edge-tables.library.plato` `EdgeFindingsIn(t, m, d, c)` => `t.EdgeFindingsRangedIn(m, d, c)`
- 04 `discretization.library.plato` `IsEvaluable(m, d)` => `m.IsEdgeEvaluable(d.Edge) ? d.IsEvaluableGiven(m.EdgeDomain(d.Edge).Range) : false`
- 04 `discretization.library.plato` `EdgeSeeds(m, e)` => `m.EdgeSeedsGiven(e, m.EdgeDomain(e).Range)`; delete `SeedCandidates` (no other caller) or point it at `SeedCandidatesGiven` the same way
- 04 `discretization.library.plato` `TotalTurning(m, e)` => `m.TotalTurningGiven(e, m.EdgeDomain(e).Range)`; `SampledTurning(m, e)` => `m.SampledTurningGiven(e, m.EdgeDomain(e).Range)`
- 04 `discretization.library.plato` `ConicSegmentCount(m, e, c, least)` => `m.ConicCountGiven(e, c, least, m.EdgeDomain(e).Range)`; `ConicSegmentCap` => `m.ConicCapGiven(e, c, least, m.EdgeDomain(e).Range)`
- 04 `discretization.library.plato` `MeetsCriteria(m, d, c)` => `m.MeetsCriteriaRanged(d, c)`
- 04 `termination-discretize.library.plato` `GapProbe(m, e)` => `m.GapProbeGiven(e, m.EdgeDomain(e).Range)`; `IsOffSurface(m, e, img, c)` => `m.IsOffSurfaceAt(m.GapProbe(e), img, c)`
- 04 `termination-discretize.library.plato` `UniformExceeds(m, e, c, count, images)` => `m.UniformExceedsGiven(e, c, count, images, m.EdgeDomain(e).Range)`; `RaisedForImagesBounded(m, e, c, n, cap, images)` => `m.RaisedForImagesGiven(e, c, n, cap, images, m.EdgeDomain(e).Range)`; `BisectedParametersOn(m, e, c, images)` => `m.BisectedParametersGiven(e, c, images, m.EdgeDomain(e).Range)`
- 04 `termination-discretize.library.plato` `SegmentMeetsCriteriaOn(m, d, c, i, images)` => `m.SegmentMeetsCriteriaGiven(d, c, i, images, m.IsEvaluable(d))`
- 04 `termination-discretize.library.plato` `RefineEdgeBoundedOn(m, d, c, segments, images)` => `m.RefineEdgeBoundedRanged(d, c, segments, images, m.EdgeDomain(d.Edge).Range)`; delete `RefinedParametersOn`, `RefinedSpanOn`, `RefinedHalfOn` if nothing else calls them (grep: only each other and `RefineEdgeBoundedOn`)
- 04 `discretization-edge-tables.library.plato` `EdgeFindingsFrom(m, d, c, all, images)` => `m.IsEdgeEvaluable(d.Edge) ? m.EdgeFindingsGiven(d, c, all, images, m.EdgeDomain(d.Edge).Range) : Diagnostic.NoDiagnostics`
- 04 `discretization.laws.plato`: `Law_CertifiedSagittaWithinChordal` => `m.IsEvaluableSegment(d, i) ? m.CertifiedSagittaHolds(d, c, i) : true`; `Law_TangentDeviationWithinHalfAngular` => `m.IsEvaluableSegment(d, i) ? m.TangentDeviationHolds(d, c, plan, i) : true`; `Law_SegmentWithinMaxLength` => `m.IsEvaluableSegment(d, i) ? m.SegmentMaxLengthHolds(d, c, i) : true`; `Law_ImageChordWithinChordal` => `(m.IsEvaluableSegment(d, i) && m.IsImageEvaluable(img)) ? m.ImageChordHolds(d, c, img, plan, i) : true`. The four bodies sit in the layer 4 library this chunk adds, and the laws file is layer 4 too, so no layer order changes.
- 02 `topology.library.plato` `IsDegenerateEdge` keeps its body (it asks `EdgeDomain` only when the ends are close); `FarthestEdgePointFrom(m, e, p)` => `m.FarthestEdgePointFromGiven(e, p, m.EdgeDomain(e).Range)`.
- 08 `pipeline-edge-tables.laws.plato` `Witness_DiscretizeAllTabledWork`: once `DiscretizeAllTabledCounted` is wired to `DiscretizeAllRangedCounted` (or left as is and unused), its slope gains `.Add(Projections(1))` if it reads the ranged form's work (E edges <= E + C sizes). Simplest: point `DiscretizeAllTabledWork` at `DiscretizeAllRangedCounted` and add `.Add(Projections(1))`, then delete `DiscretizeAllTabledCounted`.
- After wiring, the `Law_Perf_*Agrees` laws compare a function with itself: delete them or keep them as determinism checks. Keep `Law_Perf_EdgeDomainOncePerEdge` as `Law_EdgeDomainOncePerEdge` and the witness.

## Contract requests

- none

## Findings

- `Law_ImageChordWithinChordal` computes `ImageChordDeviations(d, img, plan)` for the whole
  discretization and reads entry i, so `SegmentMeetsCriteriaOn` over every segment is O(n^2)
  surface evaluations and projections per image (`ImageChordHolds` keeps that, to stay bit
  identical). `MeetsCriteria` and `RefinedParametersOn` both ask it per segment. A later chunk
  can compute the deviations once per (d, image) and pass them in.
- `SharesCurveParameter`, `SpanSharesCurveParameter` and `EdgeBreakFractions` (layer 2 lines
  668 to 707) ask `EdgeDomain` about five times per span, but nothing on the discretization
  path calls them (no caller in any library file; laws and validation only), so they are left
  out of this chunk.
- Layer 7's `validation-oracles.library.plato` (lines 97, 368, 1058) and
  `validation-checks-discretization.library.plato` (line 396) also call `EdgeDomain` per
  question; not on the pipeline's discretization path.
- The compiled run again reported "1 degraded bodies" without naming it, as E1 found.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, ticket, E1 track, layers 2 and 4, callers) | 15 min | |
| Writing the three files | 20 min | one heredoc failed in the shell; rewritten with the file tool |
| Law runs, warm server | 1 min | 2 runs (new laws, preservation) |
| Compiled run | 1 min | 1 run, 45.5 s |
| TRACK.md, ticket, commit | 8 min | |

## Lessons

- A bash heredoc holding a long Plato file with apostrophes in comments failed to parse in the
  agent's shell; writing the file with the file tool avoided it.
