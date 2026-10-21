# perf-refine-edges: raises by a heap, requests indexed per edge, chord deviations once per edge

Ticket: TKT-388
Status: ready: R6

## Files

- `refine-edges.types.plato` (layer 04): `RaiseNode` (a node of the split forest), `RaisePiece`
  (a heap entry: width, input segment, position key, node), `EdgeRequestIndex` (the strongest
  request per edge: named, smallest chordal, largest count).
- `refine-edges.library.plato` (library `EdgeRefineIndexed`, layer 04): `RanksAbove`,
  `RaisedToCountHeapCounted`, `RaisedToCountHeap`; `RequestIndexCounted`, `IsRequestedIn`,
  `RequestedChordalIn`, `RequestedSegmentsIn`, `RaisedFloorsByScatter`; `ImageDeviationsOf`,
  `ImageChordHoldsFrom`, `SegmentMeetsCriteriaFrom`; `RefinedParametersIndexed`,
  `RefineEdgeBoundedIndexed`, `RefineEdgeIndexedIn`, `RefineIndexedCounted`, `RefineIndexed`.
- `refine-edges.laws.plato` (library `EdgeRefineIndexedLaws`, layer 08: layer 7 witnesses,
  `CatalogEdgeCriteria`, `SameTables`, `Coarsened`, layer 8's `RaisedFloors`): two count
  witnesses, two exact count laws, five agreement laws.

## Done

- R6, (this commit), about 1 h against 2 h expected.
  - New laws, warm interpreter (cpu64, budget 20): `EdgeRefineIndexedLaws`,
    `Law_WorkIsWithinSlope`, `EdgeDiscretizingWorkLaws`: 10 of 10 pass, first run.
    - `Law_Perf_RaisedToCountHeapAgrees`: bit for bit on eight lists (one segment, uneven,
      equal widths, zero widths, decreasing, all equal, two near values, a negative start) at
      counts 0, 1, 2, 5, 17, 40, 64. Green against `RaisedToCount` directly, then retargeted to
      W0's `RaisedToCountCounted(...).Value` (the same loop) so the law keeps comparing two
      algorithms after the wiring.
    - `Law_Perf_RaisedToCountHeapAgreesOnModels`: every discretized entry of the unit box, the
      cylinder and the block with a through hole, raised to count + 5 and 3 count + 1.
    - `Law_Perf_RefineIndexedAgrees`: `RefineIndexed` is `Refine` (`SameTables`) on the box,
      the cylinder, the block with a through hole (all three refinable, asserted) and
      `TermOffSurfaceCube(1)`, for five requests: chordal / 4 on edge 0; counts 23 and 7 (the
      second with chordal / 2) on edge 2; count 40 on edge 1; edge 99, out of range. The index
      lookups equal `IsRequested`, `RequestedChordal`, `RequestedSegments` at every edge.
      Probed non-vacuous: box edge 2 goes to 23 segments and edge 1 to 40, the cylinder's
      edge 0 gains segments.
    - `Law_Perf_RaisedFloorsByScatterAgrees`: entry for entry with `RaisedFloors` on the box,
      no floors and five floors, with and without requests (edges -1, 11, 99, and an edge named
      twice).
    - `Law_Perf_SegmentMeetsCriteriaFromAgrees`: `SegmentMeetsCriteriaFrom` equals
      `SegmentMeetsCriteriaGiven` at every segment of every entry, and of each entry coarsened
      to one segment, on the box, the cylinder and the off-surface cube (the coarsened
      cylinder circle fails, probed).
  - Compiled (pinned CLI e37c032f, csharp, cpu64, `--budget=2`, filter
    `EdgeRefineIndexedLaws,Law_WorkIsWithinSlope,EdgeDiscretizingLaws,TermLaws,EdgeDiscretizingWorkLaws,EdgeRangedLaws,Law_FinalDiscretizationsMeetFloors`):
    57 laws, 56 pass, 1 fail (`Law_SegmentFloorMet`, the baseline fail), total 43.4 s, laws
    3.8 s summed; slowest of this chunk `Law_Perf_SegmentMeetsCriteriaFromAgrees` 0.20 s and
    `Law_Perf_RefineIndexedAgrees` 0.16 s; `Law_WorkIsWithinSlope` 1.48 s over all 25
    witnesses. After the reference switch, filter
    `EdgeRefineIndexedLaws,Law_WorkIsWithinSlope,EdgeDiscretizingWorkLaws`: 10 of 10 pass,
    total 43.5 s, laws 1.3 s summed.
  - Count witnesses:
    - `Witness_RaisedToCountHeapWork`: Insertions are parameters copied into the result; slope
      `Insertions(2)`, sizes 8 and 64 segments from `[0, 1]`; measured 9 and 65 (the reference
      copied the whole array per raise, n (n + 1) / 2 in all). The heap's own moves (Flips: one
      per push, one per sift step) grow as n log n, which a linear slope cannot state, so the
      witness reads Insertions only and `Law_Perf_RaisedToCountHeapMovesWithinLog` states the
      rest exactly: Insertions = n + k + 1 and Flips <= n (1 + L) + k (2 + 2 L), L =
      floor(log2(n + k)), on every list and count above. Measured at 64: between 350 and 400
      Flips (bound 889).
    - `Witness_RefineIndexedWork`: Insertions are index slots written, requests visited and
      entries looked up; slope `Insertions(2)`, sizes E + R = 16 and 24 (unit box, 4 and 12
      requests); measured 28 and 36, exactly 2 E + R (`Law_Perf_RefineIndexedScansOnce`). The
      reference scanned R requests per entry and 2 R more per requested entry.
  - Verdict preservation, warm interpreter, cpu64: `EdgeDiscretizingLaws`, `TermLaws`,
    `EdgeDiscretizingWorkLaws`, `EdgeRangedLaws`, `Law_FinalDiscretizationsMeetFloors`,
    `Law_EdgeLaws`: 50 laws, 48 pass, 1 fail (`Law_SegmentFloorMet`), 1 error
    (`BsplinePipelineLaws.Law_EdgeLaws`, time budget), both as in `reviews/verdicts-cpu64.tsv`;
    0 differ. These run the unwired library; the agreement laws carry the claim to the wired one.
  - Types added: `RaiseNode`, `RaisePiece`, `EdgeRequestIndex`.

