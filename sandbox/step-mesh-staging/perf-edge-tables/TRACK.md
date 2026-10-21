# perf-edge-tables: the faces of every edge and the two-edge-loop flags built once per model

Ticket: TKT-364
Status: merged: E1 (2026-10-21, into 02-topology/topology-edge-tables.{types,library}.plato, 04-discretization/discretization-edge-tables.library.plato, 08-pipeline/pipeline-edge-tables.laws.plato)

## Files

- `edge-tables.types.plato` (layer 02): `EdgeFaceTable`, compressed rows (`Offsets`, `Faces`):
  row e is the faces whose bounds cite edge e, in face order, once each.
- `edge-tables.library.plato` (library `BrepEdgeTables`, layer 02): `EdgeFaceTableCounted`,
  `EdgeFaceTable`, `HasEdgeRow`, `FaceCountOf`, `FacesOfEdgeIn(t, e)`;
  `TwoEdgeLoopEdgesCounted`, `TwoEdgeLoopEdges(m): Array<Boolean>`.
- `edge-tables-discretize.library.plato` (library `EdgeTabledDiscretizing`, layer 04):
  `EdgeImagesIn(t, m, e)`, `UsableImagesFrom(m, e, c, all)`, `MinimumSegmentCountGiven`,
  `DiscretizeBoundedOnIndexed(m, e, c, least, images)` (chunk E2 rewrites this one to bind the
  edge domain once), `DiscretizeTabled`, `DiscretizeAllTabledCounted`, `DiscretizeAllTabled`,
  `RefineEdgeIn`, `RefineTabled`, `EdgeFindingsFrom`, `EdgeFindingsIn`,
  `DiscretizationFindingsTabled`, `SegmentsMeetCriteriaOn`.
- `edge-tables.laws.plato` (library `EdgeTablesLaws`, layer 08: layer 7 witnesses, G1's
  `SameTables` and `GuardsUnindexedBox`): the count witness, two odd models, six `Law_Perf_*`.

## Done

