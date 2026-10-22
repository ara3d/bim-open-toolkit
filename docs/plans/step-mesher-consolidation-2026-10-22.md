# STEP mesher: consolidation findings

Written 2026-10-22, against `main` at 367d9dfb plus the working tree. Read-only review: nothing was edited, compiled or run.

Scope:
- The Plato library at `C:\Users\cdigg\git\bim-open-toolkit\sandbox\step-brep-mesh` (layers 00 to 11).
- The hand-written C# host under `C:\Users\cdigg\git\bim-open-toolkit\deps\bim-open-data` (`src/data/Ara3D.Step.Mesher`, `tools/step-corpus-harness`, `tests/data/Ara3D.Step.Mesher.Tests`).

Paths below are relative to the library root unless they start with a C# folder.

## Method

- Six read-only reviewers each took a slice of layers: 00-01, 02-03, 04-05, 06+10+11, 07, and 08-09 with the C# host.
- They counted callers with word-boundary searches over every `.plato` file, with comments stripped. The 04-05 and 07 reviewers also followed calls from these roots:
  - `MeshModel`, `MeshStepText`, `MeshStepTextTraced` and `MeshChosenFaces` (what "live" means below);
  - every `Law_*` and `Witness_*`;
  - every name the C# or Python code uses.
- Each "dead" call was checked against the Status lines in `sandbox/step-mesh-staging/*/TRACK.md`.
- I re-checked three claims by hand:
  - `CountsAsEdge` (`02-topology/topology.library.plato:1064`) calls `m.IsEveryIndexInRange` on every call.
  - The `<X>At` laws in `08-pipeline/pipeline-witnesses.laws.plato` have zero references.
  - `Check_AssembledSharedBoundaryCornersCoincide` (`07-validation/validation-checks-mesh.library.plato:532`) runs the assembling law at every pair of corners.
- The Plato navigation index covers only `plato/stdlib`, not this sandbox, so all searches were ripgrep.
- Nothing was compiled or run, so every evaluation count comes from reading the code.

Labels:
- **small**: one chunk, a few files, no renames across layers.
- **wide**: renames or many callers; waits until version 1 is done.
- Confidence (high, medium or low) follows each label.

## Correctness side-findings (decide before cleanup)

These surfaced during the review. They are not consolidation work, but each one changes what a cleanup chunk should keep.

1. **The live insertion passes have no agreement law.**
   - Every refinement agreement law compares two non-live generations, Built against Local (`05-face-meshing/triangulation-built.laws.plato:65, 92`; `10-editing/face-quality.laws.plato:55, 59`).
   - Nothing compares `SurfacePassCarried`, `AnglePassCarried` or `TryInsertionIndexed` with a reference.
   - `Witness_AnglePassWork` measures `AnglePassBuiltCounted`, which is not live.
2. **One law name has two different claims.**
   - `Law_WitnessMeshValidatesClean` (`08-pipeline/pipeline-meshed-witness.laws.plato:43`) requires the whole outcome report to be clean.
   - The runner writes its row under the same name from `WitnessMeshValidatesCleanOf` (`09-tooling/tooling-law-runner-once.library.plato:117`), which checks only mesh validation.
3. **Many agreement laws always pass.** They compare a function with an alias of itself (finding 6), so their passing proves nothing.
4. **The harness's mesh digest cannot match on a file that refines.** `TimedMesh.RunModel` (`tools/step-corpus-harness/TimedMesh.cs:72-92`) restates `MeshFile` but never calls `Refined`. The time and gallery modes therefore give a different digest from `MeshFile` on such a file, although `OneMode`'s documentation says they agree.
5. **Two pole witnesses mesh for nothing.** No law over `PoleWitness` checks anything on `Witness_SphereFineFacePoles` or `Witness_SphereByPoleLoopsFineFacePoles` (`07-validation/poles-witness.library.plato:61-68`): one law skips them because `Whole` is false, the other because their names are outside its Gauss-Bonnet list. Every sweep still meshes two spheres at chordal 0.01.

## Findings, ranked

The ranking puts repeated work on live or swept paths first, then lines removed.

### 1. Each face's Green boundaries are built about ten times per Oracle validation (wide, high)

- **Where:** at Oracle level, `Validated` (`08-pipeline/pipeline.library.plato:301`) and the runner's `CheckedWitnessShared` both run `ValidateBrep` and `CrossCheck`. Between them they build each face's coarse and fine boundary pair (32 or 64 chord projections per coedge) in five places:
  - `Check_FaceAreaMatchesOracleOnce` (`07-validation/validation-oracles-once.library.plato:317`)
  - `TubeVolumeOnce` → `ShellOracleAreaGiven` → `GreenAreaPairGiven` (`:263`, `:267`), once per body
  - `Oracle_BodyVolumeOnce` → `FaceVolumePair` → `GreenBoundaryCounted` (`:199`, `:233`)
  - `Check_OuterShellExactVolumePositive` and `Check_VoidShellExactVolumeNegative`, which call `Oracle_DivergenceVolume` again (`validation-checks-cross.library.plato:307`, `:312`)
  - `Check_PlanarFaceAreaMatchesGreen` (`:318`)
- **Also:**
  - `SampledCurvatureBoundBody` (`bspline-oracles.library.plato:175`) builds the coarse boundary twice more, at `:133` and `:186`.
  - `GreenModelOk` is recomputed on every call.
- **Proposal:**
  - One per-model `GreenBoundaries` record, built once per report: coarse and fine segments per face, the nappe sign, and `GreenModelOk`.
  - `GreenAreaPairFrom`, `FaceVolumePairFrom`, `ShellOracleArea`, `TubeVolume` and the curvature bound read it.
- **Saves:** about 8 of every 10 boundary builds per face, on every Oracle validation and on every witness the runner checks.
- **Risk:** the signatures of the `*Once` readers, `Law_Outer/VoidShellExactVolume*` in `validation.laws.plato`, and the `Law_GreenEquals*` laws in `validation-oracles-once.laws.plato`.

### 2. The per-shell topology measures do a whole-model scan per edge and rebuild the edge-use table 7 to 9 times per shell (2a small, 2b wide; high)

- **Whole-model scan per edge:** `CountsAsEdge` (`02-topology/topology.library.plato:1064`) is `m.IsEveryIndexInRange ? !m.IsDegenerateEdge(e) : true`. The per-edge loops in `topology-shell-tables.library.plato` call it: `UsesEveryEdgeTwiceIndexed:233`, `FreeEdgeCountIndexed:237` and `IndexedBoundaryCycleCountIndexed:258`. Each measure therefore costs O(shell edges × model size).
- **Degeneracy three times per edge:** `IsDegenerateEdge` costs an edge domain (two inversions) and up to 65 curve samples. Through `ShellEulerPlusBoundaryCycles` it runs about three times per edge: in `ReducedCountsPolyIndexed` (`topology-faceted.library.plato:395`), in `IndexedBoundaryCycleCountIndexed:256`, and through `CountsAsEdge`.
- **The edge-use table, `EdgeUseTable(s)` (`topology-shell-tables.library.plato:109`), is rebuilt in every measure:**
  - twice in `RawCounts` (`topology.library.plato:908`);
  - twice in `CheckClosedShell` (`topology-proofs.library.plato:66`);
  - three times in `ClosedDegenerateEdgeCount` with `RawCounts` (`07-validation/validation-oracles.library.plato:873-877`);
  - again in each layer-7 shell check.
