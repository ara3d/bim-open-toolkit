# The STEP mesher: what has been built, 2026-10-22

Written at the owner's request as an inventory of the STEP B-rep mesher: the types it declares, the changes made to
the Plato language and its tools to make it possible, the laws and specifications that check it, and the algorithms
written. It reads the repository as of commit `003e25c0` (main, 2026-10-22) and the Plato repository at `11e63708`.
Counts are grep counts over the `.plato` files unless a row says otherwise; they may be off by a few percent.

The mesher is the epic TKT-323 (serving workflows 3 and 4 of `PROJECT.md`: a picture of a product model shown with
the building, and a STEP node pack). Its design pass was TKT-299 (2026-10-17); its version 1 contract, fixed by the
owner on 2026-10-21, is a mesh that is closed and watertight, oriented and covering, within the chordal bound, and
traceable to the face and parameter point of every vertex. Element quality is left to a later pass.

Related documents: `sandbox/step-brep-mesh/README.md` (the design), `TYPE-CATALOG.md` (the shopping list of types),
`PLATO-SPEC-EXTENSIONS.md` (the language proposal), `docs/plans/step-mesher-v2.md` (the chunk plan and ledger),
`docs/plans/step-mesher-status-2026-10-21.md`, the four reviews of 2026-10-22 (`-consolidation`, `-types-review`,
`-reliability`, `-algorithmic-performance`), and the corpus reports `docs/plans/step-mesher-corpus-*.md`.

## 1. In numbers

| What | Count | Source |
|---|---|---|
| Plato files in `sandbox/step-brep-mesh` | 572 (119 `.types`, 7 `.concepts`, 231 `.library`, 169 `.laws`, 46 `.spec`) | `find` |
| Lines of Plato | 94,213 | `wc` |
| Layers | 12 (`00-foundation` to `11-repair`) | folder list |
| Declared types | 535 | grep `type X` |
| Concepts (interfaces) | 28 | grep `interface X` |
| Libraries (named function blocks) | 409 | grep `library X` |
| Laws (`Law_` functions) | 1,478 | grep |
| Witnesses (`Witness_` builders) | 283 | grep |
| Oracles (`Oracle_` independent computations) | 23 | grep |
| Checks (`Check_` evidence builders) | 656 | grep |
| Generators (`Generate_`) | 9 | grep |
| Spec blocks and theorems in `.spec` files | 453 and 60 | grep |
| Bodiless functions in the shipped program (host obligations) | 29 | corpus report, 2026-10-22 late |
| Commits to the mesher folders since 2026-10-17 | 415 (23, 30, 25, 31, 100, 206 per day) | `git log` |
| Commits to the Plato repository since 2026-10-15 | 82 | `git log` |
| Generated C# (`Ara3D.StepBrep` in bim-open-data) | 1,509 files, 19 MB | `find`, `du` |
| Last corpus run: faces meshed | 192,446 of 192,453 in 88 u-blox files, 0 exceptions | corpus report, 2026-10-22 late |
| Last verdict sweep (2026-10-22, reliability report) | 1,325 verdicts: 1,188 pass, 33 fail, 6 error, 84 obligation, 14 skipped | `reviews/verdicts-cpu64.tsv` |