- E1, (this commit), about 0.9 h against 2 h expected. Type added: `EdgeFaceTable` (the stdlib's
  `JaggedArray<BrepFaceIndex>` would do, but the C# writer emits no member for a function whose
  receiver is a generic instance, as M2 found).
  - New laws, warm interpreter (cpu64, budget 20): `EdgeTablesLaws` and `Law_WorkIsWithinSlope`,
    7 of 7 pass. Compiled (pinned CLI e37c032f, csharp, cpu64, `--budget=2`, filter
    `EdgeTablesLaws,Law_WorkIsWithinSlope,Law_RaiseSearchEndsAtCap,Law_OffSurfaceEdgeIsDiagnosed,Law_ClosedEdgeHasMinSegments,Law_PcurveSurfaceIsAFaceSurface,Law_ClosureHoldsFacesOfEdge`):
    12 laws, 12 pass, total 35.3 s, laws 0.9 s summed; slowest of this chunk
    `Law_Perf_MeetsCriteriaOnceAgrees` 0.13 s and `Law_Perf_DiscretizeAllTabledAgrees` 0.12 s.
    - `Law_Perf_EdgeTablesAgree` (14 cases, every Witness_ model): row e is `FacesOfEdge(m, e)`
      and flag e is `IsInTwoEdgeLoop(m, e)`, for every edge.
    - `Law_Perf_EdgeTablesAgreeOnOddModels`: the same on a box with a two-coedge loop and a box
      with a bound naming a missing loop, a coedge naming a missing edge, an edge cited twice by
      one face, and an uncited two-coedge loop; the flags and the merged row are checked to occur.
    - `Law_Perf_DiscretizeAllTabledAgrees`: `DiscretizeAllTabled` equals `DiscretizeAll` bit for
      bit, and `RefineTabled` equals `Refine` (two requests: chordal tightened on edge 0, count 5
      on edge 2), on the box, the block with a through hole, the cylinder,
      `TermOffSurfaceCube(1)`, G1's unindexed box, and both odd models (Refine where
      `IsRefinable` holds: five of them, probed). The digon box's edges 2 and 3 get the
      two-edge-loop floor.
    - `Law_Perf_DiscretizationFindingsTabledAgrees` (cubes k 0 to 3, findings criteria): field
      for field; the cube k 0 has findings.
    - `Law_Perf_MeetsCriteriaOnceAgrees`: `MeetsCriteria` equals `SegmentsMeetCriteriaOn` over
      the edge's images computed once, on every catalog entry of the box, the cylinder and the
      off-surface cube, and on each entry coarsened to one segment (fails on the cylinder's
      circles, probed).
    - `Law_Perf_TablesWitnessSizes`: the witness sizes are the models' E + C.
  - Count witness `Witness_DiscretizeAllTabledWork`: Insertions are faces, loops and coedges
    visited by the two table passes, two per (edge, face) pair sorted, and one per face read
    from a row; Flips the one index scan (G1). Slope `Insertions(4).Add(Flips(1))`, sizes 36
    (unit box, 12 edges + 24 coedges) and 72 (block with a through hole, 24 + 48). Measured 108
    and 214 Insertions, 1 Flip each, against allowances of 144 and 288. The reference visits
    every face's coedges per edge at least once: 12 x 24 = 288 on the box alone, above the 144
    allowance, so the witness separates the fixed function from the old one. Face scans per
    edge: 0.
  - Verdict preservation, warm interpreter, cpu64: `EdgeDiscretizingLaws`, `TermLaws`,
    `EdgeGuardsLaws`, `Law_PcurveSurfaceIsAFaceSurface`, `Law_ClosureHoldsFacesOfEdge`,
    `Law_UndiscretizableEdgeIsDiagnosed`, `Law_EmptyDiscretizationExactlyWhenEdgeUnusable`,
    `Law_FinalDiscretizationsMeetFloors`, `Law_MeetsCriteriaProofIffMeetsCriteria`: 53 laws, 52
    pass, 1 fail (`Law_SegmentFloorMet`, failing in `reviews/verdicts-cpu64.tsv` too); 0 differ
    from the baseline (G1's two laws are not in the tsv yet; both pass). These run the unwired
    library; the agreement laws carry the claim over to the wired one.

## Merge instructions

- Move `edge-tables.types.plato` and `edge-tables.library.plato` to `02-topology/` (for
  example as `topology-edge-tables.{types,library}.plato`), `edge-tables-discretize.library.plato`
  to `04-discretization/`, `edge-tables.laws.plato` to `08-pipeline/`.
- 04 `discretization-guards.library.plato` `DiscretizeAllIndexed(m, c, floors)` => `m.DiscretizeAllTabled(c, floors)`
- 04 `discretization.library.plato` `MinimumSegmentCount(m, e, c, floors)` => `m.MinimumSegmentCountGiven(e, c, floors, m.IsInTwoEdgeLoop(e))`
- 04 `discretization.library.plato` `MeetsCriteria(m, d, c)` => `m.IsEvaluable(d) ? m.SegmentsMeetCriteriaOn(d, c, m.EdgeImages(d.Edge)) : false`
- 04 `discretization.library.plato` `Refine(m, d, requests, c)` => `m.RefineTabled(d, requests, c)`
- 04 `termination-discretize.library.plato` `UsableImages(m, e, c)` => `m.UsableImagesFrom(e, c, m.EdgeImages(e))`
- 04 `termination-discretize.library.plato` `DiscretizeBoundedOn(m, e, c, floors, images)` => `m.DiscretizeBoundedOnIndexed(e, c, m.MinimumSegmentCount(e, c, floors), images)`
- 04 `termination-discretize.library.plato` `EdgeFindingsOn(m, d, c, images)` => `m.EdgeFindingsFrom(d, c, m.EdgeImages(d.Edge), images)`
- 04 `termination-discretize.library.plato` `DiscretizationFindings(m, ds, c)` => `m.DiscretizationFindingsTabled(ds, c)`
- After wiring, `Law_Perf_DiscretizeAllTabledAgrees`, `Law_Perf_DiscretizationFindingsTabledAgrees`
  and `Law_Perf_MeetsCriteriaOnceAgrees` compare a function with itself: delete them, or keep
  them as determinism checks. Keep `Law_Perf_EdgeTablesAgree` and
  `Law_Perf_EdgeTablesAgreeOnOddModels` under non-Perf names: `FacesOfEdge` and
  `IsInTwoEdgeLoop` stay as the references (layers 2, 10 and 11 call `FacesOfEdge` once per
  question, where a table would cost the same O(C)).
- G1's `DiscretizeAllCounted` is no longer on the pipeline's path once `DiscretizeAllIndexed` is
  wired; `Law_DiscretizeAllScansTheModelOnce` still holds (it compares it with `DiscretizeAll`).
  Delete it with `Witness_DiscretizeAllIndexedWork`, whose one-scan claim this chunk's witness
  also carries as `Flips(1)`, or keep both.

## Contract requests

- none

## Findings

- `SegmentFails` (04 line 713) and `ImagesExceedChordal` (line 703) have no caller in the
  library, laws or specs; `SegmentMeetsCriteria` (line 816) has one, `MeetsCriteria`, which the
  wiring replaces. All three can be deleted at merge or kept as the plain per-segment API; none
  got a tabled form, since nothing would call it.
- Layer 7's `validation-checks-discretization.library.plato` (lines 285 to 346) calls
  `EdgeImages` per segment and per image index, up to three times in one expression: O(E C) per
  segment check. Not in this chunk's row; a V-chunk can pass `EdgeFaceTable` down the same way.
- `DiscretizationFindings` still probes each image's gap twice per edge (`UsableImagesFrom` and
  `EdgeFindingsFrom` both call `IsOffSurface`): the plan's unchunked 04 C9.
- `Refine` is still O(E R) for R requests (`IsRequested`, `RequestedChordal`,
  `RequestedSegments` scan the requests per entry); the pipeline calls it once per round with
  few requests. Not in this row.
- `Refine` on a table where a requested entry is `Undiscretized` fails with an index out of
  range in `RefinedParametersOn`, the reference as well as `RefineTabled`: `IsRefinable` is the
  precondition that excludes it, and the agreement law states it.
- The compiled run reported "1 degraded bodies" without naming it; not traced to this chunk.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, staging README, G1 and M2 tracks, sites, callers) | 15 min | |
| Writing the four files | 15 min | |
| Law runs, warm server | 6 min | 5 runs (one empty answer, retried) and 2 probe runs |
| Compiled run | 1 min | 1 run, 35.3 s |
| TRACK.md, ticket, commit | 8 min | |

## Lessons

- A failing law prints its case, not the values inside it, so a measured count is read by
  probing equalities in a temporary law file (deleted before the commit).
- `Refine` laws need `IsRefinable` as a guard: an `Undiscretized` entry under a request makes
  both forms index an empty array.