- **Proposal:**
  - (2a) `CountsAsEdgeGiven(ok, degenerate: Array<Boolean>)`. The `*Indexed` measures take one per-model degenerate-mark array and compute `ok` once.
  - (2b) A `ShellTables` record per shell (edge-use table, `ShellPolyEdgesOf`, degenerate marks), built once per check family. Its shape follows `topology-laws-given`.
- **Saves:** O(E × model) down to O(E) per measure, plus about 6 to 8 table builds per shell per validation.
- **Risk:**
  - (2a) is layer 2 only.
  - (2b) changes `validation-checks-topology.library.plato:114-164`, `validation-oracles.library.plato:873` and `validation-proofs.library.plato:23`. The laws keep their statements by delegating to the Given forms.

### 3. Layer-7 checks rebuild mesh tables per sample (small to wide, high)

The rule throughout: bind the table once per report and pass it to the `Given` forms.

- **Assembly per corner pair:**
  - `Check_Assembled*` (`07-validation/validation-checks-mesh.library.plato:482-553`) calls the old `Law_Assembl*` laws (`06-mesh/mesh-assembly.laws.plato:42-124`) once per sample, and each call runs `CanAssemble` and `AssembleModelMesh`.
  - `Check_AssembledSharedBoundaryCornersCoincide` (`:532`) uses `CheckGrid` over corner pairs, so it does 2·K² assemblies for K face-mesh corners.
  - The same claim bodies already exist as `*Given` forms in `06-mesh/mesh-laws-once.library.plato:33-82`. The L6 merge planned to rebind them (`perf-law-bindings/TRACK.md` lines 36 and 46) and did not.
- **The edge table per edge:** `mesh.EdgeTableOf` sorts every side. It is evaluated per edge in `Check_EdgeTableEdgeIsCanonical`, `...IsStrictlySorted`, `...ListsOnlyUsedEdges`, `DirectionSum*`, `ClosedMeans*` and `ManifoldMeans*` (`validation-checks-mesh.library.plato:324-369`): O(E² log E).
- **Inside the layer-6 laws these checks call:**
  - `Law_EdgeTableCountMatchesItsSides` builds the table three times per edge (`06-mesh/mesh-topology.laws.plato:60`).
  - `Law_ElementCornersShareItsComponent` runs `ComponentsOf` twice per corner (`:126`).
  - `CountsOf(mesh, c)` (`mesh-topology.library.plato:285`) rebuilds the edge table, the components and every component's counts on each call, and callers loop over components (`validation-checks-mesh.library.plato:387, 418`; 13 uses in `validation-witnesses`).
  - `CoincidentVertexPairs` is built twice per pair index (`mesh-measures.laws.plato:116`).
- **Proposal:**
  - The SelfTest arm of `ModelMeshReport` binds `MeshComponentTablesOf` and the assembled mesh once, as `ModelMeshStructureReportCounted` (`validation-checks-components.library.plato:142`) already does.
  - Rewrite each old `Law_Assembl*` as `CanAssemble ? XGiven(..., m.AssembleModelMesh(fm, n), ...) : true`, and delete the second statement of the same laws in `mesh-laws-once.laws.plato:40-105`.
- **Saves:**
  - O(K²) assemblies down to 1;
  - about 9·E edge-table sorts down to 1;
  - about 40 lines.
- **Risk:** the check signatures in `validation-checks-mesh.library.plato`, and the `ensures` lines in `mesh-assembly.spec.plato` that name these laws.

### 4. One meshing run scans and tables the model 3 + 2R times (wide, high)

R is the number of refinement rounds.

- **`IsEveryIndexInRange` (the scan of every model table): three times per run.**
  - `IsRunnable` (`08-pipeline/pipeline.library.plato:327`)
  - `EdgeDiagnosticsInRange` (`pipeline-guards-edge.library.plato:20`)
  - `DiscretizeAllRangedCounted` (`04-discretization/discretization-edge-domain.library.plato:232`)
- **`EdgeFaceTable`: 2 + R times.**
  - `DiscretizeAllRangedCounted` (`:263`)
  - once per round in `RefineIndexedCounted` (`discretization-refine-indexed.library.plato:331`)
  - `DiscretizationFindingsTabled` (`discretization-edge-tables.library.plato:145`) and `DiscretizationFindingsRanged` (`discretization-edge-domain.library.plato:421`)
- **`Geometry.IsEveryIndexInRange`: 1 + R times.** In `FaceOutcomesCounted` (`pipeline-guards-face.library.plato:41`) and in each `Step` (`pipeline.library.plato:260`).
- **The per-edge "can discretize" verdict: twice.** `DiscretizeAll` decides it, and `ModelDiagnostics` → `EdgeDiagnosticsInRange` decides it again, although the state already holds the `Undiscretized` entries.
- **The host rebuilds this bundle too:** `StepPlatoTables` (`src/data/Ara3D.Step.Mesher/Plato/StepPlatoTables.cs:10-15`) restates it once per file. The library has no record of it, so the host built one.
- **Proposal:**
  - One library record of the model's tables (in-range flag, `EdgeFaceTable`, two-edge-loop flags, arena flag), built in `MeshChosenFaces`.
  - Pass it to `InitialState`, `Step`, `Refine` and `LoopReport`.
  - `StepPlatoTables` becomes that record.
- **Saves:** 3 + 2R whole-model passes per `MeshModel`, on every file of every corpus sweep.
- **Risk:** the signatures of `InitialState`, `Step`, `RefineIndexed` and `DiscretizationFindings`; `EveryStepHolds` (`pipeline-run.laws.plato:42`); the C# host.

### 5. About 1,500 lines sit behind three layer-7 entry points nothing calls (owner decision, medium)

- **The entry points:**
  - `ValidateStep` → `StepFileReport` (`07-validation/validation-checks-reports.library.plato:751-880`) → `WhereRulesReport` (`validation-checks-where.library.plato:610-833`) and every `Check_Where_*` and STEP check;
  - `ValidateDiscretizations` → `DiscretizationReport` (`validation-checks-reports.library.plato:324-408`), plus about 30 discretization checks only it calls;
  - `ValidateFaceMeshOutcome` → `FaceMeshOutcomeReport` (`:509`), plus three outcome checks (`validation-checks-face-meshing.library.plato:260-273`).
