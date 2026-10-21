# perf-lift: Lift by source key, ClassRoots with path halving (chunk F3)

Ticket: TKT-362
Status: ready: F3

## Done
- F3, this commit, about 1.3 h against 1.5 h expected. Added `LiftIndexed` and `LiftCounted` (O(N + B log B) for N points, B of them on the boundary, in place of O(N^3) writes and O(N^2) `PositionOfItem` searches), and `ClassRootsLinear` (path halving). Types added: `SourceKey` (the key under which `IdentifiedSources` identifies two sources: what replaces the pair comparison), `LiftBranch` and `LiftCase` (law witnesses: a model's faces triangulated once, and the branches of Lift they reach). Verdicts: the 8 Lift laws, the 2 LiftTable laws and `Law_ReducedEulerMatchesOracle` pass before and after, as in `reviews/verdicts-cpu64.tsv`; the new laws pass:
  - `Law_Perf_LiftIndexedAgrees`: 17 LiftCase witnesses, every field identical, including positions, normals and provenance.
  - `Law_Perf_LiftCaseReachesItsBranches`: 17 cases. Together they reach seam cuts, pole segments, interior points, identified points, dropped triangles and collapsed quads.
  - `Law_Perf_SourceKeyMatchesIdentification`: 196 cases, exhaustive.
  - `Law_Perf_ClassRootsLinearAgrees`: 196 cases, exhaustive.
  - `Law_WorkIsWithinSlope` with `Witness_LiftWork`: 8 claims in the library, all pass.

Compiled (pinned CLI e37c032f, `--backend=csharp --profile=cpu64 --budget=2`), filter `Law_Perf_,Law_WorkIsWithinSlope,Law_LiftKeepsPoints,Law_LocalVertexInRange,Law_LocalVertexSurjective,Law_ProvenanceMatchesSource,Law_LocalVertexFibresAreIdentifications,Law_DroppedElementsArePoleCollapsed,Law_CollapsedQuadsBecomeTriangles,Law_SharedPositionIsCopied,Law_LiftTableJoinsNothingElse,Law_LiftTableJoinsSeamPairsAndPoles,Law_ReducedEulerMatchesOracle`: 16 laws, 16 pass, 39 witnesses built in 1.4 s, laws 0.8 s summed. The slowest was `Law_Perf_LiftIndexedAgrees` at 0.6 s over 17 cases.

Count witness `Witness_LiftWork`: slope `Insertions(16).Add(Evaluations(2))`. The family is the unit box's bottom face with a segment floor of n / 4 on every edge, triangulated by `TriangulateRegionCdt` without refinement. It measured 413 insertions and 32 evaluations at n = 32 (limits 512 and 64), and 1917 insertions and 128 evaluations at n = 128 (limits 2048 and 256).

## Merge instructions
- 05 `face-meshing.library.plato` `Lift(m, f, d, t)` => `m.LiftCounted(f, d, t).Value`. Move `SourceKey` into `uv-regions.types.plato` beside `UvPointSource`, and `SideNumber`, `SourceKeyOf`, `IsKeyed`, `KeyAtMost`, `SameKey` beside `IdentifiedSources` in `uv-regions.library.plato`. Move `IsCopiedSource`, `MergePasses` and `LiftCounted` beside `Lift`.
- 05 `PositionOfItem` (face-meshing.library.plato line 355): `Lift` is its only caller, so delete it.
- 00 `foundation.library.plato` `ClassRoots(n, first, second)`: take the body of `ClassRootsLinear`, then delete `class-roots-linear.library.plato`.
- Laws. Keep `Law_Perf_SourceKeyMatchesIdentification` in 05 as `Law_SourceKeyMatchesIdentification`. Move `Witness_LiftWork` and `LiftWork` to a 05 work-laws file. Once the bodies are wired, `Law_Perf_LiftIndexedAgrees` and `Law_Perf_ClassRootsLinearAgrees` compare a function with itself: drop them, or keep `LiftCase` and turn the first into the Lift laws over shared witnesses (see Findings).

## Contract requests
- none

## Requests to other tracks
- L4 (TriangulatedWitness): `LiftCase` is a per-model stand-in for its shared triangulated witness. Once L4 merges, the Lift laws can read L4's witnesses, or `LiftCase` can become them. Neither blocks.

## Findings
- The original Lift laws (`Law_LiftKeepsPoints`, `Law_LocalVertex*`, `Law_ProvenanceMatchesSource`, and others) each run 25 generated cases in 0.00 s compiled. Their `EdgeDiscretizations` and criteria are generated at random, so `CanMeshFace` / `CanTriangulateFace` is almost certainly false and the laws hold vacuously. Their pass verdicts say little about Lift. `Law_Perf_LiftIndexedAgrees` over `LiftCase` is the real check here, and L4's shared witnesses are the fix.
- `DiscretizationCriteria.MinSegments` does not raise a straight edge's segment count: with MinSegments 8 or 32, the unit box's bottom face still had 4 boundary points. A per-edge `SegmentFloors` does raise it. Either the field is documented wrong, or it is ignored for lines. Worth a look by the discretization owner.
- The slope is linear but the sort is n log n. Insertions(16) covers it up to 128 keyed points (1917 of 2048). A third size of 512 would need about Insertions(18). The plan's own row states the count as `<= c n log n`.
- A whole-model `FaceTriangulation` of the torus under the witness options takes 122 s compiled, and of the sphere 19 s. A run with coarse criteria (chordal 0.1, 30 degrees, no length limit) did not finish in 10 minutes and was stopped. So the LiftCase witnesses triangulate the boundary only (`TriangulateRegionCdt`), except the quad grids and the refined box and cylinder.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, Lift, IdentifiedSources, ClassRoots, LawRunner) | 15 min | |
| Writing (5 plato files, TRACK) | 20 min | |
| Interpreter law runs | 5 min | 8 runs. The meshing witnesses do not finish in the interpreter (2 of 13 cases) |
| Compiled runs | 20 min | 8 runs: one of 6 min (dense witnesses), one runaway stopped at 10 min, six of about 35 s |
| Waiting | 5 min | |

## Lessons
- Build a LiftCase-style witness from the boundary triangulation first. Whole-model refinement under the witness options costs minutes compiled.
- Probe a work witness's size (point count) before trusting a pass. The first version passed while measuring a 4-point face at both sizes.