## Merge instructions

- Move `refine-edges.types.plato` and `refine-edges.library.plato` to `04-discretization/` (for
  example `discretization-refine-indexed.{types,library}.plato`), `refine-edges.laws.plato` to
  `08-pipeline/` (`pipeline-refine-indexed.laws.plato`).
- 04 `discretization.library.plato` `RaisedToCount(m, parameters, least)` => `m.RaisedToCountHeap(parameters, least)`
- 04 `discretization-edge-domain.library.plato` `RefinedParametersGiven(m, d, c, images, range)` => `m.RefinedParametersIndexed(d, c, images, range)`
- 04 `discretization-edge-domain.library.plato` `RefineRanged(m, d, requests, c)` => `m.RefineIndexed(d, requests, c)` (then `RefineEdgeRangedIn` and `RefineEdgeBoundedRanged` have no caller but each other: delete them, or point them at `RefineEdgeIndexedIn` and `RefineEdgeBoundedIndexed`)
- 04 `termination-discretize.library.plato` `RefinedParametersOn(m, d, c, images)` => `m.IsEdgeEvaluable(d.Edge) ? m.RefinedParametersIndexed(d, c, images, m.EdgeDomain(d.Edge).Range) : d.Parameters` (the reference returns a copy of d's parameters when the edge is not evaluable: every segment then passes)
- 08 `pipeline.library.plato` `RaisedFloors(m, floors, requests)` => `m.RaisedFloorsByScatter(floors, requests)`
- 04 `discretization-work.laws.plato`: delete `RaisedWork` and `Witness_RaisedToCountWork`
  (replaced by `Witness_RaisedToCountHeapWork`). Keep `RaisedToCountCounted` and its two laws:
  it is the old loop the heap agreement laws compare against.
- After wiring, `Law_Perf_RefineIndexedAgrees` and `Law_Perf_RaisedFloorsByScatterAgrees`
  compare a function with itself (the request lookups in the first still compare with the
  scans): keep them as determinism checks or delete them. Keep the two witnesses,
  `Law_Perf_RaisedToCountHeapMovesWithinLog`, `Law_Perf_RefineIndexedScansOnce`, both heap
  agreement laws and `Law_Perf_SegmentMeetsCriteriaFromAgrees` under non-Perf names.
- Optional, not in this row: `MeetsCriteriaRanged` (04 `discretization-edge-domain.library.plato`)
  has the same O(n^2) per image. Bind
  `var deviations = m.ImageDeviationsOf(d, images, SamplePlan.DiscretizationPlan);` after
  `images` and test `m.SegmentMeetsCriteriaFrom(d, c, i, deviations, true)` per segment.

## Contract requests

- none

## Findings

- `RaisedToCount` on fewer than two parameters indexes out of range when a raise is needed; the
  heap form returns the parameters unchanged there. Every caller passes a discretization with
  two or more parameters.
- `RequestedChordalIn` takes the minimum over the requests first and with `current` last, where
  the reference folds from `current`: the same value for every bound but a signed zero.
- `MeetsCriteriaRanged` (E2) still asks `SegmentMeetsCriteriaGiven` per segment, so it computes
  each image's deviations for the whole discretization once per segment; the optional wiring
  above fixes it with this chunk's functions.
- The WorkClaim slope is linear, so `Law_WorkIsWithinSlope` cannot state an n log n family (a
  heap); this chunk splits the count (copies in the witness, heap moves in an exact law), as E2
  did with Projections.
- `plato_laws.py` matched no law when the filter held a qualified name
  (`BsplinePipelineLaws.Law_EdgeLaws`); the bare `Law_EdgeLaws` works.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan rows, staging README, E1 and E2 tracks, layer 4 and 8 sites, primer) | 15 min | |
| Writing the three files | 20 min | |
| Law runs, warm server | 5 min | 6 runs (new laws twice, 2 probe runs, preservation twice: one empty filter) |
| Compiled runs | 2 min | 2 runs, 43.4 s and 43.5 s |
| TRACK.md, ticket, commit | 8 min | one heredoc failed in the shell; rewritten with the file tool |

## Lessons

- Probing a measured count by threshold laws in a temporary file (deleted before the commit)
  took two runs; a runner that printed the value would take one.
- A bash heredoc holding apostrophes failed again, as E2 found: write prose files with the file
  tool.