- **Evidence:** nothing in layers 08 to 11, the laws, C# or Python calls any of them; a repository-wide search confirmed it. `validation.spec.plato:76` names `ValidateStep` in a contract, and TKT-441 may be meant to wire STEP validation.
- **Proposal:** wire them into the pipeline or harness, or remove them.
- **If kept:** findings 9 and 12 apply.

### 6. Agreement laws and helpers that compare a function with itself, across every layer (small per layer, high)

After the merges wired the fast form under the public name, these "references" are the fast form under another name. Each conjunct costs run time and proves nothing. Several merges dropped the law and left its helper.

- **00-01:**
  - `SortedAgreesAt` (`01-geometry/geometry-closure-marks.laws.plato:141-147`), with its orphans `MarksCurve` ×2, `MarksSurface` (`geometry.library.plato:183-209`) and `IsMarkedClosedSortedCounted` (`geometry-closure-marks.library.plato:88-90`);
  - `PerfPolishAgrees` (`bspline-polish.laws.plato:108-115`);
  - `Law_ResolutionAtConstantAgrees` (`00-foundation/foundation-constants.laws.plato:48-55`);
  - the Eval, Derivative, SecondDerivative and EvaluationMagnitude conjuncts of `CompositeOnceAgreesAt` and its 2D form (`geometry-closure-marks.laws.plato:199-202`, `211-214`);
  - `PcurveToCurveGap` ×2 and `PcurveSampleFor` (`geometry.laws.plato:950-979`).
- **02 and 08:**
  - 6 of 11 conjuncts in `08-pipeline/pipeline-faceted.laws.plato:133-138`;
  - 7 conjuncts in `pipeline-shell-tables.laws.plato:67-74`;
  - `pipeline-shell-orientation.laws.plato:76` and `:104-105`.
  - Deleting them frees these alias chains:
    - `ShellComponentCount` → `...ByVertex` → `...ByVertexCounted` → `...ByGridCounted` (`02-topology/topology-shell-orientation.library.plato:29-42`). The comment on `ByVertexCounted` is stale.
    - `ImplicitEdgeUses` → `ImplicitEdgeUsesRanked`, with `ImplicitEdgeKeys:1013` and `PolyPointOffset:1005`.
    - `topology-laws-once.{library,laws}.plato`, which can fold into `topology-laws-given` and `topology.laws.plato`.
- **04-05:**
  - `Law_RefineIndexedAgrees`, `...OnStars` and part 3 of `Law_ThirteenHolesAgree` (`05-face-meshing/uv-boundary-index.laws.plato:237, 256, 263`);
  - `Law_DelaunayedIndexedAgrees(OnStars)` (`:207, 212`). `CdtWithIndexedFlips` (`:195`) is a copy of `TriangulateRegionCdtIndexedCounted`, while the real scanned reference `Delaunayed` has no reader. Point the law at `Delaunayed` or delete both.
  - the second halves of `CdtIndexedAgreesOn` and `Law_TriangulateRegionCdtIndexedAgrees` (`triangulation-cdt-indexed.laws.plato:55, 126`);
  - `pipeline-collide.laws.plato:134-135`;
  - orphan helpers that no `Law_*` calls:
    - `DiscretizationAgreesOn`, `SameFindings` and `MeetsOnceAgreesOn` (`pipeline-edge-tables.laws.plato:117-140`);
    - `RefineAgreesOn` (`pipeline-refine-indexed.laws.plato:119`);
    - `RangedAgreesOn` (`pipeline-edge-domain.laws.plato:51`);
    - `RefineBuiltAgreesOn` (`triangulation-built.laws.plato:115`);
    - five helpers in `uv-regions-indexed.laws.plato:33-105`, whose comments cite laws that no longer exist;
    - the agreement helpers in `pipeline-domain-once.laws.plato:23-70`;
    - `SagittaAttainedVerdictsAgree` (`pipeline-bisection.laws.plato:133`);
    - `SameLiftedFaceMesh` (`face-meshing-lift.laws.plato:128`).
- **07:**
  - `validation-oracles-once.laws.plato:56-117`: 11 helpers, about 62 lines;
  - `validation-components.laws.plato:65-100`.
  - With those gone, the 11 forwarders at `validation-checks-mesh.library.plato:86-185` have no caller.
- **09 and 11:**
  - `Law_PlanOfIndexedAgrees`, and the `CostOfBound`/`CostOf` half of `DiagnosisAgreesOn` (`11-repair/repair-indexed.laws.plato:183-206`);
  - the second half of `Law_WitnessNamesAreModelWitnessNames`;
  - `Law_UnitBoxRunsAreTheOldRuns`, which compares `PipelineWitnessRunsFrom` with its hand copy `OldRowsOnWitnessZero` (`09-tooling/tooling-law-runner.laws.plato:71-87`).
- **Saves:** about 450 lines, and roughly 20 to 40 law evaluations per witness model per sweep.
- **Risk:** none for callers. Do side-finding 1 first, so the refinement keeps a real agreement law.

### 7. Forwarders and alias chains left by the merges, about 700 lines (wide, high)

- **The pattern:** a public name forwards in one line to a `Body`, `Once`, `Sorted`, `Linear`, `Constant`, `Indexed`, `Ranged`, `Carried` or `Given` twin that nothing else reads. The fix is to move the body under the public name and delete the forwarder and its comment.
- **Layer 00-01, 14 forwarders.**
  - Examples: `BSplinePoint`/`BSplinePartial` (`geometry-splines.library.plato:200, 205`), `ProjectNearBySearch` (two hops, `geometry-surfaces.library.plato:310` → `bspline-inverse.library.plato:368`), `Domain(g, s)` → `DomainOnce`, `IsMarkedClosed` ×3, `ClassRoots` (fold `foundation-class-roots.library.plato` into `foundation.library.plato`), `RoundingUnit` and `SmallestNormal`.
  - `bspline-evaluation.library.plato:3-6` still says the bodies wait for wiring.
- **Layer 04-05:**
  - `DiscretizeAll` → `...Indexed` → `...Ranged`, plus the aliases `DiscretizeAllTabled` and `DiscretizeAllBounded`;
  - `Refine` → `RefineTabled` → `RefineRanged` → `RefineIndexed`;
  - `RefineToSurfaceByInsertion` → `...Indexed` → `...Carried`;
  - `IsStrictlyInsideOnGrid`, `Unwrap`, `IsSimpleRegion`;
  - `LiftIndexed` = `Lift`;
  - `TriangulateRegionCdtIndexed` = `TriangulateRegionCdt`.
- **Layer 06, 10 and 11:**
  - `PieceCount`, `CoincidentVertexPairs`, `ElementsOfFaces`, `AssembleModelMesh`, `FacesAtVertex`/`FacesOnCurve` (the `ByCoedges` forms), `CostOf`, `PlanOf`;
  - `NumberMeshVerticesMarked` (`mesh-numbering-indexed.library.plato:76`).