The staging folders under `sandbox/step-mesh-staging/` (58 tracks with a `TRACK.md`) hold almost nothing now: every
merged chunk moved into the library, and only two library files and two laws files remain unmerged there
(`v1-gate`'s cusp witness and law, and `polystrata-spike`).

## 2. The shape of the library

The design fixed the shape before any layer was written (`README.md`, "Decisions made before the layers were
written"). Each layer names only itself and the layers below it.

| Layer | Folder | Lines | Holds |
|---|---|---|---|
| 0 | `00-foundation` | 6,183 | tolerances as types, parameter ranges and periodic domains, typed indices, counts, signs, points by space, decided results, diagnostics and reports, work budgets |
| 1 | `01-geometry` | 10,990 | the curve and surface zoo of ISO 10303-42 as closed sums, natural parameterizations, evaluation, derivatives, inverse evaluation, B-splines, closure marks, jets and curvature bounds |
| 2 | `02-topology` | 4,802 | vertices, edges, coedges, loops, faces, shells, bodies as flat tables with typed indices; edge domains, sense composition, Euler-Poincaré, shell orientation, edge and site tables |
| 3 | `03-step` | 8,461 | the Part 21 file as data, the EXPRESS subset as a schema table, decoding, units and the file's tolerance, closure decided at decode, `PrepareModel` |
| 4 | `04-discretization` | 4,620 | one polyline per model edge under chordal, angular and length criteria; seeds, certified sagitta, bisection, refinement requests, termination |
| 5 | `05-face-meshing` | 14,889 | loops into parameter space with seams and poles, the trimmed region, collisions, constrained Delaunay triangulation, refinement by insertion, quad grids, lifting |
| 6 | `06-mesh` | 6,749 | the assembled mesh with provenance, numbering, edge table, components, quality, measures, conversions |
| 7 | `07-validation` | 15,226 | check families and conformance levels, cross checks, the Green's-theorem and divergence oracles, witnesses, defects, the corpus table |
| 8 | `08-pipeline` | 14,854 | the stages as total functions with result records, the refinement loop, options, the version 1 gate, corpus witnesses |
| 9 | `09-tooling` | 3,463 | the law runner, diffs, dumps (GLB, SVG, CSV), witness families and generators |
| 10 | `10-editing` | 2,359 | edits as data with inverses, Euler operators, selections, closure and invalidation |
| 11 | `11-repair` | 1,617 | defects diagnosed into repair actions, plans, policies, a ledger |

Inside a layer, file kinds follow the Plato stdlib convention plus two of the design's own: `*.concepts.plato`
(interfaces), `*.types.plato`, `*.library.plato` (functions), `*.laws.plato` (laws, witnesses, oracles), and
`*.spec.plato` (the invented constructs: invariants, contracts, theorems; read, not compiled).

Layers 00 to 08 compile to C# as `Ara3D.StepBrep` (`deps/bim-open-data/src/data/Ara3D.StepBrep`), regenerated by
one script from pinned commits (`tools/regen-step-brep.ps1`); the hand-written host `Ara3D.Step.Mesher` calls it
per edge and face, and the C# parser (`Ara3D.IO.StepParser`), the EXPRESS-generated `Ara3D.StepTypes` and the
decoder (`Ara3D.Step.Decode`) feed it a `RawDecodedModel`.

## 3. The types, grouped

535 types in 119 files. Each `.types.plato` file is one theme; the catalog's four habits run through them: one type
per space and per unit, a proof as a type, a decision as a sum, and edits, defects and repairs as data. The types
review of 2026-10-22 (TKT-435) found that about 240 of the catalog's types are declared but most are not yet on the
meshing path; that adoption is listed as follow-up work in section 7.

### Layer 0: foundation

| Theme | Types |
|---|---|
| Tolerances | `LengthTolerance`, `AngleTolerance`, `ParameterTolerance`, `UvTolerance`, `Tolerances` |
| Quantities and units | `ModelLength`, `Metres`, `SquaredLength`, `AreaMeasure`, `VolumeMeasure`, `Ratio`, `Fraction`, `PowerOfTwo`, `Resolution`, `MeasureKind`, `Measure` |
| Counts | `Count`, `NonZeroCount`, `SegmentCount`, `SampleCount`, `Round`, `Depth` |
| Signs and senses | `Sign`, `Sense`, `Parity`, `Winding` |
| Parameters, one per space | `CurveParameter`, `Curve2DParameter`, `EdgeParameter`, `KnotParameter`, `ArcLength`, `NormalizedParameter`, `WrappedAngle`, `UnwrappedAngle`, `ParameterRange`, `DirectedRange`, `PeriodicRange`, `IsoLine` |
| Points, one per space | `UvPoint`, `UvDelta`, `ChartPoint`, `ModelPoint`, `LocalPoint`, `UvBox`, `ChartBox`, `DomainCorner` |
| Domains | `Periodicity` (Aperiodic, Periodic, Closed), `CurveDomain`, `SurfaceDomain`, `DomainSide`, `SamplePlan` |
| Typed indices | `CurveIndex`, `Curve2DIndex`, `PcurveIndex`, `SurfaceIndex`, `BrepVertexIndex`, `BrepEdgeIndex`, `BrepLoopIndex`, `BrepFaceIndex`, `ShellIndex`, `BodyIndex`, `StepInstanceId`, `StepAttributeIndex`, `StepOccurrenceIndex`, `ElementIndex` |
| Slots (positions inside a row) | `BoundSlot`, `CoedgeSlot`, `EdgeSampleIndex`, `InteriorSlot`, `UvPointIndex`, `LocalVertexIndex` |
| Keys | `ElementSide`, `ElementSidePair`, `HalfEdgeKey`, `EdgeKey`, `SampleKey`, `TableName` |
| Index remaps (after an edit or reduction) | `BrepVertexRemap`, `EdgeRemap`, `LoopRemap`, `FaceRemap`, `ShellRemap`, `BodyRemap`, `CurveRemap`, `Curve2DRemap`, `PcurveRemap`, `SurfaceRemap`, `KernelRemap` |
| Decided results (a value or a reason, never a sentinel) | `UndecidedReason`, `DecidedNumber`, `DecidedAngle`, `DecidedLength`, `DecidedParameter`, `DecidedSign`, `DecidedClosure`, `DecidedUv`, `DecidedPoint`, `DecidedDirection`, `DecidedFaceIndex`, `DecidedEdgeIndex`, `DecidedRange`, `DecidedRound`, `KeepReason`, `TerminationCertificate` |
| Diagnostics and reports | `MeshVertexProvenance`, `Provenance`, `Severity`, `ConstraintGroup`, `LawName`, `Check`, `Diagnostic`, `Report` |
| Work and budgets | `TimeBudget`, `Elapsed`, `WorkBudget`, `Counted<T>`, `WorkClaim`, `CoincidenceCell` |

### Layer 1: geometry

| Theme | Types |
|---|---|
| The curve zoo | `BrepCurve` (line, circle, ellipse, hyperbola, parabola, polyline, B-spline, trimmed, composite, offset, surface curve), `BrepCurve2D`, `CompositeSegment`, `CompositeSegment2D`, `CurveSupport`, `PreferredRepresentation`, `Pcurve` |
| The surface zoo | `BrepSurface` (plane, cylinder, cone, sphere, torus, extrusion, revolution, B-spline, rectangular trimmed, offset), `TorusPart` (Full, Apple, Lemon), `SurfaceParameter` |
| Kinds and features | `CurveKind`, `SurfaceKind`, `Degeneracy`, `Seam`, `Seams`, `Pole`, `PoleSegment` |
| B-splines | `SplineBasis`, `BSplineCurveData`, `BSplineCurve2DData`, `BSplineSurfaceData`, `BSplineSpan`, `ControlPolygon`, `ConvexHullBound`, `Placement` |
| The arena (flat tables of geometry) and views | `GeometrySet`, `ClosureMark`, `ArenaCurve`, `ArenaCurve2D`, `ArenaSurface`, `CompositePlace` |
| Jets and curvature | `BrepCurveJet`, `CurvatureAt`, `CurvatureBound`, `ParameterSpeed`, `Sagitta`, `SurfaceFirstJet`, `PolishRun`, `SurfaceWindow` |
| Decided geometry | `SurfaceNormal` (Regular, Limit, Undefined), `Projection`, `ClosestParameterResult`, `ClosureDecision` |
| Proofs | `WellFormedBSpline`, `ClampedBSpline`, `OrthonormalFrame`, and their `Decided*` forms |

### Layer 2: topology

| Theme | Types |
|---|---|
| The cell complex | `EdgeOrientation`, `Coedge`, `BrepVertex`, `BrepEdge`, `BrepLoop` (edge loop, vertex loop, poly loop), `FaceBound`, `BrepFace`, `BrepShell`, `BrepBody` (manifold solid, solid with voids, shell set) |
| The model | `LengthUnit`, `BrepModel`, `ShellCounts`, `ShellCountsDelta`, `CoedgeSite`, `EdgeEnd` |
| Derived tables | `EdgeFaceTable`, `CoedgeSiteRows`, `EdgeUseTable`, `VertexCornerTable`, `KeyedSiteRows`, `ShellPolyEdges`, `ImplicitEdgeUseList` |
| Proofs | `InRangeModel`, `ResolvableModel`, `ChainedLoop`, `ClosedShell`, `OrientedShell`, `ConnectedShell`, and their `Decided*` forms |

### Layer 3: STEP

| Theme | Types |
|---|---|
| Part 21 as data | `StepHeader`, `StepAttribute`, `StepSimpleRecord`, `StepInstanceBody`, `StepInstance`, `Part21File`, `ParsedFile` |
| The schema model | `AggregateForm`, `AggregateBound`, `AttributeKind`, `ValueRule`, `AttributeDefinition`, `EntityTreatment` (Decoded, Ignored, Unsupported), `EntityDefinition`, `RecordSlot`, `StepKnotSpec` |
| Decoding | `StepSource`, `StepOccurrence`, `KernelSources`, `KernelElement`, `FoldCause`, `FoldRecord`, `StepRepair`, `RepairRecord`, `ProvenanceMap`, `ContextUncertainty`, `ContextUnits`, `DecodePolicy`, `DecodedModel`, `RawDecodedModel`, `DecodeResult` |
| Lookups and traces | `EntityName`, `AttributeName`, `EntityLookup`, `AttributeLookup`, `UnitFactor`, `AngleFactor`, `PlacementChain`, `ReferenceResolution`, `DecodeStep`, `DecodeTrace` |
| Diagnostics and proofs | `StepDiagnosticCode`, `StepFindingSubject`, `PreparedModel`, `DecidedPreparedModel` |

### Layer 4: edge discretization

| Theme | Types |
|---|---|
| The polyline | `DiscretizationCriteria`, `Limit`, `SegmentFloors`, `EdgeDiscretization`, `EdgeDiscretizations`, `EdgeImage`, `RefinementReason`, `EdgeRefinementRequest` |
| Requests and measures | `Chord`, `Arc`, `ChordMeasures`, `CriterionName`, `CriterionVerdict`, `SeedReason`, `Seed`, `SegmentDensity`, `DensityField`, `RequestSet`, `DiscretizationDelta`, `SplitDecision` |
| Bisection and refinement | `ImageAnchor`, `BisectionEnd`, `RaiseNode`, `RaisePiece`, `EdgeRequestIndex`, `DiscretizedWitness` |
| Proofs | `CompleteDiscretization`, `PartialDiscretization`, `CanonicalDiscretization`, `DirectedDiscretization`, `MeetsCriteriaProof`, and their `Decided*` forms |

### Layer 5: face meshing

| Theme | Types |
|---|---|
| Regions in parameter space | `UvPointSource`, `UvLoop`, `UvRegion`, `UvSample`, `FaceChart`, `QuadSides`, `FaceEdgeUse`, `LoopCrossings`, `BoundaryIndex`, `MeanSpeeds` |
| Collisions | `RegionSegment`, `SegmentBox`, `SegmentGridEntry`, `ChartGrid` |
| Triangulation | `UvTriangulation`, `ConstraintSource`, `Constraint`, `ConstrainedTriangulation`, `Cavity`, `NeighbourTable`, `DelaunayCertificate`, `EarCandidate`, `Bridge`, `PositionedTriangulation`, `PositionedTriangulationWithNeighbours`, `TriangleWrites`, `SlotWrites`, `TrialInsertion`, `CarriedRefinement`, `TriangulatedWitness` |
| Refinement | `ElementInChart`, `ElementDeviation`, `RefinementTarget`, `PointNormals`, `CentroidTest`, `SideSample`, `BumpTop`, `StripCase` |
| Seams and poles | `SeamCopy`, `SeamPair`, `PoleRun`, `PoleLune`, `PoleLoopCase`, `FlatMarksCase` |
| Quads and element shape | `ElementShape`, `QuadSplit`, `QuadSplits`, `GridChordalDecision`, `GridCase`, `QuadGridSides`, `GridCounts`, `QuadGridOutcome` |
| Lifting | `LiftTable`, `SourceKey`, `LiftBranch`, `LiftCase` |
| Outcomes and decisions | `FaceMeshingCriteria`, `FaceMesh`, `FaceMeshOutcome`, `FaceMeshResult`, `InsertionRejection`, `InsertionAttempt`, `FlipRejection`, `FlipAttempt` |
| Proofs | `SimpleUvLoop`, `ClosedUvLoop`, `OrientedUvRegion`, and their `Decided*` forms |

### Layer 6: the assembled mesh

| Theme | Types |
|---|---|
| The mesh | `ModelMesh`, `MeshVertexSite`, `MeshVertexNumbering`, `CornerAttribute<T>`, `ElementKind`, `ElementRef`, `ElementCorners`, `ProvenanceIndex`, `ElementProvenance`, `MeshSlice` |
| Topology | `MeshEdgeTable`, `MeshComponentIndex`, `MeshComponents`, `MeshComponentCounts`, `ComponentRootTables`, `MeshComponentTables`, `VertexIncidence`, `Crease`, `CreaseSet`, `BoundaryCycle`, `BoundaryCycleList`, `NonManifoldEdge`, `PinchedVertex`, `MisorientedEdge` |
| Quality | `TriangleQuality`, `QuadQuality`, `MeshQualityThresholds` |
| Conversions and witnesses | `QuadMeshOutcome`, `SplitTriangleMesh3D`, `AssembledWitness`, `AssemblyWitness` |
| Proofs | `MeshedFaceSet`, `FullyMeshedModel`, `WatertightMesh`, `CheckedMesh`, `QualityGradedMesh`, `PlanarQuad`, `ConvexQuad`, and their `Decided*` forms |

### Layer 7: validation

| Theme | Types |
|---|---|
| Levels and families | `ConformanceLevel` (Structural, Geometric, Oracle), `CheckFamily`, `CheckScope`, `PairBudget` |
| Claims and evidence | `Claim`, `Evidence`, `CheckRecord`, `AllowanceSource`, `Allowance`, `CompensatedSum`, `OracleAgreement` |
| Oracles | `GreenSegment`, `GreenPath`, `TrigCoefficients`, `GreenEstimate`, `ManifoldShellCase` |
| Witnesses and corpus | `WitnessFacts`, `ExpectedMeasure`, `SampleGrid`, `Expectation`, `LevelProof`, `CorpusFeature`, `CorpusCount`, `CorpusEntry`, `PoleWitness`, `ProfileCorner`, `ArenaCase`, `RawAndDecoded`, `ForcedDegenerateExplanation` |
| Defects | `Defect` (26 cases), `DefectClass`, `Locality`, `DecidedDefect`, `DefectReport` |
| Proofs | `ValidatedReport`, `DecidedValidatedReport` |

### Layer 8: pipeline

| Theme | Types |
|---|---|
| The run | `MeshingOptions`, `PipelineState`, `MeshOutcome`, `StepMeshOutcome`, `MeshResult` (Succeeded, Incomplete, Failed) |
| Trace | `MeshingEvent`, `Trace`, `RunKey`, `Pending`, `Incremental` |
| Witnesses of runs | `V1GateWitness`, `CappedWitness`, `FaceOutcomesWitness`, `MaskMeshWitness`, `MeshedWitness`, `FailedFaceWitness`, `LoopRunWitness`, `CostlyLoopRunWitness` |

### Layer 9: tooling

| Theme | Types |
|---|---|
| Law runner | `LawVerdict`, `RunStage`, `LawRun`, `LawReport`, `NamedModel`, `NamedMesh`, `ResultTable`, `CheckedWitness`, `CheckedWitnessPair`, `HollowBoxVerdicts`, `StageDumpPair`, `WitnessSpec`, `VerdictDelta` |
| Diffs | `CellValue`, `Difference`, `SlotDifference`, `RowDifference`, `LocatedDifference<T>`, `ModelTable`, `DiscretizationTable`, `MeshTable`, `ReportTable`, `FileTable`, `ModelDiff`, `DiscretizationDiff`, `MeshDiff`, `ReportDiff`, `FileDiff` |
| Dumps | `ProvenanceCode`, `FacePart`, `MeshDump`, `SvgMark`, `SvgLayer`, `SvgDocument`, `StageDump`, `StageOutcome<T>`, `RowDump`, `DiffSummary`, `Benchmark`, `CorpusRow` |
| Generators | `BoxFamily`, `CylinderFamily`, `SphereFamily`, `SphereForm`, `TorusFamily`, `ConeFamily`, `BlockWithHoleFamily`, `HollowBoxFamily`, `BSplinePatchFamily`, `FixedWitness`, `WitnessFamily`, `Perturbation` |

### Layer 10: editing

| Theme | Types |
|---|---|
| Edits as data | `GeometricEdit`, `TopologicalEdit`, `ToleranceEdit`, `ModelEdit`, `FaceUse`, `EulerOperator`, `EditPrecondition`, `EditOutcome`, `EditScript`, `ScriptOutcome`, `Transaction` |
| Selection and invalidation | `Selection`, `SelectionClosure`, `Anchor`, `Invalidation`, `MeshPatch`, `EditPreview`, `Dirty` |

### Layer 11: repair

| Theme | Types |
|---|---|
| Diagnosis | `RepairAction` (22 cases), `RepairCost`, `Fixability`, `GapClosure`, `SeamRepair`, `StepRepairProjection`, `FaceRows`, `RepairIndex` |
| Plans | `RepairStep`, `RepairPlan`, `RepairPolicy`, `RepairOutcome`, `RepairEntry`, `RepairLedger`, `HealedModel` |

### The 28 concepts

| Layer | Interfaces |
|---|---|
| 0 | `IScaled`, `IMoved`, `IReversible`, `IHasDomain<TDomain>`, `IIndexedTable<TIndex, TRow>`, `IToleranced`, `IHasProvenance`, `IBudgeted` |
| 1 | `INaturalCurve3D`, `INaturalCurve2D`, `INaturalSurface`, `IHasCurveDomain`, `IHasSurfaceDomain`, `IEvaluableCurve3D`, `IEvaluableCurve2D`, `IEvaluableSurface`, `IDifferentiable1`, `IDifferentiable2`, `IProjectable3D`, `IHasClosedFormArea`, `IHasSeams`, `IHasPoles` |
| 7 to 11 | `ICheckable`, `ITraced`, `IDiffable`, `IWitnessed`, `IEditable`, `IRepairable` |

Plato interfaces are type classes with no heterogeneous collections, so the geometry zoo is closed sums
(`BrepCurve`, `BrepSurface`) and every algorithm is an exhaustive `match`; the interfaces say what an operation needs
(evaluate, differentiate, project), and the arena views (`ArenaCurve`, `ArenaSurface`) implement them by delegation.

## 4. Changes to Plato and its tools

The mesher is the first large program written in Plato, and it drove 82 commits to the Plato repository in a week.
They fall into three groups: the language, the tools that run laws, and the C# backend.

### 4.1 Language

| Change | Ticket | Plato commit | Why the mesher needed it |
|---|---|---|---|
| `Number` is an abstract real bound by a per-compilation profile: `cpu64` (binary64, default) or `gpu32`; `Integer` is 64-bit under cpu64, exact within ±(2^53 − 1) | TKT-315 | b875bbc0, 80e7f207, 78be1798 | coordinates of a building in millimetres exceed a 24-bit mantissa; B-spline knot arithmetic is worse. Every check ran under `gpu32` until 2026-10-19 |
| `&&` and `||` short-circuit on `Boolean` in the interpreter and every backend | TKT-442 | 33604a12 | five defects, among them the corpus throw of TKT-411 (`winding.Count == 2 && loops[winding[1]]` read index 1 of a one-entry array); 109 guard sites written as conditionals because of it |
| `sealed by F, G`: a type names the only functions that may construct it; elsewhere CHK311 | TKT-444 | 3b89ce8a, 97581899, 11e63708 | proof types (`CheckedMesh`, `ClosedShell`) were convention only; anyone could build one. The law runner draws a sealed type only from its generators, named constructors or witnesses |
| A type with a `Generate_` function is drawn only from its generators, never field by field | TKT-446 | 7859fdce | the runner built `LengthTolerance(0)` and `-0.5` and failed at least 25 laws that were not wrong |
| A law's `Premise_` companion is counted; a law whose premise never held is vacuous and fails | TKT-437 | 00610b70 | guard-dominated laws (`pre ? claim : true`) passed on inputs where the guard never held |
| The checker no longer wraps a bare `Number` into a one-field type at a return; the legacy transforms construct their wrappers | TKT-445 | 5096cd1c, 78a7776d | every typed wrapper (`ModelLength`, `CurveParameter`) rested on a leak that accepted a `Number` where the wrapper was declared |
| `TriangleFace` and `QuadFace` refuse a corner index out of range instead of returning the last corner | TKT-447 | cf6b2122 | an off-by-one in corner arithmetic was silent |
| A `match` on a call to a later library's function finds its sum type (was a silent degrade to a throwing stub) | TKT-410 | 0ef7e686 | 24,439 B-spline and 20,684 surface-curve edges lost in one corpus run |
| Generated `Equals` compares array fields element by element | TKT-355 | c8c83c8b | a B-spline witness differed from itself once compiled |

The proposal `PLATO-SPEC-EXTENSIONS.md` (2026-10-17) lists what the library would still like: `implies`, bounded
quantifiers `all` and `any`, identity `===`, tolerance comparisons typed by `ITolerance<M>`, `invariant` on types,
derived `CanConstruct`, `requires` and `ensures` on functions, `decreases`, `deferred "<family>"`, `reference`
bodies, `law`, `theorem`, `witness` and `generator` declarations. Of these, short-circuit operators, sealing and
generators have landed; the rest are still written in the spec DSL of section 5.

### 4.2 Running laws

| Change | Ticket | Plato commit | What it gives |
|---|---|---|---|
| The interpreter: a TIR evaluator, host intrinsics, a law runner and `plato run --laws` | TKT-317 | f256b068, 1e22c813, 2908660d | laws run without a C# build; the first results came the day the layers were written |
| Interpreter speed on whole-model laws: a call memo, a per-function profile, memoized run-time resolution, boxed Booleans and small Integers once, fewer allocations per call | TKT-332 | 93907bd7, ad14b152, b31cbfae, 8f741e0b, 3a01b55a, 93ba7552, 90685d9a | whole-model laws went from minutes to seconds; a 60 s then 120 s budget per law |
| Verdict files (`--report`), a regression check against one (`--baseline`), filters by `Owner.Law_Name`, a per-law budget (`--budget`), witnesses matched on the whole type | | acbc9b94, 69dcb960, a966dfc4, 062b8dc7 | `reviews/verdicts-cpu64.tsv` is the baseline every merge is checked against |
| Warm law runs on the navigation MCP server: one compilation kept between runs, changed files re-checked, one program per folder set, a parse error is an error and never an empty run, a busy program answers busy after a bounded wait, compiled programs unloaded and runs bounded | TKT-331, TKT-344, TKT-337, TKT-479 | 38f2031a, f22b36b0, 5776a36e, 60134758 | a one-body edit answers in about 5 s instead of a 25 s cold compile; a track with a missing semicolon no longer reports "0 laws" to every other track |
| The compiled law runner: `plato run --backend=csharp` emits with the C# writer, compiles in process, runs every law on all cores under a 2 s budget and prints the time per law; the warm server takes `backend=csharp` | TKT-354 | 731adb72, ba5b9d66, e37c032f | laws run on the code that ships, not only in the interpreter |
| The differential run: `plato run --laws --differential` runs every law and witness in the interpreter and on compiled C# and reports each disagreement | TKT-438 | ec51f061, 9d014311 | seven of the forty mesher defects were in the generated C#, invisible to the interpreter |
| Symbol ids unique across threads, so concurrent compilations no longer report a false circular expression | TKT-478 | a7aeeb36 | several tracks compile at once on the warm server |

On the toolkit side, `sandbox/step-brep-mesh/tools/plato_laws.py` speaks the server's HTTP transport directly (for
sessions that started before the tool existed), fails on skipped laws, reruns budget errors alone with a longer
budget, and writes a coverage table; `law_lint.py` finds guards that do not guard; `check_generated.py` fails on a
throwing stub in the generated code; `compile-layers-00-08.sh` is the merge check with the stdlib tiers and the
excluded files read from `shipped-program.txt`; `laws_corpus_table.py` tabulates a corpus run; `PlatoGate/` is the
C# gate program of the design pass.

### 4.3 The C# backend

| Change | Ticket | Plato commit |
|---|---|---|
| Six writer defects found by the first generation: sum equality and hashing read only the active case, names the Array library declares, the `IIndexable` library for arrays, Plato names that are C# keywords, statementizing only when a lambda capture is hoisted, the Integer step in a typed-index subscript, parentheses of a conditional used as a condition | TKT-311 | 54a3996a, a2d41c7b, ced94312, cb274ffc, c0abb82a, 3d5d21d9, 5c2ad367 |
| A library function whose first parameter is `List<T>` or `Buffer<T>` is emitted | TKT-347 | 128cf769 |
| `MapRange` computes each element once (materialised, not a lazy list); a `Buffer`'s slots hold the element default | TKT-350, TKT-332 | dcbec43d, 8cbf8894 |
| A function-typed first parameter and a lambda receiver emit C# that compiles | TKT-353 | bac65e1c |
| Every bodiless function outside the host contract gets one throwing stub; a constructor call of a generic type writes its type arguments | plato-459, TKT-315 | 8848409c, f4f62b00 |
| Number literals spelled exactly for the profile | | 2eb70fb3 |

## 5. The laws and specifications

### 5.1 The conventions

`SPEC-DSL.md` fixes how the library states a rule. Real Plato carries the truth content; the spec files carry the
status of each statement.

- **`Law_<Name>(…): Boolean`** is a statement about all values of its parameter types. Preconditions are a leading
  guard, `pre ? claim : true`, never `pre && claim` (written before TKT-442 landed). A law is total, pointwise over a
  continuous parameter, names every tolerance it uses from a `Tolerances` or criteria value (no literal epsilon),
  uses `==` only on integers, indices, tags and copied values (`// exact by construction`), and says one thing.
- **`Witness_<Name>(_: T, …): T`** builds a well-formed example; laws over constrained types run over witnesses,
  because random instances are garbage.
- **`Oracle_<Name>`** computes a quantity by an independent route and never calls the code it checks.
- **`Check_<Name>`** evaluates one named law over one value, sampling deterministically, and returns a `Check`
  (law name, held or not, worst measure, where). 656 of them feed layer 7's reports.
- **`Generate_<Type>(seed)`** and **`Premise_<Law>`** are the runner's companions, added with TKT-446 and TKT-437.
- **`spec <Type> { invariant …; constructor …; }`**, **`spec <Function> { requires …; ensures …; }`** and
  **`theorem <Name> { … because …; }`** are the invented constructs, read until a checker exists: 453 spec blocks and
  60 theorems.

### 5.2 Laws per layer

| Layer | Laws | Witnesses | Oracles | Generators | Spec files | Notable families |
|---|---|---|---|---|---|---|
| 00 | 149 | 6 | 0 | 5 | 5 | `Wrap*` (wrapping is idempotent, lands in the period, is the canonical representative), `WorseOf*` (the fold over checks is associative and keeps the greater exceedance), `Work*` (budgets decrease or terminate), tolerance positivity, index and remap round trips, sign and sense algebra |
| 01 | 194 | 5 | 5 | 0 | 6 | references in range and acyclic, points match definitions, derivatives match finite differences, `SurfaceRepeatsWithPeriod`, trimmed and composite ranges, B-spline evaluation and inverse (`Project*`, `ClosestParameter*`), closure marks, jets, polish, area elements per surface |
| 02 | 42 | 0 | 1 | 0 | 2 | loops chain, vertex link is one cycle, seam uses run opposite, shells orientable and connected, solid shells declared closed, rigid motion and scaling laws, poly loops |
| 03 | 210 | 12 | 0 | 4 | 4 | 109 `Law_Where_*` (ISO 10303-42 WHERE rules over the file), units and tolerance (`UnitFactorRoundTrips`, `UncertaintyDefaultExactlyWhenAbsent`, `ToleranceCoversStatedUncertainties`), closure decided by ends and sides, decode totality and repairs, raw witnesses, generator seeds |
| 04 | 57 | 0 | 0 | 0 | 4 | `SagittaWithinChordal`, `TurningAngleWithinAngular`, `TangentDeviationWithinHalfAngular`, `SegmentWithinMaxLength`, `SegmentFloorMet`, `TighterChordalNeverFewerPoints`, reversal invariance, refine never coarsens, termination |
| 05 | 146 | 92 | 0 | 0 | 4 | unwrap moves by whole periods and keeps sources, winding signs, seam uses on opposite copies, triangulation keeps its boundary, every point is a corner, Delaunay and refinement agreement laws, pinch and zero-width cases, 16 `V1Gate` and 12 `V1Faces` laws |
| 06 | 120 | 14 | 0 | 0 | 10 | numbering by provenance, assembly, edge table canonical and sorted, components, angle sum and aspect ratio, vector area vanishes on a closed mesh, quad splits keep positions and area |
| 07 | 212 | 58 | 18 | 0 | 4 | witness facts (`WitnessHasStatedCounts`, `WitnessEulerIsTwoMinusTwiceGenus`, `WitnessGreenAreaMatchesFacts`, `WitnessDivergenceVolumeMatchesFacts`), checks agree with laws, levels imply lower levels, oracles against closed forms, poles and bands, 30 `V1Gate` laws |
| 08 | 271 | 98 | 0 | 0 | 3 | the loop (every step holds, pending requests are refinable, failure is isolated), witness runs (`WitnessMeshesOk`, `WitnessMeshValidatesClean`, reversal negates volume, scaling by a power of two), 28 `V1Edges`, 18 `V1Jody`, 16 `V1Gate`, 9 `V1Proof`, 6 `V1Reliability`, corpus witnesses |
| 09 | 32 | 13 | 1 | 0 | 2 | diffs are `Same` exactly when the Boolean equality holds, verdict deltas, generators draw in range |
| 10 | 43 | 0 | 0 | 0 | 1 | script inverse undoes, remap is identity for geometric edits, refused leaves the model unchanged, face quality laws (`SurfaceEdgeNormalTurnWithinSurfaceAngular`) |
| 11 | 20 | 1 | 0 | 0 | 1 | plan has a step per fixable defect, structure before geometry, local repair touches at most two faces, strict policy refuses topology change, STEP repair round trips |

### 5.3 Witnesses, oracles and theorems

**Witnesses.** Ten positive models (unit box, cylinder, sphere, sphere by pole loops, torus, torus at a vertex,
cone, hollow box, block with a through hole, B-spline patch solid), three negative ones (box with a flipped face,
box with a poly-loop sheet, two boxes sharing a corner), one with a planted bad face, each with its counts, genus,
areas and volumes from closed forms (`WitnessFacts`); the operation witnesses of the gallery (`Witness_BossMeshed`,
`Witness_ChamferMeshed`, `Witness_CounterboreMeshed`, `Witness_CrossHoleMeshed`, `Witness_FilletMeshed`,
`Witness_HexagonMeshed`, `Witness_LBracketMeshed`, `Witness_RevolvedBarrelMeshed`, `Witness_SlotMeshed`,
`Witness_TubeMeshed` and twelve more); capped cylinders and spheres at several segment counts; `*Work` witnesses
that claim an operation count (`Witness_RefineIndexedWork`, `Witness_UnwrapLoopsWork`); and since 2026-10-22,
witnesses extracted from corpus faces by `step-corpus-harness extract` (`Witness_AnnMb2Face349`,
`Witness_OdinW160Face3364And3398`, `Witness_JodyW5W6Faces322And444And584`, `Witness_C211Needle81`, and seven more),
so a corpus defect becomes a law.

**Oracles.** `Oracle_FaceAreaByGreen`, `Oracle_DivergenceVolume`, `Oracle_BodyVolume`, `Oracle_PlanarFaceArea`,
`Oracle_EulerCharacteristic`, `Oracle_AngleDefectSum`, `Oracle_QuadDefectSum`, `Oracle_EdgeLength`,
`Oracle_FacePerimeter`, closed forms for the cylinder patch, cone patch, sphere, sphere zone, torus and torus patch,
and the B-spline point oracles that evaluate by the Cox-de Boor recursion independently of de Boor's algorithm.

**Theorems** (60, in the spec files, each with a justification): `SharedPolylineClosesEveryEdge`,
`WatertightByConstruction`, `WatertightByNumbering`, `MeshEulerEqualsBrepEulerByConstruction`, `DiscreteGaussBonnet`,
`DiscretizeTerminates`, `LoopTerminates`, `EvaluationTerminates`, `TurningAngleBoundedByTangentDeviation`,
`ChordalRefinementIsMonotone`, `ElementsTileRegion`, `DroppedTrianglesArePoleSegments`, `FailureIsIsolated`,
`PlantedFaceFailsAlone`, `ProvenanceIsBijection`, `GreenAreaExactOnStraightLoops`,
`RichardsonBoundsTheDifferenceError`, `SignedVolumeSignIsOrientation`, `ClosedOrientableShellHasEvenEuler`,
`DepthBelowFuelIffAcyclic`, `ReportsFormAMonoid`, `IsCleanIsAMonoidHomomorphism`, and the rest named in the spec
files.

### 5.4 What the laws found, and what they missed

The reliability report of 2026-10-22 counts 40 defects in the mesher or its generated code since 2026-10-17. A law
caught 9, and only 5 of those in time; the corpus run and public samples found 15, the C# build and timing 8, a
compiled sweep 3, the gallery by eye 2. The five reasons that account for 33 of the 40: witnesses did not reach the
corpus's cases (13), the C# differed from the interpreter (7), the host meshed with settings the laws never saw (5),
budget errors hid failing verdicts (5), compiler output degraded silently (3). Each reason now has a counter: corpus
faces extracted as witnesses, the differential run, `HostMeshingOptions` as the one definition of the host's
options, budget reruns, and the stub check.

The types review of the same day classes 58 defects by root cause: sentinel or default value (11), algorithm logic
(7), flag instead of proof (6), performance (6), wrong unit or space (5), index confusion (5), non-short-circuit
`&&` (5), wrong tolerance (5). It judges that a type or language feature would plausibly have prevented 41 of them,
18 with high confidence, which is why TKT-442, TKT-444, TKT-445, TKT-446 and TKT-447 went to Plato.

## 6. The algorithms

Every function with a body is a specification or an algorithm; 29 host obligations (`ParseStep` and the like) stay
bodiless in the shipped program. The consolidation review notes that many fast forms keep a reference form beside
them, tied by an agreement law (`Law_*Agrees`), which is how 41 performance chunks changed hot loops on 2026-10-21
without changing a corpus file's output byte.

### Layer 1: geometry

- **Evaluation of every ISO 10303-42 curve and surface** in natural parameters: lines, conics (hyperbola and
  parabola evaluated, not rejected), polylines, trimmed and composite curves (chained by parametric length,
  `transition_code` dropped), offset curves and surfaces (second derivatives deferred), surface curves following
  their master representation, and the surfaces of revolution and linear extrusion.
- **B-splines** (`BsplineEvaluation`): de Boor's algorithm on homogeneous control points, so rational and
  polynomial splines are one formula; derivatives of order 1 and 2 by the homogeneous quotient rule; tensor-product
  evaluation and mixed partials for surfaces; span location, Bézier control extraction per span; a local evaluation
  that reuses the span (`BsplineLocalEvaluation`); the sides of a surface as curves (`BsplineSides`).
- **Inverse evaluation** (`BsplineInverse`, `BsplineInverseAlong`): closed forms for the plane, cylinder, cone
  (both rulings compared), sphere and ring torus; for everything else a sampled search per piece between break
  knots (`CurveSamplesPerPiece`, `SurfaceSamplesPerPiece`), a window that doubles outward on an unbounded domain
  (`SearchWindow`), minimization over the cuts of a periodic domain, then a Gauss-Newton polish with a halving step
  (`PolishProjection`, `PolishRoot`), seams wrapped, and `ProjectNear` keeping the seed's coordinate where the point
  does not determine one (a pole, an axis).
- **Closure** (`BrepGeometryClosureMarks`): closure of a clamped B-spline decided from its end control points and
  knots, never by evaluation, recorded once in the arena as a `ClosureMark`; a `Closed(Period)` periodicity that the
  seam reasoning treats like a periodic direction.
- **Jets, curvature and sagitta** (`BrepGeometryJets`, `BsplineSagitta`): first and second jets, curvature at a
  parameter, a curvature bound per span by the convex hull of the control polygon, a certified sagitta per chord.
- **Placements and handedness**: a mirrored placement is legal, the kernel normal follows the parameterization,
  and the closed-form normals multiply by the frame's handedness.
- **Acyclicity by capped depth**: references between arenas are checked by a depth count capped at one more than
  the arena size (pigeonhole), since index order cannot be stated across tables.

### Layer 2: topology

- **The edge domain** (`EdgeDomain`): the range of an edge in its curve's increasing parameter whatever its
  `SameSense`, with the closed-curve join and periodic wrap handled, and a pcurve's range built from the space
  curve's range and its parameter period (`PcurveRangeOver`).
- **Sense composition**: a coedge's direction on its curve as the composition of the edge's, the coedge's and the
  bound's senses (`CoedgeRunsForwardOnCurve`); the face normal sign against `PartialU × PartialV`.
- **Euler-Poincaré with reduced counts**: raw cell counts corrected for degenerate edges, redundant vertex loops
  and seams (`ReducedCounts`, `ShellEulerPlusBoundaryCycles`), verified on nineteen worked examples in the math
  review.
- **Shell orientation by adjacency** (`BrepShellOrientation`): the faces to flip so every edge is used twice in
  opposite directions, found by a walk over the edge-use table; connected components of a shell by vertex.
- **Tables** (`BrepEdgeTables`, `BrepShellTables`, `BrepKeyedSiteRows`): the edge-to-face table, coedge site rows
  and edge-use table by counting sort (count, prefix sum, cursor fill), built once per model or shell.
- **Faceted shells** (`BrepFacetedShells`): poly loops reduced to implicit edges keyed by point rank, with a
  coincidence grid over cells to merge points within tolerance.
- **Rigid motion and scaling by a power of two** of a whole model, with laws that positions and extents follow.

### Layer 3: STEP

- **The Part 21 file as data** (`Part21Reading`): typed accessors over attributes (reals, integers, strings,
  references, enumerations, lists, unset and derived), complex instances, structural equality of files.
- **The schema table** (`StepSchemaTable`, `StepSchemaModel`): about 400 entities classed Decoded, Ignored or
  Unsupported, with attribute kinds, bounds and defined-type rules, and the 109 WHERE rules as laws.
- **Decoding** (`StepDecoding`, `StepReading`): references followed down from each occurrence's representation
  through definitional representations, stopping at representation maps; placement chains composed for assemblies;
  orientation folds (`oriented_edge`, `oriented_face`, `oriented_shell`, a negative-determinant transform) recorded
  with a parity (`StepFoldParity`); each entity decoded by an exhaustive match into one kernel element; a provenance
  map back to instance numbers.
- **Units and the tolerance**: angles to radians once (a degree factor within 1e-8 of π/180 snapped), lengths to
  millimetres, the length tolerance as the largest stated uncertainty among used contexts, else 1e-6 of the model
  size, never below the resolution at the coordinate extent.
- **`PrepareModel`** (`Reduced`): vertices merged within tolerance by union-find roots, zero-length edges dropped,
  closure decided per curve and per surface direction, loops re-chained when a sense was written backwards
  (`StepLoopChaining`), shells sewn back when a file left them unsewn (`V1JodyShellSewing`), loose double sheets
  removed (`V1JodyDoubleSheets`), wrapped spline closure (`StepWrappedSplineClosure`).

### Layer 4: edge discretization

- **Seeds**: the parameters every discretization must contain (domain ends, polyline vertices, composite joints,
  distinct knots, copies of a closed curve's join), merged within the per-point parameter tolerance.
- **The certified sagitta**: closed form for lines, circles and ellipses; for every other curve the largest
  control-point distance from the chord per Bézier span, subdivided until within tolerance.
- **Bisection under three criteria** (`EdgeDiscretizing`, `EdgeRangedDiscretizing`, `BisectionCached`): a segment
  is split at its parameter midpoint while its sagitta exceeds the chordal bound, its tangent deviation half the
  angular bound, or its length the maximum, and only when both halves stay above the length floor; the conic path
  takes a closed-form count; count floors (at least 3 on a closed edge, 2 in a two-edge loop, one chord per third
  of a turn) beat the length floor; every criterion is widened by the file's own tolerance.
- **The two-space criterion**: each face's parameter-space image of the polyline (`ImagePoints`, unwrapped within
  half a period of its predecessor, a pole's free parameter taken from its neighbour, anchored by ranged bisection
  on the pcurve) must stay within the chordal bound of the 3D chord, measured in 3D.
- **One polyline per edge, oriented in one place** (`AlongCoedge`), so two faces read bit-identical points in
  opposite orders; `Reversed` copies.
- **Refinement by request** (`Refine`, `EdgeRefineIndexed`, `RaisedToCount` by a heap): a face's requests combine
  (smallest chordal, largest count), old parameters are kept so refinement never coarsens, unrequested edges stay
  bit-identical.
- **Termination certificates** (`TermDiscretize`): every loop carries a measure that strictly decreases or a
  bound it reaches.

### Layer 5: face meshing

- **Loops into parameter space** (`LoopToUv`, `ImageInFace`): a pcurve when the edge has exactly one on the face's
  surface and is not a seam, else projection; the parameter found by one-dimensional inverse evaluation on the
  lifted pcurve.
- **Unwrapping through the covering map** (`Unwrap`, `UnwrapIndexed`): each point moved to the copy nearest its
  predecessor, and on a model seam the second use placed by the left rule (the face lies to the left of every
  coedge), with twin steps found by a sorted step key instead of a quadratic scan.
- **Synthetic seams and poles** (`AddMissingSeamsAndPoles`, `CutWholePeriods`, `WithPoleSegments`, `PolesSegments`,
  `PolesWholePeriods`): a cut between winding loops or to a pole when the file has none; a pole blown up into the
  segment of the collapsed line between where the boundary arrives and leaves; whole-sphere and whole-torus faces.
- **Orientation and winding** (`OrientRegion`, `Winding`, `UWinding`, `VWinding`): signed chart area normalizes
  outer loops positive and holes negative; winding counts classify band pairs and lunes.
- **The chart** (`FaceChart`, `ChartSpeeds`): u and v scaled by the face's mean surface speeds over three
  iso-lines of twenty steps, so decisions are made in a near-isometric plane while every acceptance test is in 3D.
- **Collisions** (`UvRegionCollisions`, `FaceMeshingCollisions`): boundary segments bucketed into a grid of boxes;
  pairs closer than the region's tolerance become `LoopSelfIntersects` requests; a region is refused only for a
  proper crossing or a T-touch, pinches judged by winding (`V1EdgesWeaklySimple`).
- **Point location** (`UvBoundaryIndex`, `UvBoundaryIndexInside`, `InsideOnGrid`): a boundary index on a grid,
  a crossing count per cell for the strictly-inside test.
- **Triangulation of the region**: ear clipping with holes bridged to the rightmost point (`EarClipped`,
  `HoleBridged`, `IsEar`), then the constrained Delaunay triangulation (`TriangulationCdt`,
  `TriangulationCdtIndexed`): the `InCircle` test with a scale, edge flips of flippable non-constrained sides, a
  walk to locate a point (`WalkTo`), a seed over the boundary copies (`V1EdgesCdtSeed`).
- **Refinement by insertion** (`TriangulationRefine`, `TriangulationFast`, `NeighboursCarried`,
  `RefinementTestCached`): a triangle needs refinement when its chordal deviation (midpoints of its surface edges
  and its corner mean, measured by projection), its normal turn along a surface edge, or its lifted orientation
  fails; the new point is the circumcentre, or an off-centre on the shortest bisector, placed in the triangle;
  insertion by cavity (Bowyer-Watson) with the neighbour table carried between passes; the boundary is locked and
  refinement stops short within the minimum length; at most 40 rounds.
- **Quad grids** (`QuadGrid`, `QuadGridIfRectangular`, `QuadGridOnSides`, `FaceMeshingGridChordal`,
  `V1TypesElements`): a structured grid when the outer loop is four-sided with no holes and opposite sides match;
  interior nodes by transfinite interpolation; the grid kept only when every triangle of both diagonal splits of
  every quad faces the face normal and lies within the chordal bound (`DecideGridChordal`), so a renderer may split
  either way; rows touching a pole become triangles; unequal counts give triangles and count requests.
- **Version 1 face cases** (`V1Plane`, `V1Band`, `V1Axle`, `V1Pinch`, `V1ZeroWidth`, `V1EdgeFlaps`, `V1PoleRefine`,
  `V1Keep`, `V1Chordal`): a plane face is triangulated from its boundary with no interior point; a band whose
  circles' vertices are half a turn apart; zero-width lenses meshed and diagnosed; cusps flagged; pole refinement.
- **Lifting** (`Lift`, `FaceMeshingLiftIndexed`): corners go to their 3D vertices through their sources, elements
  with two corners on one pole segment are dropped combinatorially, local vertices numbered by identified sources.

### Layer 6: the assembled mesh

- **Numbering by provenance** (`NumberMeshVertices`, `ModelMeshNumberingIndexed`): model vertices first, then edge
  interiors, then face interiors, so provenance is recoverable from the index; shared samples share an index by
  construction, which is the watertightness proof.
- **Assembly** (`AssembleModelMesh`): one face mesh per face in face order into seven columns of positions, corners,
  corner uvs, element faces and provenance.
- **Topology** (`ModelMeshTopology`, `ModelMeshIncidence`, `ModelMeshPiecesUnionFind`): the edge table by sorting
  canonical vertex pairs; closed, manifold, consistently oriented and the Euler characteristic read from it;
  components by union-find; vertex incidence by counting sort; boundary cycles, non-manifold edges, pinched
  vertices, misoriented edges.
- **Coincidence** (`ModelMeshCoincidentGridded`): coincident vertices found on a cell grid, not pairwise.
- **Measures and quality** (`ModelMeshMeasures`, `ModelMeshQuality`): angle defect sums (Gauss-Bonnet), vector area,
  signed volume about the box centre, triangle and quad quality (angles, aspect ratio, radius ratio, skew, scaled
  Jacobian).
- **Masks and conversions** (`ModelMeshMasks`, `ModelMeshConversions`): a mesh restricted to faces, quads split on a
  diagonal into the stdlib's `TriangleMesh3D`.

### Layer 7: validation

- **Check families and levels** (`BrepChecking*`): Structural, Geometric, Oracle; a report per stage (STEP file,
  topology, geometry arena, discretizations, face meshing, mesh, cross) built from `Check_` records with severity by
  group; `IsClean` means no Error.
- **The Green's-theorem area oracle** (`BrepOracles`, `BrepOraclesOnce`): a potential per surface (closed form for
  the plane, cylinder, cone, sphere, torus, revolution of a line, extrusion of a line; Gauss-Legendre quadrature
  for the rest), coedge sides sampled and unwrapped, seam sides cancelling, pole sides and implicit pole segments,
  torus cut pairs; run at 32 and 64 chords per coedge and Richardson-extrapolated, the correction size as the
  allowance.
