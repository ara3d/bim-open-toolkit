# v1-edges: edge discretization, edge identity, and the assembled mesh's watertightness

Ticket: TKT-413, TKT-414, TKT-400
Status: ready: E3 | working: E1

## Chunks

| Id | Ticket | Goal | Expected |
|---|---|---|---|
| E1 | TKT-413 | The four MAYA files' non-manifold and misoriented edges traced to a face and fixed | 2 h |
| E2 | TKT-414 | NINA-B222-W1x2's edges that do not return named, and made to finish or report undecided | 2 h |
| E3 | TKT-400 | Implicit edge use keys that cannot collide at any 32-bit poly point count | 1 h |

## Done

- E3 (TKT-400), see the commit, about 2.5 h against 1 h (most of it finding why the large witness ran over the 2 s budget, below). Implicit edges keyed by the rank of their pair of point classes among the shell's distinct pairs, `rank * 2 + direction`, below twice the use count, with each edge's two classes kept beside the uses. Files: `faceted-edge-ranks.{types,library,laws}.plato`. Types added: `ImplicitEdgeUseList` (the uses as three parallel arrays), `ShellImplicitEdges` (`ShellPolyEdges` plus `EdgeLow`, `EdgeHigh`).
  - Laws (block `V1EdgesFacetedRanksLaws`, cpu64, budget 2 s, warm server): `Law_V1Edges_RankedKeysAgree` (rank keys give the packed keys' uses up to key names, edge, free-edge, defect and cycle counts, and free-edge classes, on all 12 faceted cases), `Law_V1Edges_RankedKeysOnLargePolygon` (a face bounded by one poly loop of 33,000 points: n edges, n free, one cycle, no defect, chi + B = 2), `Law_V1Edges_PolygonRootsAreGridRoots`: 3 pass in 1.95 s together. The first run after a recompile puts the large-polygon law over 2 s (JIT); the second passes. Under gpu32 the same 3 pass.
  - Before: under gpu32 the packed keys on the same 33,000-point polygon (and on a 100 x 100 sheet of poly quads, 40,000 points) throw `At(Array, Integer): Index was out of range` in `ImplicitBoundaryCycleCountSorted` (wrapped, negative keys decoded into classes); at 500 points they pass. The scratch law that showed it is not committed (it calls only library functions).
  - Under cpu64, the profile the mesher and the law sweeps use, Plato's `Integer` is 64-bit (`Intrinsics/NumberProfile.cs`), so the packed keys cannot overflow there; TKT-400's defect is real only under gpu32. The ticket text predates that check.

## Merge instructions

E3, recommended form (contract request below): `ShellImplicitEdges` replaces `ShellPolyEdges`.
- Types into `02-topology/topology-faceted.types.plato`, library block `V1EdgesFacetedRanks` into `02-topology/topology-faceted.library.plato`, laws into `08-pipeline/pipeline-faceted.laws.plato` (they read layer 8's `FacetedCase` and `FacetedModel`).
- `ImplicitEdgeUses(m, poly, pointRoots)` => `m.ImplicitEdgeUsesRanked(poly, pointRoots)`; `ImplicitEdgeUsesByOffsets` likewise.
- `ShellPolyEdgesOf(m, s)` => `m.ShellImplicitEdgesOf(s)`.
- `ImplicitBoundaryCycleCountSorted(p)` => `p.ImplicitBoundaryCycleCountRanked`; `BoundaryCycleCountPoly(m, t, p)` => `m.BoundaryCycleCountRanked(t, p)`; `ShellEulerPlusBoundaryCycles(m, s)` => `m.ShellEulerPlusBoundaryCyclesRanked(s)`.
- The counts that read only runs of keys and the direction bit (`UseRunEnd`, `ImplicitEdgeCountSorted`, `ImplicitFreeEdgeKeysSorted`, `PolyEdgeUseDefectsSorted`, `ReducedCountsPolyIndexed`) take the rank-keyed uses unchanged; with the type change, `PolyEdges` is the identity and goes.
- `ImplicitEdgeUse`, `ImplicitEdgeUsesOf` and `ImplicitEdgeKeys`' packed decoding are then unused; delete them.
- `Law_V1Edges_RankedKeysAgree` compares staged code with the packed library code; after the rewire it compares the rank keys with themselves. Keep it only if the packed functions are kept as references under new names; otherwise drop it (the D1 lesson in the plan's ledger).

## Contract requests

- E3: `ShellPolyEdges` gains `EdgeLow: Array<Integer>` and `EdgeHigh: Array<Integer>` (the two classes of the edge of each rank), which is `ShellImplicitEdges`; the packed key's `k / n`, `k % n` decoding in `ImplicitBoundaryCycleCountSorted` has nothing to decode once the keys are ranks.

## Requests to other tracks

- v1-compiler: TKT-410 (`SagittaByHullBoundGiven`) is yours; this track does not replace that function.

## Findings

- E3: the stdlib's `Sort`/`SortedIndices` with a closure comparator costs about 300 us per comparison on the server (12 s for 40,000 three-key uses), and `DistinctCount` sorts the same way; a counting sort over the class range does the same order in about 40 ms. `CoincidenceRootsByGrid` sorts every poly point with a comparator, so a shell of 33,000 poly points exceeds the 2 s law budget in that sort alone. Any shell-scale law over tens of thousands of elements meets this.
- E3: `CoincidenceRootsPairwise`'s `i * n + j` also overflows a 32-bit Integer above 46,340 points under gpu32; it is the quadratic reference only, not called by the production path.
- E1 (TKT-413), traced: the four MAYA files hold one module whose cylinder faces (for example `#38081` in `SHO/MAYA-W261_W271_REVC.step`, face 1366 of the prepared model) have an `EDGE_LOOP` (`#38083`) that does not chain head to tail: both CIRCLE coedges carry the wrong sense. Flipping exactly those two chains the loop; the decoder takes the senses as written, the unwrap then builds a folded UV loop, and the CDT puts three triangles of one face on one mesh edge (the 4 non-manifold and 4 misoriented edges per file). `Law_LoopsChainEndToStart` states the rule; nothing repairs it yet.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Probe project (harness reference), first cold build | 9 min | 1 build |
| Probe rebuilds (incremental) | 1 to 2.5 min each | 3 builds |
| E1 trace: probe runs on MAYA-W261_W271_REVC | 3 min | 2 runs |
| E3 design and staging | 30 min | |
| E3 laws (server, budget 2 s and 60 s, cpu64 and gpu32) | 75 min | 22 runs |
| Pinned CLI cold compile (parse check) | 6.3 min | 1 run |

## Lessons

- `plato_laws.py` answers "no laws matched" for a law name in some runs and accepts the block name or `Block.Law` in others; filter by `Block.Law`.
- A staging path given to `plato_laws.py` must be a Windows path (`C:\...`); the MSYS form `/c/...` is read as `C:\c\...` and matches nothing.
- The server reuses results and JIT between requests, so a law's time is honest only on the first run after a recompile; run a budget check twice and report both.