- **Layer 07:** about 120 one-line check forwarders.
  - 22 in `validation-checks-step`, 20 in `-geometry`, 19 in `-face-meshing`, 16 in `-topology`, 11 in `-mesh` and 5 in `-cross`, plus about 13 oracles.
  - STEP has three tiers: `Check_X` → `Check_XOnce` → `Check_XGiven`.
- **Layer 08-09:** `EdgeDiagnostics`, `RaisedFloors`, `FaceOutcome`, `FacesTouching` and `FaceOutcomes` (`pipeline.library.plato:155-198`); `LawReportOf` → `LawReportOnce`; `DumpStages` → `DumpStagesOnce`.
- **Unfinished move:** the header of `pipeline-run-states.library.plato` says both its functions move into `pipeline.library.plato` at merge; they have not.
- **Proposal:** keep the contract name and the `...Counted` form, and delete the intermediate names, one chunk per layer.
- **Saves:** about 700 lines and about 200 names.
- **Risk:**
  - Renames reach laws and specs.
  - The agreement laws in `validation.laws.plato` call the original names and keep working.
  - The C# host calls generated names, so check `StepPlatoMesher.cs` and the harness for each renamed function that is public in the generated code.

### 8. Dead code: about 1,000 lines with no caller, no law and no C# use (small per layer, high)

- **00-01 (about 45 lines):** `Curvature`, `IsPolynomial`, `SplineBreakpoints`, `IsIncreasing`, `UnwrappedEnd`, `IsOn`, `IsUnwound`, `ToProvenance`.
- **02-03 (about 120 lines):**
  - `ToCurveParameter` (the whole of `topology-parameters.library.plato`), `CoincidenceRoots`, `ShellPolyPointRoots`, `IsDefectiveImplicitEdge`, `FaceParityLink`, `PositionOf(faces, f)`, `FacesAroundVertex`, `ShellTouchesVertex`, `WithDelta`;
  - `PolyPointsTouch` and `WithEveryFaceReversedMarked` (`topology-shell-orientation.library.plato`);
  - `IsRoot`, `FaceSource`, `TraceOf`;
  - `CornersByVertex`, `CornersAtVertexIn` and the `VertexCornerTable` type, read only by their own law;
  - `ToRadians` (`step.library.plato:402`) has no caller, although the README calls it the host's single conversion point; delete it or keep it on purpose.
- **04-05 (about 190 lines):**
  - `ArcOf`, `ChordalVerdict`, `AngularVerdict` and `DensityAt` (`discretization-requests.library.plato`), which spec lines name;
  - in `discretization.library.plato`: `ImagesExceedChordal`, `SegmentFails`, `HalvesKeepMinLength`, `SegmentMeetsCriteria`, `RequestedChordal`;
  - four `*On` helpers in `termination-discretize.library.plato`;
  - in `discretization-edge-domain.library.plato`: `RefinedParametersGiven`, `RefineEdgeBoundedRanged`, `RefineEdgeRangedIn`, `DiscretizationFindingsRanged`;
  - in `discretization-edge-tables.library.plato`: `DiscretizeAllTabled`, `RefineEdgeIn`, `SegmentsMeetCriteriaOn`;
  - `SplitSpanCached`;
  - layer 05: `BelowAngle`, `Removes`, `Changes`, `ShortestSideLength`, `IsGoodInsertion`, `Delaunayed` (unless finding 6 revives it), `SegmentUvDeviation`, `EdgeTooCoarseInFace`.
- **06, 10 and 11 (about 150 lines):**
  - the deferred "Boundaries and defects" section of `mesh-elements`, library lines 40-108, with its five types (types lines 67-105);
  - `CountBoundaryEdges`, `CountNonManifoldEdges`, `CountsOfComponent`, `IsComponentInRange`, `IsElementOfFaces`;
  - `ElementsWithRepeatedCorners`, `DegenerateElements`, `IsDegenerate`;
  - both `IsAcceptable` overloads and `CircumradiusToShortestEdge`;
  - `Preview`, `EmptyLedger`, `ToPreparedModel`;
  - `Check_QuadConvex` (read only from `step-mesh-staging/v1-gate`).
- **07 (about 380 lines):**
  - in `validation-oracles.library.plato`: `GreenPathsOfBound`/`...OfLoop`, `EdgeLoopPath`, `ShiftedCoedgePath`, `CoedgeUvPath`, `UnwrappedFrom`, `NoUvs` (`:310-419`), `ShellVolume`, `FaceVolumeTerm`, `FaceCurvatureBound`, `FaceSmallestConeRadius`, `Oracle_SphereZoneArea`, `Oracle_TorusPatchArea`;
  - `CheckEdgesWithin` and four `*Samples` helpers (`validation-checks-common`);
  - `CanCompareElement`, `IsSolidVolumeJudged`, `TubeVolume`;
  - `MostLoopPoints`, `FaceUsesEdgeAt`, `OffCurvePoint`, `OffSurfacePoint`, `ShellMeshVolumeAbout`, `SourceCount`;
  - six `*Deviation` functions (`validation-checks-topology.library.plato:291-313`);
  - `Check_EdgeLiesOnAdjacentSurfacesHoisted`;
  - `ExercisesFeature`, `IsPublished`;
  - four `poles.laws.plato` helpers;
  - `FaceChecksHoldOn` and `PoleFaceChecksHold` (`poles-witness.laws.plato:48-55`).
- **08-09 (about 300 lines):**
  - the 17 `<X>At` functions in `08-pipeline/pipeline-witnesses.laws.plato:55-202`. First move `WitnessOptions`, `WitnessOutcome`, `WitnessMesh`, `Witness_UnitBoxInitialState` and `IsAboutPlantedSheet` into a library, because libraries read them from a laws file today.
  - `ModelRuns`, `MeshedRuns`, `CheckRuns`, `OverWitnessEdges` and `PipelineWitnessRuns` (`tooling-law-runner.library.plato`), and `SameState`;
  - `HasFinding`, `CatalogMeshAt`, `CatalogBoxOutcomes`, `CatalogBoxOutcome`;
  - the never-read `StageDumpPair.Replayed`, which dumps the cylinder a second time per sweep.
- **Empty sections:** about eight files hold section headers with nothing under them; each reviewer listed theirs.
- **Risk:** README.md, VOCABULARY.md and a few spec files name some of these, so update them in the same chunk.
- **Unmerged test file:** `tests/data/Ara3D.Step.Mesher.Tests/Plato/TmpRefineTrace.cs` is gone from disk, and `PlatoRefinementTests.cs` beside it is untracked in bim-open-data. Commit it or delete it.

### 9. The STEP decode laws are written twice, and the STEP report decodes once per check (wide, high)

