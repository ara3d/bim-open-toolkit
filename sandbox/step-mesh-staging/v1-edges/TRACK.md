# v1-edges: edge discretization, edge identity, and the assembled mesh's watertightness

Ticket: TKT-413, TKT-419, TKT-414, TKT-400
Status: ready: E3, E1 | working: E2

## Chunks

| Id | Ticket | Goal | Expected |
|---|---|---|---|
| E1 | TKT-413, TKT-419 | The four MAYA files' non-manifold and misoriented edges traced to a face and fixed; the edge-loop chain repair TKT-419 asks for | 2 h |
| E2 | TKT-414 | NINA-B222-W1x2's edges that do not return named, and made to finish or report undecided | 2 h |
| E3 | TKT-400 | Implicit edge use keys that cannot collide at any 32-bit poly point count | 1 h |

## Done

- E3 (TKT-400), see the commit, about 2.5 h against 1 h (most of it finding why the large witness ran over the 2 s budget, below). Implicit edges keyed by the rank of their pair of point classes among the shell's distinct pairs, `rank * 2 + direction`, below twice the use count, with each edge's two classes kept beside the uses. Files: `faceted-edge-ranks.{types,library,laws}.plato`. Types added: `ImplicitEdgeUseList` (the uses as three parallel arrays), `ShellImplicitEdges` (`ShellPolyEdges` plus `EdgeLow`, `EdgeHigh`).
  - Laws (block `V1EdgesFacetedRanksLaws`, cpu64, budget 2 s, warm server): `Law_V1Edges_RankedKeysAgree` (rank keys give the packed keys' uses up to key names, edge, free-edge, defect and cycle counts, and free-edge classes, on all 12 faceted cases), `Law_V1Edges_RankedKeysOnLargePolygon` (a face bounded by one poly loop of 33,000 points: n edges, n free, one cycle, no defect, chi + B = 2), `Law_V1Edges_PolygonRootsAreGridRoots`: 3 pass in 1.95 s together. The first run after a recompile puts the large-polygon law over 2 s (JIT); the second passes. Under gpu32 the same 3 pass.
  - Before: under gpu32 the packed keys on the same 33,000-point polygon (and on a 100 x 100 sheet of poly quads, 40,000 points) throw `At(Array, Integer): Index was out of range` in `ImplicitBoundaryCycleCountSorted` (wrapped, negative keys decoded into classes); at 500 points they pass. The scratch law that showed it is not committed (it calls only library functions).
  - Under cpu64, the profile the mesher and the law sweeps use, Plato's `Integer` is 64-bit (`Intrinsics/NumberProfile.cs`), so the packed keys cannot overflow there; TKT-400's defect is real only under gpu32. The ticket text predates that check.

- E1 (TKT-413, TKT-419), see the commit, about 3.5 h against 2 h (a probe against the harness, a regeneration of the C# from a scratch copy with the repair wired in, and the switch from coedge flips to edge reversals once TKT-419's evidence showed the arcs' intended sweep). Library `V1EdgesLoopChaining` (`loop-chaining.library.plato`): an edge loop that does not chain head to tail (`Law_LoopsChainEndToStart`) gets the senses that chain it with the fewest changes; an edge on a wrapping curve (circle, ellipse) whose every citation wants the change is reversed (vertices swapped: the complementary arc), every other change is a coedge flip; a loop no sense chains is kept. `LoopsChained` runs after `Reduced` in `PrepareModelWith` and reports `STEP-EDGE-REVERSED` per edge and `STEP-COEDGE-SENSE-FLIPPED` per coedge. No type added: the repair reads and writes the existing edges and loops.
  - Laws (block `V1EdgesLoopChainingLaws`, cpu64, budget 2 s): 9 pass in 0.3 s: witnesses untouched (loops, and edges with loops), one flipped box coedge restored, every one- or two-flip pentagon restored, the cylinder sector with both arcs' vertices swapped restored by reversing exactly those arcs, an arc coedge flipped in one loop only restored by a coedge flip, an unchainable loop kept, the raw cube through `PrepareModelChained` (one diagnostic), the swapped sector through `LoopsChained` (two reversals, no flip).
  - Per file, on the C# regenerated (pinned compiler e37c032f) from HEAD cd33c998 plus this folder's repair wired into `PrepareModel`, meshed the harness's way (host tables, parallel rows), checked by a probe beside the harness's `MeshCheck`:

    | File | Before (corpus run 2026-10-21) | After |
    |---|---|---|
    | MAYA-W261_W271_REVC | 4 non-manifold, 4 misoriented; 9 plane faces not simple (TKT-412) | 0, 0, oriented; no face not simple; 32 arcs reversed |
    | MAYA-W260_REVC | 4, 4; 9 not simple | 0, 0, oriented; no face not simple; 42 arcs reversed |
    | MAYA-W266_W276_REVC | 4, 4; 9 not simple | 0, 0, oriented; no face not simple; 32 arcs reversed |
    | M2-MAYA-W271 | 2, 4 | 2, 4: no broken loop; the cause is two needle cone faces, TKT-420 (filed) |

    Every boundary edge left in the REVC files lies on a B-rep edge that one face cites (the files are open-shell surface models: 1,168 in W261, 2,592 in W260) or beside an unmeshed face (8 and 12, TKT-410 and TKT-411); none lies between two meshed faces.
  - The whole corpus (88 files) through decode and the repaired `PrepareModel`: the repair fires in those three files only, 106 edges reversed and no coedge flipped, and no edge loop in any file is left unchained, so the other 85 files' models are unchanged.

## Merge instructions

E3, recommended form (contract request below): `ShellImplicitEdges` replaces `ShellPolyEdges`.
- Types into `02-topology/topology-faceted.types.plato`, library block `V1EdgesFacetedRanks` into `02-topology/topology-faceted.library.plato`, laws into `08-pipeline/pipeline-faceted.laws.plato` (they read layer 8's `FacetedCase` and `FacetedModel`).
- `ImplicitEdgeUses(m, poly, pointRoots)` => `m.ImplicitEdgeUsesRanked(poly, pointRoots)`; `ImplicitEdgeUsesByOffsets` likewise.
- `ShellPolyEdgesOf(m, s)` => `m.ShellImplicitEdgesOf(s)`.
- `ImplicitBoundaryCycleCountSorted(p)` => `p.ImplicitBoundaryCycleCountRanked`; `BoundaryCycleCountPoly(m, t, p)` => `m.BoundaryCycleCountRanked(t, p)`; `ShellEulerPlusBoundaryCycles(m, s)` => `m.ShellEulerPlusBoundaryCyclesRanked(s)`.
- The counts that read only runs of keys and the direction bit (`UseRunEnd`, `ImplicitEdgeCountSorted`, `ImplicitFreeEdgeKeysSorted`, `PolyEdgeUseDefectsSorted`, `ReducedCountsPolyIndexed`) take the rank-keyed uses unchanged; with the type change, `PolyEdges` is the identity and goes.
- `ImplicitEdgeUse`, `ImplicitEdgeUsesOf` and `ImplicitEdgeKeys`' packed decoding are then unused; delete them.
- `Law_V1Edges_RankedKeysAgree` compares staged code with the packed library code; after the rewire it compares the rank keys with themselves. Keep it only if the packed functions are kept as references under new names; otherwise drop it (the D1 lesson in the plan's ledger).

E1 (TKT-413, TKT-419):
- Library block `V1EdgesLoopChaining` (`loop-chaining.library.plato`) into `03-step` (a preparation repair beside `Reduced`); its laws (`loop-chaining.laws.plato`) into `08-pipeline`, since they read layer 7's `Witness_UnitBox` and `WitnessAt`.
- `PrepareModelWith(raw, policy)`: `.Reduced` => `.Reduced.LoopsChained` (one token); then delete the staged `PrepareModelWithChained` and `PrepareModelChained`, which are that body copied for the staging test, and point `Law_V1Edges_PrepareChainsFlippedCube` at `PrepareModel`.
- With the contract request below applied, `CoedgeSenseFlippedDiagnostic(where, i)` => `Diagnose(StepDiagnosticCode.CoedgeSenseFlipped, where, i.ToNumber)` and `EdgeReversedDiagnostic(where, n)` => `Diagnose(StepDiagnosticCode.EdgeReversedToChain, where, n.ToNumber)`.
- TKT-419's three boxes: the witness its first box asks for is the cylinder sector with swapped arcs (`Law_V1Edges_RepairReversesSwappedArcs`), not a cut of loop #39396; the per-file table above is the evidence for its second box; `Law_V1Edges_ChainingKeepsUnchainableLoop` keeps an unchainable loop as written, but no located diagnostic is added for it yet (box 3 open).

## Contract requests

- E1: `StepDiagnosticCode` gains `CoedgeSenseFlipped` and `EdgeReversedToChain`; `Diagnose` maps them to the warnings `STEP-COEDGE-SENSE-FLIPPED` and `STEP-EDGE-REVERSED` with the messages in `CoedgeSenseFlippedDiagnostic` (Measure: the coedge's position in the loop as written) and `EdgeReversedDiagnostic` (Measure: the loop citations mended). Until then the staged functions build the `Diagnostic` themselves.

- E3: `ShellPolyEdges` gains `EdgeLow: Array<Integer>` and `EdgeHigh: Array<Integer>` (the two classes of the edge of each rank), which is `ShellImplicitEdges`; the packed key's `k / n`, `k % n` decoding in `ImplicitBoundaryCycleCountSorted` has nothing to decode once the keys are ranks.

## Requests to other tracks

- v1-gate: E1 implements TKT-419's repair (claimed by this track, 2026-10-22); the 27 twelve-edge plane faces of TKT-412 mesh with it. Nothing for you to build there.
- v1-faces: TKT-420 (needle cone faces, layer 5) is filed and unowned; it is near TKT-411's three-edge cones.

- v1-compiler: TKT-410 (`SagittaByHullBoundGiven`) is yours; this track does not replace that function.

## Findings

- E3: the stdlib's `Sort`/`SortedIndices` with a closure comparator costs about 300 us per comparison on the server (12 s for 40,000 three-key uses), and `DistinctCount` sorts the same way; a counting sort over the class range does the same order in about 40 ms. `CoincidenceRootsByGrid` sorts every poly point with a comparator, so a shell of 33,000 poly points exceeds the 2 s law budget in that sort alone. Any shell-scale law over tens of thousands of elements meets this.
- E3: `CoincidenceRootsPairwise`'s `i * n + j` also overflows a 32-bit Integer above 46,340 points under gpu32; it is the quadratic reference only, not called by the production path.
- E1 (TKT-413): in the three MAYA REVC files, cylinder faces such as `#38081` (face 1366 of W261's prepared model) have an `EDGE_LOOP` (`#38083`) that does not chain head to tail: both CIRCLE edges (radius 0.15) are written with their vertices the wrong way round, as TKT-419 found for the plane faces' arcs. Taken as written, the unwrap builds a folded parameter-space loop and the CDT puts three triangles of one face on one mesh edge: the 4 non-manifold and 4 misoriented edges per file. Flipping the coedges instead of reversing the arcs also chains the loop, and clears the mesh check, but keeps 352 degree arcs where the corner is 7.7 degrees: a mesh check cannot tell the two apart, only the geometry the loop's lines imply.
- E1: M2-MAYA-W271's defect is not a broken loop. Faces 1672 and 1730 are needle cones (about 0.0005 mm across, 1.25 mm slant, chart ScaleU 0.00025); refinement joins one interior point to the apex copies at u = pi and u = 2 pi, so four triangles share one mesh edge. Filed as TKT-420 (layer 5).

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Probe project (harness reference), first cold build | 9 min | 1 build |
| Probe rebuilds (incremental) | 1 to 2.5 min each | 3 builds |
| E1 trace: probe runs on MAYA-W261_W271_REVC | 3 min | 2 runs |
| E1 staging and laws | 50 min | 3 law runs |
| E1 scratch regeneration (clean exports, pinned compiler) | 3 min each | 2 |
| E1 probe builds against the scratch C# | 1 to 3 min each | 5 |
| E1 MAYA runs (4 files) and corpus decode scan (88 files) | 6 min and 4 min | 3 and 1 |
| E3 design and staging | 30 min | |
| E3 laws (server, budget 2 s and 60 s, cpu64 and gpu32) | 75 min | 22 runs |
| Pinned CLI cold compile (parse check) | 6.3 min | 1 run |

## Lessons

- `plato_laws.py` answers "no laws matched" for a law name in some runs and accepts the block name or `Block.Law` in others; filter by `Block.Law`.
- A staging path given to `plato_laws.py` must be a Windows path (`C:\...`); the MSYS form `/c/...` is read as `C:\c\...` and matches nothing.
- Regenerating the C# from a scratch copy (git archive of HEAD plus the staged file wired in, made a throwaway repository because `regen-step-brep.ps1` reads commits) and building a probe against a scratch copy of bim-open-data with `-p:DepsRoot=<toolkit>\deps\` gave real-file evidence before the merge in about 10 minutes a round.
- A mesh check alone would have accepted the wrong repair (coedge flips); read the file's geometry, and the other tracks' findings, before choosing between repairs that both pass the check.
- The server reuses results and JIT between requests, so a law's time is honest only on the first run after a recompile; run a budget check twice and report both.
