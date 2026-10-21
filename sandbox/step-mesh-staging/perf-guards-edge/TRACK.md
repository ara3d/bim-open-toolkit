# perf-guards-edge: ask Law_IndicesInRange once per model, not once per edge

Ticket: TKT-358
Status: ready: G1

## Files

- `guards-edge.library.plato` (library `EdgeGuards`, layer 04): `CanDiscretizeInRange(m, e, c)`,
  CanDiscretize without the whole-model conjunct (precondition `m.Law_IndicesInRange`);
  `DiscretizeAllCounted(m, c, floors): Counted<EdgeDiscretizations>`, the table with
  `Law_IndicesInRange` asked once and that scan counted as `Flips(1)`; `DiscretizeAllIndexed`,
  its `.Value`.
- `guards-edge-pipeline.library.plato` (library `PipelineEdgeGuards`, layer 08):
  `EdgeDiagnosticsInRange(m, o)`, EdgeDiagnostics with the model checked once.
- `guards-edge.laws.plato` (library `EdgeGuardsLaws`, layer 08: it uses layer 7's witnesses and
  layer 8's `CatalogEdgeCriteria`, `WitnessOptions`, `EdgeDiagnostics`): the count witness
  `Witness_DiscretizeAllIndexedWork` and four `Law_Perf_*` agreement laws.

## Done

- G1, (this commit), about 0.75 h against 1.5 h expected. No new type: the chunk adds functions
  over existing types and W0's `Counted<T>`.
  - New laws, warm interpreter (cpu64) and compiled (pinned CLI e37c032f, csharp, cpu64,
    `--budget=2`, 35.3 s total, laws 0.3 s summed), 5 of 5 pass on both:
    - `Law_Perf_CanDiscretizeInRangeAgrees` (25 cases): `Law_IndicesInRange ? CanDiscretizeInRange : false` equals `CanDiscretize`.
    - `Law_Perf_DiscretizeAllIndexedAgrees` (1 case, 0.11 s compiled): bit for bit equal to
      `DiscretizeAll` and `DiscretizeAllBounded` under the catalog criteria on the unit box, the
      block with a through hole, the cylinder, `TermOffSurfaceCube(1)` and a unit box whose body
      names a missing shell (index out of range: every entry Undiscretized), with one scan
      counted. A deliberately false probe (`Flips == 2`, reverted) failed, so the case is real.
    - `Law_Perf_EdgeDiagnosticsInRangeAgrees` (14 cases, every Witness_ model) and
      `Law_Perf_EdgeDiagnosticsInRangeAgreesUnindexed` (1 case, one finding per edge).
    - `Law_WorkIsWithinSlope` (2 cases: W0's `Witness_RaisedToCountWork` and this chunk's
      `Witness_DiscretizeAllIndexedWork`): slope `Flips(1)` per edge, sizes 12 (unit box) and 24
      (block with a through hole); measured 1 flip at each.
  - Verdict preservation, warm interpreter, cpu64: `EdgeDiscretizingLaws`, `TermLaws`,
    `Law_UndiscretizableEdgeIsDiagnosed`, `Law_EmptyDiscretizationExactlyWhenEdgeUnusable`,
    `Law_FinalDiscretizationsMeetFloors`: 48 laws, 47 pass, 1 fail
    (`Law_SegmentFloorMet`, which fails in `reviews/verdicts-cpu64.tsv` too); 0 of 48 differ
    from the baseline. These run the unwired library; the agreement laws carry the claim over
    to the wired one.

## Merge instructions

- Move `guards-edge.library.plato` to `04-discretization/`, `guards-edge-pipeline.library.plato`
  and `guards-edge.laws.plato` to `08-pipeline/`.
- 04 `discretization.library.plato` `CanDiscretize(m, e, c)` => `m.Law_IndicesInRange ? m.CanDiscretizeInRange(e, c) : false`
- 04 `discretization.library.plato` `DiscretizeAll(m, c, floors)` => `m.DiscretizeAllIndexed(c, floors)`
  (`DiscretizedEntry` stays: five layer 4 laws call it per edge.)
- 04 `termination-discretize.library.plato` `DiscretizeAllBounded(m, c, floors)` => `m.DiscretizeAllIndexed(c, floors)`
- 08 `pipeline.library.plato` `EdgeDiagnostics(m, o)` => `m.EdgeDiagnosticsInRange(o)`
- After wiring, `Law_Perf_DiscretizeAllIndexedAgrees` and the two diagnostics agreement laws
  compare a function with itself; delete them or keep them as determinism checks. Keep
  `Law_Perf_CanDiscretizeInRangeAgrees` (it states the wiring) under a non-Perf name.

## Contract requests

- none

## Findings

- The count witness does not separate the fixed function from the old one. `Law_WorkIsWithinSlope`
  bounds work by slope times size, so with size the edge count the old code's E scans equal
  `Flips(1).Times(E)` and pass too. What pins "one scan" is `Law_Perf_DiscretizeAllIndexedAgrees`'s
  `Work.Flips == 1`, and that count is a literal in the counted form. A claim of constant work
  (a `WorkClaim` whose bound does not scale with size, or a count of model rows visited by scans,
  which the old code makes E times M) would make the witness a real guard; that is a W0 contract
  question, not built here.
- `IsRefinable` (04 `discretization.library.plato` line 837) calls `CanDiscretize` per entry, so
  it is O(E M) too. Only laws and specs call it (`Law_PendingRequestsAreRefinable`, three layer 4
  Refine laws), so it costs law budget, not meshing time; after the wiring it costs one scan per
  requested entry.
- `RefusalDiagnostics` and `IsRunnable` (08) each ask `Law_IndicesInRange` once per run: two
  scans per `MeshModel`, linear, left alone.
- The warm server (127.0.0.1:8768) twice answered "0 laws ... recompiled True" or "recompiled
  None" for a filter that matched; the same call a few seconds later ran. Another session sharing
  the server is the likely cause; a retry loop on `^0 laws` was enough.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, staging README, sites, callers, LawRunner domains) | 15 min | |
| Writing the three files | 10 min | |
| Law runs, warm server | 5 min | 6 runs (2 empty answers, retried) |
| Compiled run | 1 min | 1 run, 35.3 s |
| TRACK.md, ticket, commit | 8 min | |

## Lessons

- A law whose only parameter is `_: Integer` runs exactly once (`LawRunner.DomainOf`: a `_`
  receiver takes the type itself), so it is the cheap way to bind several built tables once per
  law without a new witness type.