- **Two copies of each claim:** about 20 laws in `03-step/step.laws.plato` (lines 143-205, 321-348, 581-655, 749-757) each decode the file and then state a body. `07-validation/validation-checks-step-once.library.plato:40-256` restates the same bodies as `XGiven(d, ...)`; its own header says they are "transcribed from the law".
- **Proposal:**
  - Move the Given bodies into a layer-3 file, for example `step-laws-given.library.plato`. Each law becomes a one-line decode plus `XGiven`, as V2 already did in layer 2.
  - Drop `Law_RawStepClaimsAgree`.
  - Delete the 22 `Check_*Once` functions. `StepFileReport` binds `f.DecodeOnce` once and calls the Given forms.
- **Saves:** about 150 lines from the copies, and about 39 decodes become 1 per report.
- **Note:** this matters only if finding 5 keeps `ValidateStep`.

### 10. Five copies of the counting-sort row builder and eight of the "mark the listed rows" loop (wide, medium-high)

- **The row builder (count, prefix sum, cursor fill):**
  - `EdgeFaceTableCounted` (`02-topology/topology-edge-tables.library.plato:74-108`)
  - `CoedgeSiteRowsCounted` (`topology-shell-tables.library.plato:28-79`)
  - `CountingSortBy` (`topology-faceted.library.plato:166`)
  - the inline rows in `OrientationFlipsByAdjacencyCounted` (`topology-shell-orientation.library.plato:109-139`)
  - `FaceRowsOf` (`11-repair/repair-indexed.library.plato:49-96`)
  - `VertexElementIncidenceCounted` (`06-mesh/mesh-incidence.library.plato:32-102`)
- **Two identical types:** `FaceRows` (`repair-indexed.types.plato:17-22`) and `EdgeFaceTable` (`topology-edge-tables.types.plato:17-22`).
- **The mark loop:**
  - `RowMarks` (`10-editing/editing-masks.library.plato:26-46`)
  - `FaceMask` and `FacesWithElements` (`06-mesh/mesh-masks.library.plato:26-46`, `137-157`)
  - `CitedEdgesCounted` (`mesh-numbering-indexed.library.plato:41-70`)
  - `ReferencedVertexCount` (`validation-oracles.library.plato:950-963`)
  - `VerticesOfShellByMark`, `TwoEdgeLoopEdgesCounted`, `FaceMarks`, `FoldParity`
- **Proposal:**
  - One `RowsByKey(keys, rowCount)` returning offsets and a permutation, in layer 0 or 2.
  - One `RowMarks`/`MarkedRows` with a Counted form, in `00-foundation/foundation-indices.library.plato`. It must move there because layer 06 cannot call layer 10.
  - One row type.
- **Saves:** about 200 lines.
- **Risk:** each table's `Insertions` and `Flips` counts must stay identical for the `WorkClaim` laws, and `RepairIndex`'s field types change.

### 11. Per-edge-domain wirings in layer 04 were never finished, and per-sample domain work repeats in layer 02 (small, high)

- **Unfinished pairs:** E2's merge left about 15 pairs where the plain form has its own body beside a `Given`/range-taking copy, and no law reads the plain form as a reference:
  - `TurnFloor`, `TotalTurning`, `SampledTurning`, `EdgeSeeds`, `SeedCandidates`, `ConicSegmentCount`, `ConicSegmentCap` (`04-discretization/discretization.library.plato` against `discretization-edge-domain.library.plato`);
  - `GapProbe`, `IsOffSurface`, `UniformExceeds`, and `RaisedForImagesBounded`, whose 25-line search loop is written twice;
  - `UsableImagesFrom`, `EdgeFindingsFrom`.
- **Two fast forms of one job:**
  - `MinimumSegmentCountGiven` (E1, `discretization-edge-tables.library.plato:42`) and `MinimumSegmentCountRanged` (E2, `discretization-edge-domain.library.plato:102`). Confirm `IsClosedRegularEdge` equals `IsClosedEdge && !degenerate` before merging them.
  - `DiscretizeBoundedOnIndexed` (E1) and `DiscretizeBoundedOnCached` (R5).
- **Superseded witness:** `DiscretizeAllTabledCounted` and `DiscretizeTabled` are read only by `Witness_DiscretizeAllTabledWork`, which measures a path that is no longer live.
- **Proposal:** each plain form becomes `=> ...Given(..., m.EdgeDomain(e).Range)`, as the E2 file header asks. No ticket holds this debt.
- **Same pattern in layer 02:** `EdgeParameterAt`, `PcurveParameterDeviationAt`, `PcurveRunsWithCurveAt`, `SpanSharesCurveParameter` and `ParameterizationSignAt` (`02-topology/topology.library.plato:511-1423`) recompute `EdgeDomain`, two inversions plus a 256-sample search on splines, up to 5 times per sample. Layer 7's grid checks call them per (edge, sample). Give them range parameters.
- **Saves:**
  - about 110 lines in layer 04;
  - about 2 × samples domain computations per edge per check in layer 02, roughly ten times fewer inversions.

### 12. Topology, geometry and cross reports rebuild model-wide tables per check (wide, high)

- **TopologyReport:**
  - about 25 calls to `m.IsEveryIndexInRange`;
  - `AllCoedgeSites` built 3 or 4 times;
  - the sparse checks group sites by edge three times and by vertex twice (`validation-checks-topology-sparse.library.plato:62, 71`).
- **GeometryArenaReport:**
  - about 48 calls to `Geometry.IsWellFormed`;
  - `PcurveSiteTable` and `Curve2DSiteTable` rebuilt in about 16 checks (`validation-checks-sites.library.plato:111-145`);
  - `CurveSampleTable` about 9 times and `SurfaceSampleTable` about 19 times;
  - the two scans V3 left as debt: `PcurveSite` (`validation-checks-geometry-hoisted.library.plato:172`, O(P·E) per sample) and `Curve2DSite` (`validation-checks-geometry.library.plato:228`).
- **CrossReport:**
  - `RestrictedToShell` built 4 or 5 times per shell;
  - `IsCompleteShellMesh` rebuilds `FacesWithElements` and `IsWellFormed` on every call (`validation-checks-cross.library.plato:53`);
  - `VolumeRoundoff` computed per body (`:175`).
- **Proposal:**
  - One context record per report (`TopologyContext`, `GeometryContext`, `CrossContext`) passed to the existing `*Given` forms.
  - The two V3 scans become table reads; that part alone is a small chunk.
- **Risk:** the 13 `Law_*CheckAgrees` laws (`validation.laws.plato:264-352`) build the context inside themselves.

### 13. Each face's boundary is gridded twice, and the refinement and Lift recompute what they already hold (wide, medium)