- **The divergence-theorem volume**: one third of the flux of x − O, with trigonometric coefficients exact on
  constant-v segments and 5-point Gauss-Legendre otherwise, extrapolated the same way; shell signs give solid and
  void volumes.
- **Closed forms as a second route**: `Oracle_PlanarFaceArea` by chord terms and arc segment areas; sphere, torus,
  cylinder and cone patches; B-spline points by the Cox-de Boor recursion (`BsplineOracles`).
- **Cross checks**: mesh area within the face's envelope, mesh volume against the oracle, mesh Euler against the
  reduced B-rep Euler, vertex re-evaluation from provenance.
- **Witness laws** (`BrepWitnesses`): every positive witness clean at every level; every negative witness fails
  exactly the laws its comment names.
- **Defects** (`BrepCheckingDefects`): a failed check classed into one of 26 `Defect` cases with a locality, the
  input of layer 11.
- **The corpus table** (`BrepCorpus`): 36 public STEP files with the conventions and defects each exercises.

### Layer 8: pipeline

- **Stages as total functions**: parse (host), decode, `MeshModel` over a choice of faces; every stage exact on
  its domain and extended by a located diagnostic outside it; a refused run is reported, never thrown.
- **The refinement loop as a fixed-point iteration** (`Step`, `StepByParts`, `FinalState`): refine the requested
  edges, find the changed ones, re-mesh the faces touching them, raise the floors, collect the new requests, until no
  request is pending or the round cap is reached; a blocking-only variant (`StepAnsweringBlocking`) for the host.
