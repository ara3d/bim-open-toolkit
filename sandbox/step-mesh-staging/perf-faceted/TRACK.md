# perf-faceted: poly-loop points identified on a tolerance grid, implicit edges counted once per shell

Ticket: TKT-377
Status: ready: V9

## Files

- `faceted.types.plato` (layer 02): `ShellPolyEdges { PointRoots; SortedUses }`, one shell's
  poly-loop point roots and its implicit edge uses sorted, built once per shell.
- `faceted.library.plato` (library `BrepFacetedShells`, layer 02):
  - grid: `IsFinitePoint(p)`, `CoincidenceRootsByGrid(m, points)` (= `CoincidenceRoots`),
    `CoincidenceRootsByGridCounted(m, points): Counted<Array<Integer>>`,
    `GriddedCoincidenceRootsCounted(m, points, cells, order)`.
  - per shell: `PolyBoundPoints(m, poly)`, `ShellPolyPoints(m, s)`, `PolyPointOffsets(m, poly)`
    (prefix array, entry k = `PolyPointOffset(m, poly, k)`), `ImplicitEdgeUsesByOffsets(m, poly,
    roots)` (= `ImplicitEdgeUses`), `ShellPolyEdgesOf(m, s): ShellPolyEdges`.
  - over the sorted uses: `UseRunEnd(p, i)`, `ImplicitEdgeCountSorted(p)`,
    `ImplicitFreeEdgeKeysSorted(p)`, `ImplicitBoundaryCycleCountSorted(p)`,
    `IsDefectiveUseCount(total, forward, closed)`, `PolyEdgeUseDefectsSorted(p, closed)`.
  - shell measures: `ReducedCountsPolyIndexed(m, s, t, p)` (ReducedCountsIndexed's successor),
    `BoundaryCycleCountPoly(m, t, p)`, `ShellEulerPlusBoundaryCycles(m, s)` (the value
    `Law_OpenShellEulerEvenAndBounded` tests, the edge-use table and poly edges built once).
  - connectivity: `ShellComponentCountByGrid(m, s)`, `ShellComponentCountByGridCounted(m, s)`
    (V8's `ShellComponentCountByVertexCounted` with the poly branch over the grid).
- `faceted.laws.plato` (library `FacetedLaws`, layer 08): faceted model builders (sheets, cubes,
  jittered, far out, with planted defects), five `Law_Perf_*`, the count witness.

The grid reuses V7's `CoincidenceCell`, `CoincidenceCellSide`, `CoincidenceCellOf`,
`IsExactCoincidenceCell`, `CoincidenceCellAtMost` and `FirstCellAtLeast`, which live in layer 06
(`06-mesh/mesh-coincident-gridded.{types,library}.plato`); see Contract requests.

## Done

- V9, (this commit), about 1.0 h against 2 h expected. Type added: `ShellPolyEdges` (the roots and
  sorted uses travel together to four readers; two loose arrays would let a caller pair roots of
  one shell with uses of another).
  - Pinned CLI, interpreter (cpu64, budget 20), filter `FacetedLaws, Law_WorkIsWithinSlope,
    BrepTopologyLaws, Law_PolyLoopSheetHasOneBoundaryCycle, Law_PolyLoopSheetPassesOpenShellEuler,
    ShellOrientationLaws, ShellTablesLaws`: 57 laws, 57 pass. The chunk's laws
    `Law_PolyLoopEdgesPairUp`, `Law_OpenShellEulerEvenAndBounded`,
    `Law_EulerPoincareEvenAndBounded`, `Law_ShellIsConnected`,
    `BrepWitnessesLaws.Law_PolyLoopSheetHasOneBoundaryCycle` pass, as in
    `reviews/verdicts-cpu64.tsv` (all `pass`).
  - Pinned CLI, compiled (`--backend=csharp --profile=cpu64 --budget=2`), same filter: 57 laws,
    57 pass; laws 1.6 s summed, 1.3 s wall; slowest `Law_WorkIsWithinSlope` 1.09 s over 39
    cases, `Law_Perf_FacetedAgrees` 0.11 s. One degraded body, present without this folder too.
  - `Law_Perf_FacetedAgrees`: on 12 faceted cases (`Witness_BoxWithPolyLoopSheet`,
    `PolyTrianglesBesideBox`, a 3 x 2 quad sheet plain, jittered 0.45 tol, jittered 0.5 tol so
    copies sit exactly tol apart, moved to 1e9 so the pairwise fallback runs, the cube plain and
    jittered, the sheet declared closed, a repeated quad, a flipped sheet face, a flipped cube
    face), every shell: roots, offsets, uses, sorted uses, free keys, edge count, boundary
    cycles, defects, reduced counts, `BoundaryCycleCount`, the open-shell law's value, and the
    component count equal their references.
  - `Law_Perf_FacetedAgreesOnWitnesses`: the same on the ten positive witnesses.
  - `Law_Perf_FacetedCasesAreFaceted`: the cases are not vacuous (24 points in 12 classes,
    17 edges, one boundary cycle, chi + B = 2, the cube's 8 classes and chi = 2, 10 defects on
    the sheet declared closed, defects on the three planted cases, 3 components beside the box).
  - `Law_Perf_CoincidenceRootsByGridAgrees`: generated point arrays with two shifted copies
    (0.6 tol, 1.2 tol: a chain) and scaled by tol (packed into few cells).
  - `Law_Perf_FacetedSheetSizes`: the witness sheets have 64 and 512 points, and the grid's work
    is exactly 196 and 1764.
  - Mutation check: with the grid searching only its own column of cells (x neighbours dropped),
    four of the five `Law_Perf_*` fail; restored.
  - Count witness `Witness_FacetedCoincidenceWork`: `Insertions(27)` per poly-loop point (pair
    tests in the 27 cells around each point), sizes 64 and 512 (quad sheets 4 x 4 and 4 x 32);
    measured 196 and 1764 (3.1 and 3.4 per point); the pairwise reference tests 4096 and 262144.

## Merge instructions

- Move V7's `CoincidenceCell` type and its "Cells" section (`CoincidenceCellSide`,
  `CoincidenceCellOf`, `CoincidenceCellBound`, `IsExactCoincidenceCell`, `CoincidenceCellAtMost`,
  `FirstCellAtLeast`) from 06-mesh to a layer 00 file, unchanged, so layer 02 may call them (see
  Contract requests). Then move this folder's files: `faceted.types.plato` and
  `faceted.library.plato` to 02-topology (`topology-faceted.*`), `faceted.laws.plato` to
  08-pipeline (`pipeline-faceted.laws.plato`).
- `CoincidenceRoots(m, points)` => `m.CoincidenceRootsByGrid(points)` (keep the pairwise body as
  `CoincidenceRootsPairwise` for the fallback and the agreement laws, as V7 kept
  `CoincidentVertexPairsPairwise`; point the fallback in `CoincidenceRootsByGridCounted` and the
  references in `FacetedAgreesOnShell` at it).
- `ShellPolyPointRoots(m, s)` => `m.CoincidenceRootsByGrid(m.ShellPolyPoints(s))`
- `ImplicitEdgeUses(m, poly, pointRoots)` => `m.ImplicitEdgeUsesByOffsets(poly, pointRoots)`
  (keep the old body in the agreement law, or compare against `PolyPointOffset` alone as it does).
- `ReducedCountsIndexed(m, s, t)` => `m.ReducedCountsPolyIndexed(s, t, m.ShellPolyEdgesOf(s))`
- `ImplicitBoundaryCycleCount(m, s)` => `m.ShellPolyEdgesOf(s).ImplicitBoundaryCycleCountSorted`
- `ImplicitFreeEdgeKeys(m, s)` => `m.ShellPolyEdgesOf(s).ImplicitFreeEdgeKeysSorted` (ascending
  instead of use order; its two callers count the keys or close classes over them)
- `PolyEdgeUseDefects(m, s)` => `m.ShellPolyEdgesOf(s).PolyEdgeUseDefectsSorted(m.Shells[s].DeclaredClosed)`
- `Law_OpenShellEulerEvenAndBounded`: `(m.ShellEulerPoincare(s) + m.BoundaryCycleCount(s))` =>
  `m.ShellEulerPlusBoundaryCycles(s)` (roots once per law case instead of three times).
- `ShellComponentCountByVertexCounted(m, s)` => `m.ShellComponentCountByGridCounted(s)`; then
  delete `PolyPointsTouch` (unused).
- Delete once unused: `IsDefectiveImplicitEdge`, `PolyPointOffset` (if the agreement law no
  longer reads it).

## Contract requests

- Move V7's `CoincidenceCell` and its cell helpers from layer 06 to layer 00 (a move, no
  signature change). They depend only on `Point3D`, `Number` and `LengthTolerance`. The staged
  code calls them across the layer order because the staging build compiles everything as one
  program; copying them into layer 02 would have duplicated the cell rule V7 worked out (side
  2 tol, the 1e14 bound).

