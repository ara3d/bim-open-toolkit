# perf-shell-tables: the uses of every edge and the corners at every vertex built once per shell

Ticket: TKT-372
Status: merged: V4 (2026-10-21, into 02-topology/topology-shell-tables.{types,library}.plato and 08-pipeline/pipeline-shell-tables.laws.plato)

## Files

- `shell-tables.types.plato` (layer 02): `CoedgeSiteRows` (compressed rows: `Offsets`, `Sites`;
  row k is the sites with key k in the given order), `EdgeUseTable { Uses: CoedgeSiteRows }`
  (one row per model edge), `VertexCornerTable { Corners: CoedgeSiteRows }` (one row per model
  vertex). The stdlib already has a `CornerTable` (geometry `topology.types.plato`), hence the name.
- `shell-tables.library.plato` (library `BrepShellTables`, layer 02):
  - grouping: `CoedgeSiteRowsCounted(rowCount, keys, sites): Counted<CoedgeSiteRows>` (stable
    counting sort, keys outside `[0, rowCount)` dropped), `HasRow(r, k)`, `RowSize(r, k)`,
    `RowSites(r, k)`.
  - edge uses: `EdgeUseTableCounted(m, s): Counted<EdgeUseTable>`, `EdgeUseTable(m, s)`,
    `UseCountIn(t, e)` (= `UseCount(m, s, e)`), `UsesOfEdgeIn(t, e)` (= `CoedgeSitesOfEdge(m, s, e)`,
    shell order), `EdgesOfShellByUse(t)` (= `EdgesOfShell(m, s)`).
  - vertices and corners: `VerticesOfShellByMark(m, s, t)` (= `VerticesOfShell(m, s)`),
    `CornersByVertex(m, s): VertexCornerTable`, `CornersAtVertexIn(t, v)` (= `CornersAtVertex(m, s, v)`,
    shell order).
  - measures, each its namesake with `t = m.EdgeUseTable(s)`: `UsesEveryEdgeTwiceIndexed(m, t)`,
    `FreeEdgeCountIndexed(m, t)`, `HasCoherentOrientationIndexed(m, t)`,
    `IndexedBoundaryCycleCountIndexed(m, t)`, `ReducedCountsIndexed(m, s, t)`; helper
    `DegenerateEdgeRoots(m, degenerate)`.
- `shell-tables.laws.plato` (library `ShellTablesLaws`, layer 08: layer 7 witnesses and E1's
  `TablesDigonBox`, `TablesStrayBox`): the count witness and four `Law_Perf_*`.

Signature changes against the dispatch: `EdgesOfShellByUse(t)` takes the table alone (the
shell is in the table; an `s` parameter would be unused), and `VerticesOfShellByMark(m, s, t)`
takes the table so it marks the ends of the table's edges instead of rebuilding the sites.

For chunk V5: build `m.EdgeUseTable(s)` and `m.CornersByVertex(s)` once per shell; read
`UseCountIn`, `UsesOfEdgeIn`, `EdgesOfShellByUse`, `CornersAtVertexIn`; rows are in shell order,
so a check that iterates rows in index order visits cited (edge, site) and (vertex, corner)
pairs in the grid's order. Both readers return empty for an index out of range, where
`UseCount` and `CornersAtVertex` would count coedges naming that same out-of-range index; the
layer 2 laws guard every such call with `IsEdgeInRange`.

## Done