- **Options** (`DefaultMeshingOptions`, `RelativeMeshingOptions`, `HostMeshingOptions`): a chordal bound relative to
  the model size, criteria, the conformance level, quads or not, the round cap; one definition for every caller
  including the C# host.
- **The version 1 gate** (`V1Gate`, `V1GateSplits`): the contract's claims on real face meshes: every triangle
  oriented and within the bound, every quad on both diagonal splits, corners lifted to their sources, and the gate
  witnesses (unit box, cylinder, block with a through hole, bump solid, skewed patch solid).
- **Traces and run keys** (`StepToMeshTrace`): events per round, pending and incremental runs.

### Layer 9: tooling

- **The law runner in Plato** (`ToolingLawRunner`): checks over the thirteen model witnesses at the Oracle level,
  the negative witnesses' expected failures, laws over Number parameters swept over generated families, verdict
  deltas against a baseline.
- **Diffs** (`ToolingDiffs`): `ModelDiff`, `DiscretizationDiff`, `MeshDiff`, `ReportDiff`, `FileDiff`, each `Same`
  or the first located difference in table, row, slot, field order.
- **Dumps** (`ToolingDumps`): the mesh as one glTF part and material per face for the 3D pane, the parameter plane
  as SVG layers, reports and states as CSV tables the notebook reads.