- **Two grids per face:**
  - `MeshRegionOnce` → `CollidingSegments` builds segment boxes on its own sort-based grid (`SegmentBox`/`SegmentGridEntry`, `05-face-meshing/uv-collide.library.plato:46-142`).
  - `BoundaryIndexOf` (`uv-boundary-index.library.plato:117`) builds the same boxes on `ChartGrid` (`triangulation-cdt-indexed.library.plato:66`).
  - The constant 16 wide cells is defined twice: `ChartGridWideCells` (`:43`) and `WideSegmentCells` (`uv-collide:65`).
  - `NextBoundaryTable` is built twice per face.
- **Recomputed in the refinement and Lift:**
  - `RefineToSurfaceByInsertionCarriedCounted` (`triangulation-neighbours-carried.library.plato:215`) rebuilds `SurfaceDomainOf` and `RegionTolerance`, which `MeshRegionOnce` already has.
  - `PointNormalsOf` (`refinement-test-cached.library.plato:35`) calls `IsOnCollapsedLine` per tested corner per round, rebuilding the surface domain each time. That is the cost I5 was meant to remove; `IsOnCollapsedLineIn` exists.
  - `LiftCounted` (`face-meshing-lift.library.plato:92`) evaluates every point's position and normal again.
- **Proposal:**
  - Build the boundary index once in `MeshRegionOnce` and pass it to both the collision test and the refinement.
  - Use the domain-taking `...In` forms.
  - Carry per-point position, normal and pole flag from the refinement into `Lift`.
- **Saves:**
  - about 70 lines;
  - per face, N surface evaluations, N normals and N domain rebuilds, plus normals of unchanged corners across up to 40 rounds.
- **Risk:** the collision test's pair visits and work counts change.

### 14. Three generations of the insertion passes, and a reference loop that differs from the live one by one threshold (small, high on facts, medium on 14b)

- **14a. The Built generation.** These functions are read only by the laws in side-finding 1, which compare Built with Local:
  - `SplitSideSlotOf`, `SurfaceFallbackIn`, `InCircleOfFour`, `IsFlippableFour`, `FlipCavity`, `TryInsertionInto`, `SurfacePassBuilt(Counted)`, `AnglePassBuilt(Counted)` and `RefineToSurfaceByInsertionBuilt` (`05-face-meshing/triangulation-built.library.plato:113-546`).
  - Retarget those laws and `Witness_AnglePassWork` to the Carried passes against Local, then delete the Built-only functions. `FanOf`, `CavityAngles`, `CavityNeighbours`, `WithTriangles` and `Positioned` are live and stay.
  - Saves about 240 lines.
- **14b. The reference loop.** `RefineToSurfaceByInsertionReference` (`refinement-attainable.library.plato:60`) and its test `NeedsRefinementCachedCounted` (`refinement-test-cached.library.plato:148`, a 30-line copy of `NeedsRefinementCarriedCounted`) differ from the live loop in two ways: they rebuild the neighbour table each pass, and they use `SideNormalsTurn` instead of `SideNormalsTurnAttainable`.
  - The two side tests agree at a threshold of 0, except at NaN positions.
  - Add a threshold parameter to the live driver, express the reference as the live driver at 0, and delete the reference loop, the cached test, `TriangleCentroidTest`, `SideNormalsTurn` and the four Indexed pass wrappers (`triangulation-built-indexed.library.plato:149-169`).
  - Saves about 85 lines. `Witness_NeedsRefinementWork` then measures the live body.
- **14c. The split rule.** "Longest splittable side" is written four times: `SplitSideSlot`, `SplitSideSlotOf`, `SplitSideSlotIndexed` (read only by a law) and `SplitSideSlotOfIndexed`. Make it one function.

### 15. Constants and option bundles defined in more than one place (small, high)

- **Meshing criteria, five definitions (TKT-436):**
  - `StepPlatoMesher.Criteria` (`src/data/Ara3D.Step.Mesher/Plato/StepPlatoMesher.cs:110`, repeating `SurfaceAngleDegrees = 15` at line 23 and `PreferQuads` at line 30);
  - `PolesOptionsAt` (`07-validation/poles.laws.plato:29`), which the library `V1GateOptions` (`pipeline-v1-gate.library.plato:27`) calls, so a library depends on a laws file;
  - `GridCaseCriteria` (`grid-chordal.laws.plato:22`);
  - `CatalogQuadCriteria` (`pipeline-proofs-mesh.laws.plato:70`);
  - `LiftCaseCriteria` (`face-meshing-lift.laws.plato:28`).
- **Single-field updates written out by hand:** `WithRounds`; `StructuralWitnessOptions`, twice with identical bodies (`pipeline-run.laws.plato:78`, `tooling-law-runner.laws.plato:130`); `Witness_UnitScaleOptions`.
- **Values the C# host copies from the library:**
  - `MaxRefinementRounds` (line 91) rebuilds `DefaultMeshingOptions`;
  - `RefineCriteria` hard-codes the 0.1 minimum-length ratio (line 103);
  - the metres-to-millimetres conversion of the default chordal bound appears three times (`StepMesher.cs:73`, `TimedMesh.cs:48`, `PlatoRefinementTests.cs:13`).
  - Proposal: `HostMeshingOptions(chordal)` with `WithLevel`, `WithRounds` and `WithQuads` in `pipeline.library.plato`, called by every site above and by the host.
- **Unit factors, defined twice:** `ScaleToMetres` (`02-topology/topology.library.plato:1674-1682`) and `ClassifyLengthUnit` (`03-step/step.library.plato:381-387`) both write 1, 0.001, 0.01, 0.0254 and 0.3048. `IsNamedUnit` (`step-decoding.library.plato:75`) lists the units a third time.
  - Proposal: classify by iterating over the named units and comparing with `ScaleToMetres`.
  - Keep `ClassifyLengthUnit`'s signature, because C# `ContextUnitsReader.cs:30` calls it.
- **`Number.Pi / 180.0`, twice:** `SnapAngleFactor` (`step.library.plato:396`) and `AngleFactorOf` (`step-decoding.library.plato:92`). Give it one name.
- **Iteration caps:**
  - 40 rounds or depth is written seven times (`refinement-attainable:72`, `triangulation-built:558`, `triangulation-neighbours-carried:222`, `discretization-ranged-bisection:296`, `discretization-edge-domain:324`, `termination-discretize:181, 209`);
  - the search cap 100 twice (`bspline-inverse.library.plato:78`, `bspline-along.library.plato:144`);
  - the polish halving cap 12 in the library and again assumed by a law (`bspline-polish.library.plato:173`, `bspline-polish.laws.plato:136`).
