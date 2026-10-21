# perf-coincident: coincident vertex pairs on a grid, boundary pieces by union-find

Ticket: TKT-375
Status: merged: V7 (2026-10-21, into 06-mesh/mesh-coincident-gridded.{types,library,laws}.plato and mesh-pieces-union-find.library.plato)

## Done
- V7, (this commit), about 1.2 h against 2 h expected. Added `CoincidentVertexPairsGridded`, `CoincidentVertexPairsGriddedCounted`, `GriddedPairsCounted`, `FirstCellAtLeast` and the cell helpers (`mesh-coincident-gridded.library.plato`); `PieceCountByUnionFind`, `PieceCountByUnionFindCounted` (`mesh-pieces-union-find.library.plato`); the references `CoincidentVertexPairsPairwise` and `PieceCountByLabels`, copies of the bodies the wiring replaces. Type added: `CoincidenceCell` (X, Y, Z whole Numbers), a grid key that cannot overflow a 32-bit Integer the way a packed key would. Laws: 8 `Law_Perf_*` agreement laws and two `Witness_*Work` claims (`mesh-coincident-gridded.laws.plato`).
- Interpreter (pinned CLI, cpu64, budget 20): 66 laws, 66 pass: ModelMeshCoincidentGriddedLaws (8), Law_WorkIsWithinSlope (30 cases, both new witnesses among them), ModelMeshMeasuresLaws (10, Law_ReportedPairIsCoincident and Law_CoincidentPairIsReported pass as in verdicts-cpu64.tsv), ModelMeshTopologyLaws (23, the genus laws pass as in verdicts-cpu64.tsv), ComponentChecksGivenLaws (3), StepToMeshMeshedWitnessesLaws (22).
- Compiled: `dotnet C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll run ... perf-coincident --recursive ... --laws --backend=csharp --profile=cpu64 --budget=2 --filter=ModelMeshCoincidentGriddedLaws,Law_WorkIsWithinSlope,ModelMeshMeasuresLaws,ModelMeshTopologyLaws,ComponentChecksGivenLaws,StepToMeshMeshedWitnessesLaws`: 66 laws: 66 pass; 49 witnesses 26.1 s; laws 2.0 s summed; slowest new law 0.05 s (planted cloud, 14 cases); Law_WorkIsWithinSlope 0.42 s over 30 cases.
- Count witnesses: `Witness_CoincidentVertexPairsGriddedWork`, Insertions(27) per vertex, clouds of 256 and 2048 R3 points in the unit cube at tolerance 0.025: measured about 6.3 visits per vertex at 2048 (12,289 to 13,312). `Witness_PieceCountByUnionFindWork`, Insertions(4) per edge, four interleaved cycles of 32 and 256 edges: measured 53 to 56 steps at 32 and 481 to 512 at 256.

## Merge instructions
- `06-mesh/mesh-measures.library.plato` `CoincidentVertexPairs(mesh, comps, tol)`: replace the body with `=> mesh.CoincidentVertexPairsGriddedCounted(comps, tol).Value;` (its pairwise body is kept as `CoincidentVertexPairsPairwise` in this folder's library file, which the gridded form falls back to; do not point the fallback back at `CoincidentVertexPairs`, which would recurse).
- `06-mesh/mesh-topology.library.plato` `PieceCount(edges)`: replace the body with `=> edges.PieceCountByUnionFindCounted.Value;` (the label-propagation body is kept as `PieceCountByLabels`; `PieceLabels`, `PieceLabelRound`, `DistinctEnds` and `FirstPositionOf` stay, used only by it).
- Move the three `.plato` files into `06-mesh/` (the laws file reads `MeshedWitness` from 08-pipeline, so it may instead go beside `08-pipeline/pipeline-meshed-witness.laws.plato`, or stay in a later-sorting folder), and rename the `Law_Perf_*` laws as the merge convention says. After the wiring, the agreement laws compare against the kept references, so they stay meaningful.
- Laws to run at merge: ModelMeshCoincidentGriddedLaws, Law_WorkIsWithinSlope, ModelMeshMeasuresLaws, ModelMeshTopologyLaws, ComponentChecksGivenLaws, StepToMeshMeshedWitnessesLaws, ModelMeshIncidenceLaws (IsPinchedVertexIndexed calls PieceCount on links).

## Contract requests
- none.

## Requests to other tracks
- none.

## Findings
- The grid's cell side is 2 tol, not the plan's tol. With side tol, a pair exactly tol apart along one axis (which the pairwise form reports, Distance <= tol) can round into cells two apart and be missed. With side 2 tol the exact quotients differ by at most about 0.5 and each computed one is within 0.012 of exact while cell coordinates stay below 1e14 (`CoincidenceCellBound`), so neighbouring cells always hold the pair. Beyond the bound, or for a tolerance that is not positive and finite (the generated laws give zero and negative ones), the pairwise form runs and counts V^2. The cost of the wider cell is up to 8 times as many candidates visited in a dense cloud; the order stays O(V log V) plus the visits.
- Output order is identical, not just the set: the pairwise form emits (a, b) with a outer and b inner, so strictly increasing lexicographically; the grid sorts its distinct pairs by `IsLexicographicallyAtMost`. Shown element by element on generated meshes and tolerances, on the three MeshedWitness meshes at five tolerances (non-empty at 1.5), on a planted cloud (non-empty, with a pair across components filtered and a pair exactly tol apart across a cell boundary), and far from the origin (fallback).
- A vertex with a non-finite coordinate is left out of the grid: its distance to any vertex is NaN or infinite, so the pairwise form never reports it either.
- Neither count includes the O(n log n) sorts or, for the grid, the 9 binary searches per vertex: the count is of candidates visited and of union-find links, as the dispatch asked.
- The warm server (`plato_laws.py`) answered "0 laws, 0 type errors" for this folder after a correct parse on the pinned CLI, twice; once it did run (with the FractionOf collision below) and once it did not. All verdicts above come from the pinned CLI.
- `FractionOf` is already a library function (00-foundation, returning `Fraction`); a second one returning Number made every call ambiguous (CHK203) in the library itself. Renamed to `CloudFraction`.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, functions, callers, primer) | 15 min | |
| Writing (two libraries, types, laws) | 25 min | |
| Law runs (interpreter, warm server and CLI) | 12 min | 7 |
| Compiled runs | 4 min | 3 |
| Debugging the planted cloud (odd n put every planted pair across components) and bracketing the counts | 10 min | 3 |
| Waiting | 0 | |

## Lessons
- A family built from a vertex count and a parity rule needs its pairs' parities checked at every count the runner gives; an odd count put every planted pair in two components and the non-vacuity check caught it only on the compiled run's case order.