- **Generators** (`ToolingGenerators`): parameterized families (box, cylinder, sphere, torus, cone, block with a
  hole, hollow box, B-spline patch) and perturbations.

### Layers 10 and 11: editing and repair

- **Edits as data with inverses** (`BrepEditing`, `BrepEditingScripts`): `MoveVertex`, `ReplaceCurve`,
  `ReplaceSurface`, `Transform`, `Scale` (by a power of two, so exact), `SetTolerances`, `ScaleTolerances`,
  `ReverseFace`, `ReverseLoop`, `RemoveFace` and its inverse `RestoreFace`; a script's outcome carries its inverse
  script and the index remap; a refused edit names its precondition.
- **Euler operators** (`BrepEditingEuler`): `MakeVertexEdge`, `MakeEdgeFace`, `KillEdgeMakeRing`,
  `MakeEdgeKillRing`, `KillEdgeVertex`, `KillFaceMakeRingHole`, each with its signed count delta and hole delta
  checked against the Euler-Poincaré balance.
- **Closure and invalidation** (`BrepEditingClosure`, `BrepEditingInvalidation`): what an edit touches and which
  face meshes it dirties.
- **Diagnosis and plans** (`BrepRepairDiagnosis`, `BrepRepairIndexed`, `BrepRepairPlans`): each of the 26 defects
  mapped to the obvious action, a choice, or Unfixable, with a cost (touched faces, locality, tolerance growth);
  `PlanOf` takes the first action per fixable defect and sorts structure, tolerance, geometry, quality;
  `StrictPolicy` refuses tolerance growth, table-size changes and shell flips; a ledger records each outcome;
  `Repair` itself is deferred.