- **Half-period test, two forms with different boundaries:** `IsUnwrappedStep`/`IsUnwrappedIn` (`discretization.library.plato:558-568`) use `<=`, and `StepBelowHalfPeriod` (`uv-regions.library.plato:688-697`) uses `<`. Decide the boundary once.
- **Gauss-Legendre, two tables:**
  - `GaussNodes`/`GaussWeights` (`bspline-oracles.library.plato:37, 52`);
  - a 5-point table with fewer digits (`validation-oracles.library.plato:1067, 1071`), open-coded again in `AreaSegmentByQuadratureBody` and `VolumeSegment`.
  - Keep the first. Last digits may move, so rerun the oracle laws.
- **Resolution formula, three copies:** `ResolutionAt`, `ResolutionAtConstant` and `ResolutionAtByHalvingCounted` (`00-foundation`). Delete `ResolutionAtConstant`.

### 16. Witness models meshed several times per sweep; laws stated twice (small to medium, high)

- **The same three models meshed by several witness types:**
  - The unit box, the block with a hole and the hollow box are meshed at Oracle by `MeshedWitness` (`08-pipeline/pipeline-meshed-witness.library.plato:21`) and looped again by `LoopRunWitness` (`pipeline-run-witness.library.plato:38`).
  - The unit box and hollow box are meshed at Oracle a third time by `MaskMeshWitness` (`pipeline-mask-witnesses.laws.plato:22, 27`), whose laws read only the mesh.
- **Extra runs inside one witness:** `Witness_PlantedBadFaceRun` (`pipeline-meshed-witness.library.plato:48-55`) runs the loop twice and `InitialState` three times. `StatesOf` with `RunOutcomeFrom` does it once.
- **Duplicate claims:**
  - `Law_WitnessEdgeReversalPreservesMesh` duplicates `Law_EdgeReversalPreservesMesh`, and `Law_WitnessShellReversalNegatesVolume` duplicates `Law_ShellReversalNegatesVolume` (`pipeline-run.laws.plato:251, 259`). Drop the loop-run pair, because the runner reads the `Witness` forms.
  - The hollow-box volume claims exist three times. Keep the `HollowBox*Of` forms (`tooling-law-runner-once.library.plato:121-130`).
- **Duplicate helpers:** `LoopStates` is a rewrite of `StatesOf`.
- **Other layers:**
  - `Law_WitnessIsStructurallyClean`, `...ValidatesClean` and `...IsOracleClean` (`07-validation/validation-witnesses.laws.plato:61-71`) validate each witness three times, and Oracle-clean implies the other two.
  - `Law_BSplineTopAreaInBracket` and `Law_BumpTopAreaInBracket` overlap, at seconds of quadrature per case.
  - The B-spline basis laws are stated three times, once per curve kind (`geometry.laws.plato:287-360`). Check TKT-441's law list before merging them.
- **Laws that recompute what the witness holds:** `EveryStepHolds` (`pipeline-run.laws.plato:42`) recomputes `Step` although `States[i+1]` is that step.
- **Saves:** about 3 + 2·(E+1) mesh runs and two Oracle validations per sweep, where E is the number of edge reversals swept.

### 17. Per-component mesh measures scan the whole mesh once per component (small, medium)

- **Counts:** `CountsOfComponentIndexed` (`06-mesh/mesh-incidence.library.plato:266-282`) scans every edge, triangle, quad and vertex for each component, and `BoundaryEdgesOf` (`mesh-topology.library.plato:372`) rescans all edges.
- **Measures:** `AngleDefectSum`, `QuadAngleDefectSum`, `ComponentVectorArea`, `VectorAreaRoundingMagnitude` (`mesh-measures.library.plato:134-219`) and `SignedVolumeAbout` do the same.
- **Incidence built twice:** `ComponentCountsOf(mesh, t, comps)` (`mesh-topology.library.plato:272`) builds a second incidence although `ComponentsOf` built one.
- **Edge table built more than once:**
  - `IsClosed`, `IsManifold`, `IsConsistentlyOriented` and `EulerCharacteristic` (`mesh-topology.library.plato:158-168`) each sort the edge table.
  - The common pattern `IsClosed && IsConsistentlyOriented && EulerCharacteristic == 2` sorts it three times, in four law files.
- **Proposal:**
  - One pass bucketed by `ElementComponent` and `VertexComponent`.
  - Bind the incidence once, as `MeshComponentTablesCounted` already does.
  - Add an `IsClosedOrientedWithEuler(table, chi)` helper.
- **Saves:** a factor of C (the number of components) in evaluations.

### 18. Repeated work in the projection searches (small, high)

- **Closest-candidate rule, three evaluations per candidate:** `BestCandidate` and the reduce in `ProjectBySearchBody` (`01-geometry/bspline-inverse.library.plato:186-189`, `357-358`) are two copies of one rule, and each evaluates `eval(best)` twice per step. Use one helper over a distance array computed once; it saves 2 evaluations per candidate on every global `Project` and `ClosestParameter`.
- **Polish endpoints evaluated twice:** `PolishSample` (`:161-168`) evaluates the end slopes, and `PolishRoot` (`:117-118`) evaluates them again. Passing them in saves 2 `Eval` and 2 `Derivative` calls per polished sample.
- **`SearchWindow`** evaluates the anchor twice per doubling (`:78-79`).
- **"Keep the coordinate where it is free", three copies:** `KeepSeedWhereFree`, `StartWhereFree` and the tail of `ProjectNearBySearchCounted`. The copies use different slacks, so the owner picks one.
- **Polish wrappers:** there are four, and the two counted forms disagree on what `Evaluations` counts (`PolishProjectionCounted` reports iterations). Keep `PolishRunCached` and one `PolishProjection`.

### 19. Smaller duplicates (small, high unless noted)

**Same body twice:**
- The coincidence-cell neighbour scan is copied in `02-topology/topology-faceted.library.plato:51-104` and `06-mesh/mesh-coincident-gridded.library.plato:70-127`. Use one `CellNeighbourPairsCounted(cells, order, accept)` in `foundation-coincidence-cell.library.plato`, saving about 40 lines.
- `PcurveToCurveGapOnce` and `PcurveToCurveGapGiven` (`geometry-laws-once.library.plato:88-155`) differ only in where the pcurve range comes from.
- `face-meshing-domain-once.library.plato` has `...In` copies that keep separate bodies from their originals: `UnwrapCountedIn`, `WithPoleFreeParameterIn`, `LeftRuleCopyIn`, `IsOnLineIn`, `RegionToleranceIn`, `UnorientedRegionOfIn`, `MeshedOutcomeIn` and `MeshRegionOnce`.
  - `RefinedTriangulationIn` and `GridOrTrianglesIn` ignore their `tol` argument.
  - Make each original `=> m.XIn(f, m.SurfaceDomainOf(f), ...)`. Saves about 80 lines.
- `Diagnose` and `DiagnoseIndexedCounted` (`11-repair/repair-diagnosis.library.plato:215-249`, `repair-indexed.library.plato:324-357`) are the same 28-arm match.
  - `FacesTouchedBy` and its Indexed form are the same 21-arm match.
  - Production calls only the indexed forms, so define the scan forms through them. Saves about 70 lines.