- V4, (this commit), about 0.8 h against 2 h expected. Types added: `CoedgeSiteRows`,
  `EdgeUseTable`, `VertexCornerTable` (the stdlib's `JaggedArray<CoedgeSite>` would do, but the
  C# writer emits no member for a function whose receiver is a generic instance, as M2 and E1
  found). E1's counting sort is inline in `EdgeFaceTableCounted`, so it could not be called;
  `CoedgeSiteRowsCounted` is the same sort factored out (see Findings).
  - New laws, warm interpreter (cpu64, budget 20): `ShellTablesLaws` and `Law_WorkIsWithinSlope`,
    5 of 5 pass (`Law_WorkIsWithinSlope` 13 cases, mine among them).
    - `Law_Perf_ShellTablesAgree` (14 cases, every `Witness_` model, every shell): per edge in
      range, `UseCountIn` = `UseCount` and `UsesOfEdgeIn` = `CoedgeSitesOfEdge` site for site;
      per vertex in range, `CornersAtVertexIn` = `CornersAtVertex`; `EdgesOfShellByUse` =
      `EdgesOfShell`, `VerticesOfShellByMark` = `VerticesOfShell`; `UsesEveryEdgeTwiceIndexed`,
      `FreeEdgeCountIndexed` equal their namesakes; and, where `IsEveryIndexInRange`,
      `ReducedCountsIndexed`, `IndexedBoundaryCycleCountIndexed`, `HasCoherentOrientationIndexed`.
    - `Law_Perf_ShellTablesAgreeOnOddModels`: the same on E1's digon box and stray box (a bound
      naming a missing loop, a coedge naming edge 99, edge 4 cited twice by one face); edge 4
      has 3 uses, edge 99 none.
    - `Law_Perf_VertexLoopsAreMarked`: on the sphere, the marked vertices are the reference's
      and include both pole vertex loops.
    - `Law_Perf_ShellTablesWitnessSizes`: the witness sizes are shell 0's coedge counts.
  - Compiled (pinned CLI e37c032f, csharp, cpu64, `--budget=2`, filter `ShellTablesLaws,`
    `Law_WorkIsWithinSlope` and the 14 laws below): 19 laws, 19 pass, total 38.1 s, laws 1.1 s
    summed; slowest of this chunk `Law_Perf_ShellTablesAgree` 0.13 s over 14 cases;
    `Law_WorkIsWithinSlope` 0.39 s over all 13 claims.
  - Count witness `Witness_EdgeUseTableWork`: Insertions are coedge visits, one per site read
    for its edge plus two per site in the counting sort. Slope `Insertions(3)`, sizes 24 (unit
    box, shell 0's coedges) and 48 (block with a through hole). Measured 72 and 144 (probed),
    exactly the allowance. The reference rebuilds the shell's sites per model edge for
    `EdgesOfShell`: 12 x 24 = 288 on the box alone, above 72.
  - Verdict preservation, warm interpreter and compiled, cpu64: `BrepTopologyLaws`
    `Law_EveryEdgeUsedTwiceInClosedShell`, `Law_OpenShellEdgesUsedAtMostTwice`,
    `Law_EdgeUsesHaveOppositeOrientation`, `Law_DeclaredClosedIsClosed`,
    `Law_EulerPoincareEvenAndBounded`, `Law_OpenShellEulerEvenAndBounded`,
    `Law_ShellIsOrientable`, `Law_ReversingEveryFaceKeepsCoherence`, `Law_VertexLinkIsOneCycle`,
    `Law_OpenShellVertexLinkIsCycleOrPath`, `Law_VertexLoopVertexIsIsolated` (25 cases each),
    `BrepCheckingProofsKernelLaws.Law_ClosedShellIffEdgesUsedTwice`, `Law_ClosedShellRecordsCounts`
    (196 cases each), `BrepCheckingLaws.Law_ReducedEulerMatchesOracle`: 14 pass, as in
    `reviews/verdicts-cpu64.tsv`; 0 differ. They run the unwired library; the agreement laws
    carry the claim to the wired one. Results are exact (integers and sites), no floating point.

## Merge instructions

- Move `shell-tables.types.plato` and `shell-tables.library.plato` to `02-topology/` (as
  `topology-shell-tables.{types,library}.plato`), `shell-tables.laws.plato` to `08-pipeline/`
  (as `pipeline-shell-tables.laws.plato`).
- 02 `topology.library.plato` `EdgesOfShell(m, s)` => `m.EdgeUseTable(s).EdgesOfShellByUse`
- 02 `topology.library.plato` `VerticesOfShell(m, s)` => `m.VerticesOfShellByMark(s, m.EdgeUseTable(s))`
- 02 `topology.library.plato` `ReducedCounts(m, s)` => `m.ReducedCountsIndexed(s, m.EdgeUseTable(s))`
- 02 `topology.library.plato` `FreeEdgeCount(m, s)` => `m.FreeEdgeCountIndexed(m.EdgeUseTable(s))`
- 02 `topology.library.plato` `IndexedBoundaryCycleCount(m, s)` => `m.IndexedBoundaryCycleCountIndexed(m.EdgeUseTable(s))`
- 02 `topology.library.plato` `HasCoherentOrientation(m, s)` => `m.HasCoherentOrientationIndexed(m.EdgeUseTable(s))`
- 02 `topology-proofs.library.plato` `UsesEveryEdgeTwice(m, s)` => `m.UsesEveryEdgeTwiceIndexed(m.EdgeUseTable(s))`
- `DegenerateEdgeCount` and `RawCounts` need no edit: they become O(C + E + V) through the
  wired `EdgesOfShell` and `VerticesOfShell`.
- Leave `UseCount`, `CoedgeSitesOfEdge` and `CornersAtVertex` as they are: each is O(C_s) per
  call already, and a table costs O(C_s + E) to build, so wiring a single query to it would be
  slower. Callers that loop over edges or vertices take the table (V5).
- After wiring, `Law_Perf_ShellTablesAgree` and `Law_Perf_ShellTablesAgreeOnOddModels` compare
  `EdgesOfShellByUse`, `VerticesOfShellByMark` and the five measures with themselves; the row
  checks against `UseCount`, `CoedgeSitesOfEdge` and `CornersAtVertex` still test something.
  Keep both under non-Perf names (for example `Law_ShellTablesAgree`), and
  `Law_Perf_VertexLoopsAreMarked` as `Law_VertexLoopsAreMarked`.

## Contract requests

- none

## Findings

- `OrientationFlips` (02 line 1367) still calls `FaceParityLink`, which calls
  `CoedgeSitesOfEdge` per shell edge, O(E C_s), and `PositionOf` per link, O(F_s); its BFS scans
  every link per face, O(F L). Not in this row: V8's `OrientationFlipsByAdjacency` covers it,
  and can read `UsesOfEdgeIn` for its links.
- `IndexedBoundaryCycleCountIndexed` keeps the reference's all-pairs join over free edges,
  O(B^2) for B free edges, so the result stays identical by construction; a union by vertex
  class would make it O(B). Closed shells have B = 0.
- `LinkComponentCount` and `CornersAroundVertex` are O(k^2) in the corners k at one vertex; with
  `CornersAtVertexIn` the per-vertex cost drops from O(C_s) to O(k^2), small for real vertices.
- E1's `EdgeFaceTableCounted` inlines the same counting sort as `CoedgeSiteRowsCounted`. A
  later sweep can factor one integer-keyed sort (`keys`, `rowCount` to `Offsets` plus a
  permutation) and use it in both; not done here, since E1's file is outside this fence.
- The warm server and the pinned CLI twice returned "0 laws" or an unresolved
  `PositionOfItem` while the supervisor was merging F3 into the library; a retry a minute later
  passed. Not a defect of this chunk.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan rows, staging README, E1 track and files, layer 2 callers and laws) | 12 min | |
| Writing the three files | 12 min | |
| Law runs, warm server | 4 min | 4 runs and 1 probe run |
| Waiting on the library mid-merge | 4 min | 2 empty runs, 1 CLI parse run |
| Compiled run | 1 min | 1 run, 38.1 s |
| TRACK.md, ticket, commit | 6 min | |

## Lessons

- A type name can collide with the stdlib (`CornerTable` in geometry's `topology.types.plato`):
  the warm server reports it only as "0 laws"; the pinned CLI without `--backend` names it.
- When the warm server answers "0 laws" without a file of mine having changed, check
  `git status sandbox/step-brep-mesh` for a merge in progress before hunting a parse error.