### The C# host (`Ara3D.Step.Mesher/Plato`)

`StepPlatoTables` builds the model's tables once per file, `StepPlatoMesher` calls `DiscretizeAll`, `MeshFace` and
the refinement step per face in parallel under a time budget, `StepPlatoBodies` turns the model mesh into one shape
mesh per body, and `step-corpus-harness` runs the 88 u-blox files, checks the version 1 contract on every face,
extracts a face as a Plato witness, and writes the corpus CSV.

## 7. Where it stands

**The corpus.** The run of 2026-10-22 late meshed 192,446 of 192,453 faces in the 88 u-blox files (84 files fully,
4 partly), with 0 exceptions and no file over 120 s; every declared-closed shell is closed in 80 files, and the
version 1 contract holds on 86. Three days earlier (2026-10-19) 2 files meshed fully and 72 produced no geometry.
Seven faces remain unmeshed (touching holes, spike tips, a slit, cusps that self-cross within tolerance), waiting
on the `SplitAt` edge request of v1-edges; the contract breaks on two files (a cone face, five B-spline strips),
which the `FoldAgainstBoundary` request of v1-jody fixes on a scratch regeneration.

**The laws.** The last sweep: 1,188 of 1,325 verdicts pass; 33 fail, most of them known and ticketed; 84 are host
obligations the interpreter cannot evaluate; 14 skipped for want of generated values. The next regeneration moves
the Plato pin to `33604a12` (short-circuit operators), with a corpus run before and after.

