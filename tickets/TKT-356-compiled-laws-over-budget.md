---
id: TKT-356
title: Mesher laws over the 2 s budget on compiled C#: 85 laws, ranked, from the TKT-354 sweep
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/**]
workflow: [W3]
related: [TKT-354, TKT-351, TKT-350]
confidence: high
created: 2026-10-19
kind: defect
---

## Acceptance criteria

- [ ] every law in the ranked list runs under 2 s on the compiled backend (plato run --backend=csharp --budget=2) in a full sweep, or is split so that each resulting law does
- [ ] a witness that several laws mesh is meshed once per sweep and shared, not once per law case

Found by the first compiled sweep of the mesher library (TKT-354; Plato e37c032f, pinned at C:/Users/cdigg/.plato-cli/e37c032f; library at bim-open-toolkit d3d297ce, profile cpu64, budget 2 s, abandon 120 s, 22 threads):

    dotnet C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll run stdlib/foundation stdlib/geometry stdlib/graphics C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh --recursive --exclude=brep.types.plato --exclude=brep.library.plato --exclude=brep.concepts.plato --laws --backend=csharp --profile=cpu64 --budget=2 --report=<tsv> --baseline=sandbox/step-brep-mesh/reviews/verdicts-cpu64.tsv

Owner decision 2026-10-19: a law over 2 s is a defect in the library or the backend, never a reason to shrink a witness. 85 laws were over 2 s compiled. The 50 that timed out at 120 s in the interpreter are still errors compiled, and 33 that passed interpreted (under the 120 s budget) are over 2 s compiled. The interpreter remembers the result of an expensive pure call (src/Plato.Interpreter/CallMemo.cs), so a law that meshes the same witness in each of its 25 cases, or three times in one expression, meshed it once there; the compiled program has no such memo and meshes it every time. Stack samples of PolesLaws.Law_TorusGaussBonnet running alone on an idle machine (over 5 minutes, not finished) are in the library's own refinement loop: TriangulationFast.RefineToSurfaceByInsertion, SurfacePassLocal, BelowAngle and AnglePassLocal, through ArrayIntrinsics.FlatMap and MapRange; nothing in the runner or the runtime.

So two kinds of fix, both in the library, the plan's "shared expensive values" direction: (1) mesh a witness once and share the result, as a Witness_* value or a per-model function the laws take as a parameter, instead of calling MeshModel inside every case of every law; (2) the per-face refinement itself, which is far over 2 s for a torus, cone or sphere even once. Times below were measured with 22 laws running at once and the abandoned laws' threads still computing, so a time is an upper bound on the law alone; a law marked abandoned ran past 120 s and was given up on.

## Ranked list (compiled, cpu64, ms)

| ms | verdict | law | note |
|---:|---|---|---|

| 120212 | error | PolesLaws.Law_TorusGaussBonnet | abandoned at 120 s |
| 120063 | error | StepToMeshLaws.Law_OuterShellVolumePositive | abandoned at 120 s |
| 120056 | error | StepToMeshLaws.Law_VertexReevaluatesFromProvenance | abandoned at 120 s |
| 120042 | error | StepToMeshLaws.Law_ClosedWhenEveryShellClosedAndNoFaceEmpty | abandoned at 120 s |
| 120035 | error | StepToMeshLaws.Law_MeasureIsNeverNegative | abandoned at 120 s |
| 120035 | error | BsplinePipelineLaws.Law_TighterChordalStaysWithinLooserBound | abandoned at 120 s |
| 120031 | error | StepToMeshLaws.Law_OutcomesAreCurrent | abandoned at 120 s |
| 120030 | error | StepToMeshWitnessesLaws.Law_WitnessShellReversalNegatesVolume | abandoned at 120 s |
| 120030 | error | PolesLaws.Law_ConeMeshIsSound | abandoned at 120 s |
| 120029 | error | BsplinePipelineLaws.Law_RoundLaws | abandoned at 120 s |
| 120027 | error | StepToMeshWitnessesLaws.Law_HollowBoxMeshVolumeIsDifference | abandoned at 120 s |
| 120026 | error | StepToMeshLaws.Law_ProvenanceNamesModelCell | abandoned at 120 s |
| 120026 | error | StepToMeshLaws.Law_PendingRequestsAreRefinable | abandoned at 120 s |
| 120026 | error | StepToMeshLaws.Law_ElementFaceIsModelFace | abandoned at 120 s |
| 120026 | error | StepToMeshLaws.Law_CornerNormalIsFaceNormal | abandoned at 120 s |
| 120025 | error | StepToMeshWitnessesLaws.Law_WitnessEdgeReversalPreservesMesh | abandoned at 120 s |
| 120025 | error | StepToMeshLaws.Law_MeshedAssemblyValidatesStructurally | abandoned at 120 s |
| 120023 | error | StepToMeshWitnessesLaws.Law_WitnessMeshValidatesClean | abandoned at 120 s |
| 120023 | error | StepToMeshLaws.Law_OkExactlyWhenClean | abandoned at 120 s |
| 120023 | error | StepToMeshLaws.Law_MeshModelIsDeterministic | abandoned at 120 s |
| 120022 | error | StepToMeshLaws.Law_AngleDefectMatchesBrepEuler | abandoned at 120 s |
| 120022 | error | PolesLaws.Law_SphereGaussBonnet | abandoned at 120 s |
| 120022 | error | BsplinePipelineLaws.Law_ModelLaws | abandoned at 120 s |
| 120021 | error | StepToMeshLaws.Law_VoidShellVolumeNegative | abandoned at 120 s |
| 120021 | error | StepToMeshLaws.Law_MeshedMeshValidatesStructurally | abandoned at 120 s |
| 120021 | error | PolesLaws.Law_ConeFaceChecksHold | abandoned at 120 s |
| 120021 | error | BsplineOraclesLaws.Law_BumpTopAreaInBracket | abandoned at 120 s |
| 120020 | error | StepToMeshLaws.Law_ShellReversalNegatesVolume | abandoned at 120 s |
| 120020 | error | StepToMeshLaws.Law_CornerProvenanceIsOnItsElementFace | abandoned at 120 s |
| 120020 | error | PolesLaws.Law_TorusAtVertexFaceChecksHold | abandoned at 120 s |
| 120020 | error | BsplinePipelineLaws.Law_EdgeLaws | abandoned at 120 s |
| 120019 | error | StepToMeshLaws.Law_ValidationIsIdempotent | abandoned at 120 s |
| 120019 | error | PolesLaws.Law_TorusMeshIsSound | abandoned at 120 s |
| 120018 | error | StepToMeshWitnessesLaws.Law_WitnessMeshesOk | abandoned at 120 s |
| 120018 | error | StepToMeshLaws.Law_MeshEulerEqualsBrepEuler | abandoned at 120 s |
| 120018 | error | PolesLaws.Law_ConeGaussBonnet | abandoned at 120 s |
| 120017 | error | StepToMeshLaws.Law_RefinementNeverCoarsens | abandoned at 120 s |
| 120017 | error | PolesLaws.Law_SphereByPoleLoopsMeshIsSound | abandoned at 120 s |
| 120016 | error | StepToMeshLaws.Law_SolidShellMeshesShareNoVertex | abandoned at 120 s |
| 120015 | error | StepToMeshWitnessesLaws.Law_PlantedBadFaceErrorsStayInTheSheet | abandoned at 120 s |
| 120015 | error | StepToMeshLaws.Law_EdgeReversalPreservesMesh | abandoned at 120 s |
| 120015 | error | BsplinePipelineLaws.Law_StateLaws | abandoned at 120 s |
| 120015 | error | BsplinePipelineLaws.Law_DiagnosticLaws | abandoned at 120 s |
| 120015 | error | BsplinePipelineLaws.Law_BumpSolidMeshesClosedWithinAreaBound | abandoned at 120 s |
| 120014 | error | StepToMeshLaws.Law_LoopEndsTerminal | abandoned at 120 s |
| 120014 | error | BsplinePipelineLaws.Law_BumpSolidNeedsNoRound | abandoned at 120 s |
| 120013 | error | StepToMeshWitnessesLaws.Law_WitnessPowerOfTwoScalingScalesPositions | abandoned at 120 s |
| 120012 | error | StepToMeshWitnessesLaws.Law_WitnessMeshCrossChecksClean | abandoned at 120 s |
| 120012 | error | StepToMeshLaws.Law_StepDecreasesMeasure | abandoned at 120 s |
| 120012 | error | StepToMeshLaws.Law_PowerOfTwoScalingKeepsConnectivity | abandoned at 120 s |
| 120012 | error | StepToMeshLaws.Law_OnlyFacesOfChangedEdgesAreRemeshed | abandoned at 120 s |
| 120011 | error | StepToMeshLaws.Law_EveryDiagnosticIsLocated | abandoned at 120 s |
| 120011 | error | PolesLaws.Law_SphereByPoleLoopsFaceChecksHold | abandoned at 120 s |
| 120011 | error | PolesLaws.Law_RedundantPoleLoopsMeshIsSound | abandoned at 120 s |
| 120010 | error | StepToMeshLaws.Law_RoundsWithinLimit | abandoned at 120 s |
| 120010 | error | PolesLaws.Law_TorusFaceChecksHold | abandoned at 120 s |
| 120010 | error | PolesLaws.Law_TorusAtVertexMeshIsSound | abandoned at 120 s |
| 120010 | error | BsplinePipelineLaws.Law_BumpSolidPassesWitnessLaws | abandoned at 120 s |
| 120009 | error | StepToMeshLaws.Law_MeshClosedExactlyWhenShellClosed | abandoned at 120 s |
| 120009 | error | PolesLaws.Law_SphereMeshIsSound | abandoned at 120 s |
| 120005 | error | StepToMeshLaws.Law_PowerOfTwoScalingScalesPositions | abandoned at 120 s |
| 120005 | error | PolesLaws.Law_SphereFaceChecksHold | abandoned at 120 s |
| 120004 | error | StepToMeshWitnessesLaws.Law_WitnessPowerOfTwoScalingKeepsConnectivity | abandoned at 120 s |
| 120004 | error | StepToMeshLaws.Law_OrientedWhenEveryShellClosedAndNoFaceEmpty | abandoned at 120 s |
| 120002 | error | StepToMeshLaws.Law_MeshedMeshIsWellFormed | abandoned at 120 s |
| 103752 | error | BrepWitnessesLaws.Law_WitnessIsOracleClean | pass interpreted |
| 94629 | error | BsplinePipelineLaws.Law_OneRoundResolvesCrossingFace | pass interpreted |
| 75881 | error | StepToMeshWitnessesLaws.Law_HollowBoxOuterMeshVolumePositive | pass interpreted |
| 69698 | error | StepToMeshWitnessesLaws.Law_BlockWithHoleMeshIsOneTorus | pass interpreted |
| 69650 | fail | TriangulationLaws.Law_RefinedInteriorMeetsMinAngle | fail interpreted |
| 52616 | error | StepToMeshWitnessesLaws.Law_HollowBoxMeshIsTwoSpheres | pass interpreted |
| 37865 | error | BrepWitnessesLaws.Law_BSplineTopAreaInBracket | pass interpreted |
| 33385 | error | BsplinePipelineLaws.Law_NoRoundsLeaveCrossingFaceUnresolved | pass interpreted |
| 21146 | error | StepToMeshWitnessesLaws.Law_PlantedBadFaceIsDiagnosed | pass interpreted |
| 13539 | error | StepToMeshWitnessesLaws.Law_PlantedBadFaceHasTwoErrors | pass interpreted |
| 12658 | error | TriangulationLaws.Law_CdtIsConforming | pass interpreted |
| 11548 | error | StepToMeshWitnessesLaws.Law_UnitBoxMeshesAsStated | pass interpreted |
| 8641 | error | BrepWitnessesLaws.Law_WitnessValidatesClean | pass interpreted |
| 7824 | error | BrepWitnessesLaws.Law_WitnessDivergenceVolumeMatchesFacts | pass interpreted |
| 6384 | error | TriangulationLaws.Law_MinAngleBetterOnCylinders | pass interpreted |
| 5420 | error | TriangulationLaws.Law_CdtKeepsEverySegment | pass interpreted |
| 5265 | error | TriangulationLaws.Law_CdtKeepsBoundary | pass interpreted |
| 3908 | error | TriangulationLaws.Law_MinAngleNoWorseThanLibrary | pass interpreted |
| 3188 | error | TriangulationLaws.Law_RefineMeetsContract | pass interpreted |
| 2495 | error | TriangulationLaws.Law_RefinedNoFlippableEdge | pass interpreted |

65 abandoned at 120 s, 20 finished between 2 s and 120 s.

## Laws that passed interpreted and are over 2 s compiled


- StepToMeshLaws.Law_OutcomesAreCurrent: 120031 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- BsplinePipelineLaws.Law_RoundLaws: 120029 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- StepToMeshWitnessesLaws.Law_HollowBoxMeshVolumeIsDifference: 120027 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- StepToMeshLaws.Law_PendingRequestsAreRefinable: 120026 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- PolesLaws.Law_SphereGaussBonnet: 120022 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- BsplineOraclesLaws.Law_BumpTopAreaInBracket: 120021 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- StepToMeshLaws.Law_ValidationIsIdempotent: 120019 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- PolesLaws.Law_ConeGaussBonnet: 120018 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- StepToMeshWitnessesLaws.Law_PlantedBadFaceErrorsStayInTheSheet: 120015 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- StepToMeshLaws.Law_EdgeReversalPreservesMesh: 120015 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- BsplinePipelineLaws.Law_StateLaws: 120015 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- StepToMeshLaws.Law_OnlyFacesOfChangedEdgesAreRemeshed: 120012 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- PolesLaws.Law_SphereMeshIsSound: 120009 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- StepToMeshLaws.Law_PowerOfTwoScalingScalesPositions: 120005 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- BrepWitnessesLaws.Law_WitnessIsOracleClean: 103752 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- BsplinePipelineLaws.Law_OneRoundResolvesCrossingFace: 94629 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- StepToMeshWitnessesLaws.Law_HollowBoxOuterMeshVolumePositive: 75881 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- StepToMeshWitnessesLaws.Law_BlockWithHoleMeshIsOneTorus: 69698 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- StepToMeshWitnessesLaws.Law_HollowBoxMeshIsTwoSpheres: 52616 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- BrepWitnessesLaws.Law_BSplineTopAreaInBracket: 37865 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- BsplinePipelineLaws.Law_NoRoundsLeaveCrossingFaceUnresolved: 33385 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- StepToMeshWitnessesLaws.Law_PlantedBadFaceIsDiagnosed: 21146 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- StepToMeshWitnessesLaws.Law_PlantedBadFaceHasTwoErrors: 13539 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- TriangulationLaws.Law_CdtIsConforming: 12658 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- StepToMeshWitnessesLaws.Law_UnitBoxMeshesAsStated: 11548 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- BrepWitnessesLaws.Law_WitnessValidatesClean: 8641 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- BrepWitnessesLaws.Law_WitnessDivergenceVolumeMatchesFacts: 7824 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- TriangulationLaws.Law_MinAngleBetterOnCylinders: 6384 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- TriangulationLaws.Law_CdtKeepsEverySegment: 5420 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- TriangulationLaws.Law_CdtKeepsBoundary: 5265 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- TriangulationLaws.Law_MinAngleNoWorseThanLibrary: 3908 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- TriangulationLaws.Law_RefineMeetsContract: 3188 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
- TriangulationLaws.Law_RefinedNoFlippableEdge: 2495 ms compiled, pass interpreted (the interpreter's call memo answered the repeated meshing once)
