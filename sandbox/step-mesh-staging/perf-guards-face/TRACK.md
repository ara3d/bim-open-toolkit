# perf-guards-face: the geometry arena checked once per model, not once per bound of every face

Ticket: TKT-359
Status: ready: G2

## Done
- G2, (this commit), about 0.6 h against 1 h expected: `IsDiscretizedBoundIn`, `IsDiscretizedFaceIn` (face-meshing-guards.library.plato, layer 05); `FaceOutcomeInRange`, `FaceOutcomes`, `FaceOutcomesCounted`, `InitialStateInRange`, `StepInRange` (pipeline-guards.library.plato, layer 08). Type added: `StatePair` (a state built by the library form and by the staged form), so the agreement law's meshed states are Witness_* values built once per sweep. Laws: `PipelineGuardsLaws` 7 `Law_Perf_*` plus `Law_WorkIsWithinSlope` over `Witness_FaceOutcomesWork`, all pass interpreted and compiled. Verdicts kept against verdicts-cpu64.tsv: `FaceMeshingLaws` 46 of 46 pass; `StepToMeshLaws.Law_OutcomesAreCurrent` pass (25 cases, budget 120); `BsplinePipelineLaws.Law_StateLaws` pass (196 cases, budget 400; at budget 20 and 120 it errors on time in case k = 0, inside the library's own B-spline MeshFace, before and after this chunk, since nothing is wired yet).

## Merge instructions
- 05 face-meshing.library.plato: move `IsDiscretizedBoundIn` and `IsDiscretizedFaceIn` into "Preconditions"; then `IsDiscretizedBound(m, b, d) => m.IsDiscretizedBoundIn(b, d, m.Geometry.IsEveryIndexInRange)`
- 05 face-meshing.library.plato: `IsDiscretizedFace(m, f, d) => m.IsDiscretizedFaceIn(f, d, m.Geometry.IsEveryIndexInRange)` (one scan per face instead of one per bound)
- 08 pipeline.library.plato: move `FaceOutcomeInRange`, `FaceOutcomes`, `FaceOutcomesCounted` into "Faces"; then `FaceOutcome(m, f, d, o, chosen) => m.FaceOutcomeInRange(f, d, o, chosen, m.Geometry.IsEveryIndexInRange)` (keeps the spec in pipeline.spec.plato)
- 08 pipeline.library.plato InitialState line 256: `var outcomes = m.FaceOutcomes(d, o, chosen);`
- 08 pipeline.library.plato Step lines 273-274: add `var arenaOk = m.Geometry.IsEveryIndexInRange;` and call `m.FaceOutcomeInRange(BrepFaceIndex(k), d, o, chosen, arenaOk)`; then delete `InitialStateInRange` and `StepInRange`
- Laws: move `Witness_FaceOutcomesWork`, `FaceOutcomesWork`, `GuardBoxWithFaces`, `Law_Perf_FaceOutcomesScanArenaOnce` into 08 pipeline laws (rename the law `Law_FaceOutcomesScanArenaOnce`). After wiring, the `Law_Perf_*Agrees` laws, the three `StatePair` witnesses and the `StatePair` type compare a function with itself: delete them.

## Contract requests
- none: every new function is an addition; the old signatures stay and delegate.

## Requests to other tracks
- none.

## Findings
- The count witness's slope, Flips(1) per face at 6 and 12 faces, does not tell the old form from the new on one-bound faces: the old form scans once per bound, which is also one per face on a box. So the exact claim, one scan per pass, is its own law, `Law_Perf_FaceOutcomesScanArenaOnce`, over all 14 model witnesses (as W0 pairs `Law_RaisedToCountCountsItsRaises` with its witness).
- Layer 07 has the same shape per element, not in the plan's ranked table: `Check_SurfaceWithinSurfaceChordalOfElement` (validation-checks-face-meshing.library.plato line 140), `NormalTurnExcess` (398) and `DeviationExcess` (409) evaluate `IsDiscretizedFace(fm.Face, d)`, an arena scan per bound, once per element of the face mesh: O(elements x arena). After this chunk's wiring it is one scan per element; hoisting the face guard out of the per-element lambda makes it one per face. `FaceLoopAt` (371) scans once per bound, which is fine.
- Results are bit-identical: the new forms return the same Booleans and call the same MeshFace; no floating-point result changes.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, library, callers, W0) | 12 min | |
| Writing | 8 min | |
| Staged laws, interpreted | 1 min | 1 run, 7 laws pass first time (compile 5 s, laws 1 s) |
| Kept laws, interpreted | 4 min | FaceMeshingLaws + 2 pipeline laws at budget 20 (40 s), pipeline laws at 120 (2.5 min), Law_StateLaws at 400 (cached, under 1 s) |
| Compiled run | 36 s | 1 run: `dotnet C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll run stdlib/foundation stdlib/geometry stdlib/graphics C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-mesh-staging/perf-guards-face --recursive --exclude=brep.types.plato --exclude=brep.library.plato --exclude=brep.concepts.plato --laws --backend=csharp --profile=cpu64 --budget=2 --filter=PipelineGuardsLaws,Law_WorkIsWithinSlope`: 7 laws, 7 pass; slowest Law_Perf_WitnessFacesGuardAgrees 0.27 s over 14 cases; 19 witnesses 0.2 s |
| Waiting | 3 min | the two B-spline pipeline laws |

## Lessons
- `Law_StateLaws` and `Law_OutcomesAreCurrent` cost minutes interpreted for reasons outside this chunk (B-spline refinement inside MeshFace); a builder whose fence does not wire anything can only show them unchanged, so run them once, in the background, at the budget the baseline used.