**Open work named by the four reviews of 2026-10-22:**

- Consolidation: the Green boundaries built about ten times per Oracle validation, the per-shell topology measures
  scanning the whole model per edge, layer 7 checks rebuilding mesh tables per sample, one meshing run scanning the
  model 3 + 2R times, about 1,500 lines behind three validation entry points nothing calls, about 450 lines of
  agreement laws that compare a function with itself, about 700 lines of forwarders, about 1,000 lines of dead code.
- Types: adopting the declared types on the meshing path (typed parameters in the arena API, three index spaces in
  `FaceMesh`, proof types as parameters, `MeshResult` as the pipeline's return), generic sums in Plato (`Decided<T>`,
  `Maybe<T>`) to retire 89 `-1` sentinels and 39 hand-copied `Decided*` sums.
- Reliability: the live insertion passes have no agreement law; one law name carries two claims; the host's
  refinement loop restates the library's `Step`.
- Performance: `Reduced` is quadratic in vertices and edges (about 75 of the 87 s of prepare time), curve and
  pcurve inverse searches re-sample per query, the quad-grid path evaluates each node about 16 times.

**Not required in version 1** and left to the improvement pass: minimum and maximum angle, aspect and radius
ratio, the 15 degree side-normal test, sliver removal, interior refinement of plane faces, poly loops, `Repair`
bodies, and the typed STEP layer (F-1, TKT-300, on hold by the owner).
