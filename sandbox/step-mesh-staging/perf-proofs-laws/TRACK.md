# perf-proofs-laws: the proofs laws and five layer 4 laws read tables and meshes built once per sweep

Ticket: TKT-392
Status: merged: L3 (2026-10-21, into 04-discretization/discretization-witness.{types,library}.plato and 08-pipeline/pipeline-discretization-witness.laws.plato, pipeline-discretized-witness.{types,library}.plato, pipeline-proofs-{discretization,mesh}-witness.laws.plato; the originals of the same names deleted)

## Done
- L3, (this commit), about 1.3 h against 2 h expected. Types added:
  - `DiscretizedWitness { Name; Model; Criteria; Floors; Discretizations }` (`discretization-witness.types.plato`, layer 4: every field is a layer 4 type, and no law over it needs a layer 8 model; its values are built in layer 8 because they use layer 7's models and layer 8's witness criteria).
  - `FaceOutcomesWitness { Discretized; Outcomes }` (`pipeline-discretized-witness.types.plato`, layer 8): a discretized witness's faces each meshed once by `MeshFace` under the witness options' face criteria. It is a type of its own because a `MeshOutcome`, and so a `MeshedWitness`, does not expose the per-face outcomes the face-outcome laws read.
- Functions: `DiscretizedWitnessOf`, `HalvingRequest`, `RefinementRequestsOf` (block `EdgeDiscretizingWitnesses`, layer 4); `CatalogDiscretized`, `FaceOutcomesOf`, and 17 witnesses (block `StepToMeshDiscretizedWitnesses`, layer 8). The witnesses: the 13 models of `CatalogProofModelAt` under `CatalogEdgeCriteria` with no floors (the catalog family); the unit box and the unit cylinder under a 0.3 length limit with floors 5, 0, 7; the unit box under criteria that are not well formed (every entry Undiscretized); and the unit box's six face outcomes.
- Laws, 28, all `Law_Perf_*`:
  - `EdgeDiscretizingWitnessLaws` (layer 4), over `DiscretizedWitness`: UndiscretizedExactlyWhenUnusable, DiscretizationsIndexedByEdge, ParametersStrictlyIncreasing, SeedsAreSampled, RefineNeverCoarsensOnWitnesses, plus two new ones, DiscretizedWitnessIsDiscretizedEntries (the table is `DiscretizedEntry`'s, entry by entry, bit for bit) and DiscretizedWitnessIsRefinable (the table meets `IsRefinable` under its own requests, so the Refine law is not vacuous).
  - `StepToMeshProofsDiscretizationWitnessLaws` (layer 8), over `DiscretizedWitness`: all 10 laws of `StepToMeshProofsDiscretizationLaws`.
  - `StepToMeshProofsMeshWitnessLaws` (layer 8): the 4 face-outcome laws over `FaceOutcomesWitness` and the 7 model-mesh laws over L1's `MeshedWitness`. The 6 quad laws are unchanged: they mesh nothing.
- Each law quantifies inside its body. The whole-table laws check every knock-out of one entry and the table itself. The one-edge laws check every entry in both directions or both senses. The layer 4 laws check every entry, position and seed. The model-mesh laws check the three literal tetrahedra and the witness's pipeline mesh.
- No count witness: the dispatch said none for this chunk.
- Verdicts. Baseline (reviews/verdicts-cpu64.tsv, interpreted): all 26 originals pass. Originals compiled, budget 2 s (this session, unchanged library): 9 pass and 17 over budget. The 17 are the 8 whole-table and one-edge proofs laws other than DirectedAlong and DiscretizedEntryIsCanonicalReversedIsNot (3.8 to 5.6 s), and the face and mesh laws: FullyMeshedModelIff 7.0 s, MeshedFaceSetIff 4.0 s, CheckedMeshIff 11.7 s, ClosedWitnessMeshesAreChecked 11.8 s, WatertightMeshKeepsMesh 15.2 s, CheckedMeshRecordsCounts 15.2 s, WatertightMeshIffClosed 17.4 s, QualityGradedMeshIffMeasurable 48.9 s, QualityGradedMeshRecordsQualities 76.4 s. The five layer 4 originals pass compiled under 2 s.
- Staged: 28 of 28 pass interpreted (budget 20, laws 5.2 s summed) and compiled (budget 2; see Durations). The slowest compiled law takes 0.07 s. The originals are not rerun after the change: nothing is wired, so their verdicts are the baseline's.

## Merge instructions
- Move `discretization-witness.types.plato` and `discretization-witness.library.plato` to `04-discretization/` as they are. Move `pipeline-discretized-witness.types.plato` and `pipeline-discretized-witness.library.plato` to `08-pipeline/` as they are.
- 04 discretization.laws.plato, block `EdgeDiscretizingLaws`: replace `Law_UndiscretizedExactlyWhenUnusable`, `Law_DiscretizationsIndexedByEdge`, `Law_ParametersStrictlyIncreasing` and `Law_SeedsAreSampled` with the staged `Law_Perf_<X>` bodies renamed `Law_<X>`, so the verdict file's names stay the same. The predicates they call (`UndiscretizedExactlyWhenUnusable`, `DiscretizationsIndexedByEdge`, `ParametersStrictlyIncreasing`, `SeedsAreSampled`) stay. Add `Law_RefineNeverCoarsensOnWitnesses`, `Law_DiscretizedWitnessIsDiscretizedEntries` and `Law_DiscretizedWitnessIsRefinable` to the block. Keep `Law_RefineNeverCoarsens` as it is: Refine's `ensures` (discretization.spec.plato line 217) calls it with its pointwise signature, and it passes under 2 s compiled.
- 08 pipeline-proofs-discretization.laws.plato, block `StepToMeshProofsDiscretizationLaws`: replace each of the 10 laws with the staged `Law_Perf_<X>` renamed `Law_<X>`, and move in the helpers `KnockOuts`, `CompleteIffAllDiscretized`, `PartialIffSomeFailed`, `CanonicalIffCanonical` and `MeetsRecordsWorst`. Delete `CatalogTableAt`, `CatalogEntryAt`, `CatalogSenseOf` and `CatalogMeetsRecords` (`MeetsRecordsWorst` is it with the criteria as a parameter). Keep `CatalogEdgeCriteria` (the witness library uses it), plus `CatalogWithUndiscretized`, `CatalogCompleteKeeps`, `CatalogPartialLists`, `CatalogCanonicalKeeps` and `CatalogDirectedAlong` (the restated laws use them). Delete `CatalogTableOf` once `CatalogBoxOutcome` is gone. The header's second paragraph should say the laws run over `DiscretizedWitness`.
- 08 pipeline-proofs-mesh.laws.plato, block `StepToMeshProofsMeshLaws`: replace the 4 face-outcome laws and the 7 model-mesh laws with the staged `Law_Perf_<X>` renamed `Law_<X>`, and move in `KnockedOutOutcomes`, `OutcomeKnockOuts`, `CatalogMeshesOf`, `CatalogMeshModelOf`, `FullyMeshedIffEveryFaceMeshed`, `CheckedMeshIffMeshChecks` and `QualityRecordsEvery`. Delete `CatalogBoxOutcome`, `CatalogBoxOutcomes`, `CatalogMeshAt` and `CatalogQualityRecords`. Keep `CatalogBox`, `CatalogFullyMeshedKeeps`, `CatalogMeshedFaceSetPairs`, `CatalogWatertightKeeps`, `CatalogCheckedMeshRecords` and the quad section. After this, the file no longer calls `WitnessMesh` (L1's TRACK.md lists it as a caller).
- 04-discretization/README.md: the table row for `discretization-proofs` says its 10 laws "use layer 8's witness criteria". After the merge they run over `DiscretizedWitness`, so they could move to layer 4 (see Findings). The rows for the four replaced laws keep their meaning.

## Contract requests
- none: every type and function is an addition. `Law_RefineNeverCoarsens` keeps its signature because Refine's contract calls it.

## Requests to other tracks
- L4 (TriangulatedWitness): `DiscretizedWitness` exists in layer 4. A triangulated witness can hold one (its `Discretizations`) rather than rediscretizing.
- L7 (09-tooling): nothing here is called from the runner.

## Findings
- The proofs laws need no layer 8 model once the criteria travel in the witness. Only their witness values do (`CatalogEdgeCriteria` is `MeshingOptions.WitnessOptions.Face.Discretization`). `StepToMeshProofsDiscretizationWitnessLaws` could live in layer 4 beside `discretization-proofs.library.plato`; it is staged as a layer 8 replacement so the merge keeps the law names.
- Coverage against the originals:
  - The whole-table laws knock out every entry of every catalog model. The originals knocked out only entries 0 to 12 (the runner's Integers), so models with more than 13 edges (block with hole, hollow box, two boxes) had their later entries untested.
  - The one-edge laws check every entry in both directions; the originals drew 25 random (model, edge, direction) cases.
  - The model-mesh laws check the pipeline meshes of the block with a hole and the hollow box as well as the unit box (L1's three `MeshedWitness`es), each against its own model in `CheckCheckedMesh`. The tetrahedra are still checked against the unit box.
  - The face-outcome laws still cover only the unit box, as before.
  - The layer 4 laws lose the random criteria and floors the runner drew. In exchange they check every entry, position and seed of 16 fixed tables under three criteria (catalog, length-limited with floors, not well formed).
- `Law_RefineNeverCoarsens` drew `d` and `requests` at random, and `IsRefinable` requires one entry per model edge in edge order, which a random array almost never has. So it is most likely vacuous on nearly every case: an inference from the guard, not counted. `Law_Perf_RefineNeverCoarsensOnWitnesses` refines every discretized entry of 16 real tables (half the chordal bound, twice the segments) and holds. `Law_Perf_DiscretizedWitnessIsRefinable` shows its guard is met under well-formed criteria.
- Results are bit-identical. The restated laws read the same values the originals computed:
  - The table is `DiscretizeAll` under the same criteria and floors, and equal to `DiscretizedEntry` per edge (`Law_Perf_DiscretizedWitnessIsDiscretizedEntries`).
  - The face outcomes are the same `MeshFace` calls over that table.
  - The pipeline mesh is L1's `MeshModel` outcome, which `WitnessMesh` also returns.
- Witness cost, compiled: the 17 new witnesses together take under 0.4 s. The 20-witness total of 19.8 s is L1's three meshed witnesses (block with hole 9.7 s, hollow box 6.0 s, unit box 3.8 s), which any run of the mesh laws builds.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, ticket, plan, L1's TRACK, the three law files, the runner's case generation) | 20 min | |
| Writing | 25 min | |
| Staged laws, interpreted | 2 min | the warm server's `plato_laws.py` matched no law for the staged blocks (the filter or the staging root; not investigated), so the pinned CLI without `--backend` instead: 1 probe law (15 s), then all 28 pass (20 s; laws 5.2 s summed, witnesses 4.7 s) |
| Compiled runs | 3 min of runs | 2 runs. First: `dotnet C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll run stdlib/foundation stdlib/geometry stdlib/graphics C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-mesh-staging/perf-proofs-laws --recursive --exclude=brep.types.plato --exclude=brep.library.plato --exclude=brep.concepts.plato --laws --backend=csharp --profile=cpu64 --budget=2 --filter=EdgeDiscretizingWitnessLaws,StepToMeshProofsDiscretizationWitnessLaws,StepToMeshProofsMeshWitnessLaws` from `C:/Users/cdigg/git/plato`: 28 laws, 28 pass; slowest RefineNeverCoarsens 0.07 s over 16 cases, MeetsCriteriaProofIffMeetsCriteria 0.06 s; laws 0.3 s summed; 20 witnesses 19.8 s; total 65 s. Second, after renaming the Refine law: same filter, 76 s, no fail or error line, slowest 0.07 s (its summary line was cut by the output filter) |
| Originals, compiled (before numbers) | 2 min | same CLI over the library alone with the 26 original law names: 9 pass, 17 over budget (Verdicts above); total 116 s, laws 247 s summed |
| Waiting | 3 min | |

## Lessons
- Time the originals compiled once at the start: the before numbers show which laws matter (the mesh-quality pair at 49 and 76 s) and which already fit (the five layer 4 laws).
- Grep the spec files for a law's name before changing its signature: `Law_RefineNeverCoarsens` is called by a contract.