## Findings

- Integer overflow, before and after this chunk: an implicit edge use is keyed
  `(a * N + b) * 2 + dir` with N the shell's poly-point count, and `Integer` is 32-bit
  (PLATO-PRIMER.md line 877), so keys overflow once N passes about 32768 points in one shell,
  about 8200 quads: a faceted shell of that size gets wrong edge counts and defects. The keys are
  kept here because the results must stay identical. A fix keys an edge by a pair or sorts
  (a, b) pairs directly; worth a ticket.
- Of the three O(P^2) passes, the open-shell law ran CoincidenceRoots three times per case
  (ReducedCounts, ImplicitBoundaryCycleCount twice through ImplicitFreeEdgeKeys) and built the
  edge-use table twice; `ShellEulerPlusBoundaryCycles` builds each once.
- The grid's cell side is 2 tol, as V7 found; a pair exactly tol apart across a cell boundary is
  in faceted case 4.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan rows, topology, V4, V7, V8 code) | 15 min | |
| Writing (types, library, laws) | 25 min | |
| Law runs, interpreter | 2 min | 3 runs (one mutation run) |
| Compiled run | 1 min | 1 run (45 s), plus 1 baseline run for the degraded body |
| Waiting | 0 | |
| TRACK.md, ticket, commit | 10 min | |

## Lessons

- The warm server was skipped on the supervisor's advice; the pinned CLI interpreter run takes
  20 s and names a failing case, which made it the faster loop here.