- `FaceMeshTriangulation` is defined twice (`validation-checks-face-meshing.library.plato:285`, `09-tooling/tooling-dumps.library.plato:120`).
- `Check_ClosedMeshHasNoPinchedVertexHoisted` and `...WithTables` (`validation-checks-components.library.plato:86, 90`) are two fast forms of one check.

**Equality helpers:**
- Array equality is written 11 times in layer-8 laws files, and five more in layers 05, 06 and 11.
- NaN-aware number equality has five copies (`Identical`, `SameNumber`, `SameNumberOrNaN`, and two inline).
- `PerfSameVector` is `SameVector`, and `SameIntegers` is `IsSameIntegers`.
- Keep one generic helper in layer 0, about 50 lines.

**Repeated work in layers 02-03:**
- `PrepareModelWith` (`03-step/step.library.plato`) computes `UsedContextsOf` and `UnclampedLengthTolerance` twice (`:92`, `:274`, `:283`).
- `ModelSize` and `CoordinateExtent` each build `ModelPoints` (`:90-91`).
- Closure is decided per edge in `Reduced:140` and again per curve in `ClosureMarks:666`.
- `SupportedSchema` (`step-schema.library.plato:161`) is rebuilt per `IsA` call, about 400 entities each time. Confidence medium: the compiler may cache it.

**Tables and lists in layers 02-03:**
- The ten-table enumeration is written about 8 times (`topology-indices`, `step.library.plato:725-814`, `step-raw-witnesses.library.plato:70`, `Reduced:189`). Key it by `TableName`; confidence medium.
- The attribute accessors in `step-part21.library.plato` (`IsUnset`, `IsDerived`, `ItemsOf`, `TypedNameOf`, `ReferenceOf`) are 10-arm matches that `AttributeTag` and the `*Payload` projections already cover, about 55 lines.

**Restatements of existing functions:**
- `IsCoincident` (`topology.library.plato:712`) restates foundation's `Coincident`.
- `FlippedCoedge` (`step-loop-chaining.library.plato:43`) restates `Opposite`.
- `UseStartWithin` and `UseEndWithin` are mirror bodies.
- `FaceMeshElementCount`, `FaceMeshPoint` and `FaceMeshArea` (layer 06) restate layer-05 accessors.
- `HoldsFace`, `HoldsEdge` and `HoldsVertex` (`10-editing/editing-closure`) are one generic `Holds`.

**The C# host:**
- `ToShapeMesh` scans the whole file mesh once per body (`StepPlatoBodies.cs:14`).
- `MeshItem` computes `FacesOf` and the meshed and pending flags twice.
- The "face has elements" test is written in about eight places.
- `StepPlatoMesher.Refined` (lines 64-88) restates the layer-8 `Step`, and `Blocking` and `RefineCriteria` exist only in C#, so no law sees the host's loop.
- `StepPlatoTables.FaceOutcome` restates `FaceOutcomeInRange` and copies its message.
- The HOST-LIBRARY-THREW and FACE-POLY-LOOP messages are copied in `FaceTiming.cs`.
- `MeshPath` now has one variant.
- Confidence medium.

**Layers 07 and 10:**
- 366 report messages read "<law name in words> does not hold.", produced by a script (`genreports.py`) that was never committed. Deriving the text from `c.Law` would remove them. Low value.
- `KeepsRowNumbers`, `TopologicalKeepsRowNumbers` and `RenumbersOnlyFaces` (`10-editing/editing-script.library.plato:23-66`) restate which edits renumber. `AppliedInPlace` still builds a ten-table identity remap per edit. Medium-low; this is a design note.

## Suggested chunk order after version 1

- **Small, safe, mostly deletions:**
  1. Side-finding 1, then findings 6, 8 and 14a, one chunk per layer.
  2. The small half of finding 2 (2a).
  3. Findings 11, 15, 18 and 19.
- **Repeated work on swept paths:** findings 3, 1, 4, 16 and 17.
- **Wide renames and moves:** findings 7, 9, 10, 12 and 13, plus the decision on finding 5.

## Checked and found clean

- **Fast/reference pairs that a law still reads (deliberate):**
  - `RoundingUnitByHalving`, `SmallestNormalByHalving`;
  - `GaussNewtonStep`/`ProjectedStep`, `CompositeSegmentAt`/`CompositeLocal`, the curve `BSplinePointBody`/`BSplineDerivativeBody`;
  - `FoldedFaces`, `CoincidenceRootsPairwise`, `IsInTwoEdgeLoop`;
  - `CutSegmentCountByScan`, `IsStrictlyInsideOnGridReference`, `HoleBridged`/`EarClipped`/`IsEar`, `InCircleOf`, `TryInsertion` and the Local passes, `MeshRegionBody`;
  - `FacesAtVertexScanned`, `FacesOnCurveScanned`, `PieceCountByLabels`, `CoincidentVertexPairsPairwise`, `GlobalVertexOf`;
  - `PcurveSite`/`Curve2DSite`, the dense shell checks, `CheckedWitnessSeparately`.
- **Built once, as intended:**
  - the neighbour table per refinement (TKT-408);
  - closure marks on the live path;
  - `EdgeFaceTable` and `TwoEdgeLoopEdges` inside each `DiscretizeAll*` driver, apart from the extra builds in finding 4;
  - `ShellPolyEdgesOf` in `ShellEulerPlusBoundaryCycles`;
  - the model-mesh structure arm;
  - the component report;
  - `RunOutcomeFrom` and `DumpStagesOnce`;
  - the v1 gate's validation.
- **One live implementation each:** union-find, component labelling, coincidence grid, numbering, the refinement driver (`RefineToSurfaceByInsertionCarriedCounted`), and the hoisted guard (`CanEvaluateGiven`).
- **No shared index:** editing and repair do not each index the same mesh. Both work on the B-rep, and only repair builds an index, once per plan.
- **Constants defined once:**
  - the default tolerances in `step.library.plato:358-373`;
  - the coincidence-cell bound 1e14;
  - `GreenChords`;
  - the validation tolerance factors.
  - No tolerance literal (1e-9, 1e-6 and similar) is repeated across library files outside comments and witness fixtures.
- **Duplication on purpose:**
  - the C# `ContractCheck` and `MeshChecks` re-check geometry independently of the library, as their documents say;
  - the host's `Rows` and the harness's `Rows.Build` differ on purpose;
  - the harness's option parsing is in one place.
- **Not duplicates:**
  - the `X => XCounted(...).Value` convention;
  - the concept-implementation overload families (`LessThanOrEquals`, `Hash`);
  - `Moved` against `Scaled*`;
  - the limited and ill-formed `DiscretizationCriteria` literals in `pipeline-discretized-witness.library.plato:72-83`.
