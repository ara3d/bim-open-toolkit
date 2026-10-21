# perf-sparse-grids: the seven dense topology checks visit only the cells some coedge cites

Ticket: TKT-373
Status: merged: V5 (2026-10-21, into 02-topology/topology-keyed-site-rows.{types,library}.plato, 07-validation/validation-checks-topology-sparse.library.plato, 08-pipeline/pipeline-sparse-grids.laws.plato)

## Files

- `sparse-grids.types.plato` (layer 02): `KeyedSiteRows { Keys, Rows: CoedgeSiteRows }`, coedge
  sites grouped under the keys that occur, keys increasing, one row per key that occurs.
- `sparse-grids-rows.library.plato` (library `BrepKeyedSiteRows`, layer 02):
  `KeyedSiteRowsCounted(keys, sites)` (stable sort by key, negative keys dropped, Insertions one
  per site placed), `NoKeyedSiteRows`, `SitesByEdge(m, sites)`, `SitesByEndVertex(m, sites)`,
  `SitesByTouchedVertex(m, sites)`, helpers `ArrivingVertexKey`, `TouchedVertexKey`, `VertexKey`.
- `sparse-grids-checks.library.plato` (library `BrepCheckingTopologySparse`, layer 07): the fold
  `CheckKeyedRowsCounted`, its three grid shapes `CheckShellEdgesSparseCounted`,
  `CheckShellVerticesSparseCounted`, `CheckFaceEdgesSparseCounted`; `CountsAsEdgeGiven`,
  `LinkComponentCountOf(m, corners)`, `LinkIsOneComponent`, `SortedVertexLoopVertices`,
  `IsInSorted`; and the seven checks `Check_EveryEdgeUsedTwiceInClosedShellSparse` (and its
  `...SparseCounted`), `Check_OpenShellEdgesUsedAtMostTwiceSparse`,
  `Check_EdgeUsesHaveOppositeOrientationSparse`, `Check_SeamUsesRunOppositeSparse`,
  `Check_VertexLinkIsOneCycleSparse`, `Check_OpenShellVertexLinkIsCycleOrPathSparse`,
  `Check_VertexLoopVertexIsIsolatedSparse`.
- `sparse-grids.laws.plato` (library `SparseGridsLaws`, layer 08): `Witness_SparseShellEdgesWork`,
  `Law_Perf_UncitedCellsHold`, `Law_Perf_SparseChecksAgree`, `Law_Perf_SparseChecksAgreeOnOddModels`.

## Done

- V5, (this commit), about 0.9 h against 2 h expected. Type added: `KeyedSiteRows` (see the
  deviation under Findings: V4's per-model-cell tables would keep an O(S E) term).
  - New laws, warm interpreter (cpu64, budget 20): `SparseGridsLaws` 3 of 3 pass
    (`Law_Perf_UncitedCellsHold` and `Law_Perf_SparseChecksAgree` 14 witness models each,
    `Law_Perf_SparseChecksAgreeOnOddModels` over the sphere with redundant pole loops, two boxes
    sharing a corner, the box with a flipped face, E1's digon box and stray box, asserting the
    sparse checks find the failures: pole loop vertex not isolated, shared corner link broken,
    stray box's edge 4 used three times, reported at edge 4). `Law_WorkIsWithinSlope` 24 cases,
    pass.
  - Count witness `Witness_SparseShellEdgesWork`: Insertions are coedges placed in their edge's
    row plus cells visited, slope `Insertions(2)`, sizes 24 (unit box) and 48 (block with a
    through hole), the coedge counts of V4's `ShellTablesModelOfSize`. Measured 36 and 72
    (probed: 24 + 12 cells, 48 + 24 cells). The dense check visits S x E cells and rebuilds the
    shell's C_s sites at each: 12 x 24 = 288 site visits on the box.
  - Verdict preservation, warm interpreter, cpu64, against `reviews/verdicts-cpu64.tsv`:
    `BrepWitnessesLaws.Law_SharedCornerBreaksVertexLink`, `Law_SharedCornerFailsExactlyTwoLaws`,
    `Law_RedundantPoleLoopsFailExactlyTwoLaws` (25), `Law_RedundantPoleLoopVertexIsNotIsolated`
    (25), `Law_FlippedFaceFailsExactlyOneLaw`, `Law_WitnessIsStructurallyClean` (14),
    `BrepCheckingDefectsLaws.Law_EveryFailedCheckIsADefect`: 7 pass, as recorded;
    `BrepCheckingLaws`: 42 pass, 6 skipped, as recorded. They run the unwired library; the
    agreement laws carry the claim to the wired one. Results are exact (no floating point).
  - Compiled, from `C:/Users/cdigg/git/plato`: `dotnet C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll run stdlib/foundation stdlib/geometry stdlib/graphics C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-mesh-staging/perf-sparse-grids --recursive --exclude=brep.types.plato --exclude=brep.library.plato --exclude=brep.concepts.plato --laws --backend=csharp --profile=cpu64 --budget=2 --filter=SparseGridsLaws,Law_WorkIsWithinSlope,Law_SharedCornerBreaksVertexLink,Law_SharedCornerFailsExactlyTwoLaws,Law_RedundantPoleLoopsFailExactlyTwoLaws,Law_RedundantPoleLoopVertexIsNotIsolated,Law_FlippedFaceFailsExactlyOneLaw,Law_WitnessIsStructurallyClean,Law_EveryFailedCheckIsADefect,BrepCheckingLaws`:
    59 laws, 53 pass, 6 skipped (the six `BrepCheckingLaws` with function-typed parameters, as
    recorded); total 38.8 s, laws 5.9 s summed. This chunk's slowest: `Law_Perf_SparseChecksAgree`
    0.35 s over 14 cases, `Law_Perf_SparseChecksAgreeOnOddModels` 0.19 s,
    `Law_Perf_UncitedCellsHold` 0.13 s; `Law_WorkIsWithinSlope` 1.01 s over all 24 claims.

## Merge instructions

- Move `sparse-grids.types.plato` and `sparse-grids-rows.library.plato` to `02-topology/` (as
  `topology-keyed-site-rows.{types,library}.plato`), `sparse-grids-checks.library.plato` to
  `07-validation/` (as `validation-checks-topology-sparse.library.plato`),
  `sparse-grids.laws.plato` to `08-pipeline/` (as `pipeline-sparse-grids.laws.plato`).
- 07 `validation-checks-topology.library.plato` `Check_EveryEdgeUsedTwiceInClosedShell(m)` => `m.Check_EveryEdgeUsedTwiceInClosedShellSparse`
- 07 same file `Check_OpenShellEdgesUsedAtMostTwice(m)` => `m.Check_OpenShellEdgesUsedAtMostTwiceSparse`
- 07 same file `Check_EdgeUsesHaveOppositeOrientation(m)` => `m.Check_EdgeUsesHaveOppositeOrientationSparse`
- 07 same file `Check_SeamUsesRunOpposite(m)` => `m.Check_SeamUsesRunOppositeSparse`
- 07 same file `Check_VertexLinkIsOneCycle(m)` => `m.Check_VertexLinkIsOneCycleSparse`
- 07 same file `Check_OpenShellVertexLinkIsCycleOrPath(m)` => `m.Check_OpenShellVertexLinkIsCycleOrPathSparse`
- 07 same file `Check_VertexLoopVertexIsIsolated(m)` => `m.Check_VertexLoopVertexIsIsolatedSparse`
- 02 `topology.library.plato` `LinkComponentCount(m, s, v)` body => `m.LinkComponentCountOf(m.CornersAtVertex(s, v))`,
  then move `LinkComponentCountOf` next to it (layer 02), so the union over corners is written once.
- After wiring, `CheckShellEdges`, `CheckShellVertices` and `CheckFaceEdges` (07
  `validation-checks-common.library.plato`) have no caller but `SparseGridsLaws.DenseTopologyChecks`;
  keep them as the reference. Rename the laws without `Perf_` (`Law_UncitedCellsHold`,
  `Law_SparseChecksAgree`, `Law_SparseChecksAgreeOnOddModels`); they compare against the dense
  forms written out in the laws file, so they still test something after the wiring.

## Contract requests

- none

## Findings

- Deviation from the dispatch: the checks read `KeyedSiteRows` (sorted per shell or face), not
  V4's `EdgeUseTable` and `CornersByVertex`. V4's tables hold one row per model edge or vertex,
  so building one per shell costs O(C_s + E) or O(C_s + V), and walking its rows another O(E):
  O(C + S E) per check over a model, and O(C + F E) for the face grid of
  `Check_SeamUsesRunOpposite` if a face table were built the same way. For a model of many small
  shells that is the dense grid's cell count again. Sorting each shell's or face's sites by key
  is O(C log C) in all, the plan's target, with no term in E or V. V4's tables stay the right
  shape for one shell queried by every edge (its measures). The per-cell results are the same
  (rows equal `CoedgeSitesOfEdge`, `CornersAtVertex`, as the agreement laws show).
- `CountsAsEdge` (02) evaluates `IsEveryIndexInRange` on every call, a whole-model scan per
  edge cell; the sparse checks bind it once (`CountsAsEdgeGiven`). Other callers of
  `CountsAsEdge` inside loops (`UsesEveryEdgeTwiceIndexed`, `FreeEdgeCountIndexed`,
  `IndexedBoundaryCycleCountIndexed`) still pay O(model) per edge: a later chunk can pass the
  guard in.
- `Law_VertexLoopVertexIsIsolated` can only fail at a vertex some coedge of the shell touches,
  so its sparse cells are the touched vertices (a site sits in the rows of both ends of its
  edge), checked against the shell's sorted vertex-loop vertices by binary search; shells with
  no vertex loop are skipped whole.
- The counted work excludes the stable sort's comparisons (stdlib `SortedIndices`, O(k log k)),
  so `Insertions(2)` bounds placements and cells, not the sort.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, ticket, plan rows, V4 track and tables, layer 2 laws and helpers, layer 7 checks) | 15 min | |
| Writing the four files | 20 min | |
| Law runs, warm server | 4 min | 5 runs (one probe file, removed) |
| Compiled run | 1 min | 1 run, 38.8 s |
| TRACK.md, ticket, commit | 8 min | |

## Lessons

- The warm server's filter takes a library block as `BrepCheckingLaws.` (with the dot); the
  bare name matched nothing and reported "0 laws", which looks like a parse failure.
