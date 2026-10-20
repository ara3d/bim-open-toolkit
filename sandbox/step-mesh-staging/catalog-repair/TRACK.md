# catalog-repair: TYPE-CATALOG.md sections 13 (repair) and 14 (STEP decoding), and IRepairable, in Plato

Ticket: TKT-323
Status: ready: catalog-repair

## Done
- catalog-repair, 631e5390 (section 13 types, libraries, 21 laws; section 14 types and library) and
  the commit holding this file (section 14 laws, spec, TRACK.md), about 1.5 hours against 2
  expected: 33 `Law_Catalog_` laws, all pass under cpu64 (2026-10-20); zero type errors in this
  folder; the pinned CLI `lint` reports no LINT001 and no warning in this folder.

Types added (28, besides the 8 borrowed):
- Section 13 (18): `Defect` (the catalog's 26 cases plus `Unclassified(Law, Where)`), `DefectClass`,
  `Locality`, `DecidedDefect`, `DefectReport`, `RepairAction` (the catalog's 20 cases plus
  `SkipInstance`), `RepairCost`, `Fixability`, `GapClosure`, `SeamRepair`, `StepRepairProjection`,
  `RepairStep`, `RepairPlan`, `RepairPolicy`, `RepairOutcome`, `RepairEntry`, `RepairLedger`,
  `HealedModel`. `StepRepairProjection` is not in the catalog: it is the result of `ToStepRepair`.
- Section 14 (10): `EntityName`, `AttributeName`, `EntityLookup`, `AttributeLookup`, `UnitFactor`,
  `AngleFactor`, `PlacementChain`, `ReferenceResolution`, `DecodeStep`, `DecodeTrace`. `EntityLookup`
  and `AttributeLookup` are the decided results of the two name constructors.
- `TypedInstance` is not declared: TKT-300 (the typed STEP entity sum) is an open question, and
  `StepInstanceBody` stays, as the catalog says.

Concepts added (1): `IRepairable`, implemented by `HealedModel` (`Defects` has a body; `Repair` is
deferred).

Files: `catalog-repair-{defects,diagnosis,plans}.{types,library}.plato`, `catalog-repair.concepts.plato`,
`catalog-repair.laws.plato`, `catalog-repair.spec.plato`, `catalog-step-decoding.{types,library,laws}.plato`,
`catalog-borrowed.types.plato`. Library files are named so a library sorts after the ones it calls
(defects, diagnosis, plans), per PLATO-PRIMER.md F.

Completions the catalog only sketched:
- `DefectOf(check)` builds a case only when the check alone gives the case's whole address and
  measure. A `Check` holds one `Provenance` (the worst sample's) and two Numbers, so a case with two
  addresses (`VertexOffCurve(Vertex, Edge, ..)`), a slot (`LoopNotChained(.., AtSlot)`), or a count
  (`ShellDisconnected(.., Components)`) cannot be filled honestly from it. Mapped (7 laws):
  `Law_LoopWindingMatchesSameSense` at a face to `MisorientedFace`, `Law_ShellIsOrientable` at a shell
  to `NotOrientable`, `Law_AtMostOneOuterBound` to `TwoOuterBounds`, `Law_EdgeHasPositiveExtent` to
  `DegenerateEdge`, `Law_SurfacePlacementOrthonormal` to `NonOrthonormalPlacement` (Worst in radians),
  `Law_Where_Direction_WR1` to `ZeroLengthDirection`, `Law_LengthToleranceResolvable` to
  `ToleranceBelowResolution` (Bound the tolerance, Worst the resolution). Every other failed check is
  `Unclassified(Law, Where)`, never a case with a made-up index. `Law_AtLeastOneBound` is not
  `NoOuterBound`: it fails on a face with no bound at all, which has nothing to promote.
- `DecidedDefect = Defect(Value: Defect) | Undecided(Reason: UndecidedReason)`; a check that holds is
  `Undecided(NotApplicable("The check holds."))`.
- `DefectReport.ByClass` is in the order Structural, Geometric, Tolerance, Quality; `ByFace` row f lists
  the positions in `Defects` of the defects whose address names face f (`FacesOf`), one row per face up
  to the highest named. No defect case is of class `Quality` yet.
- `ExpectedLawOf(defect): LawName` names the law each case stands for; `RepairStep.Expect` is it.
- `Diagnose(m, defect)` takes the model, not only the defect: whether a seam's face is in a closed
  shell, which bounds a face has to promote, and the tolerances a `RaiseTolerance` replaces all come
  from it. So `PlanOf(m, defects)` takes it too. Unfixable cases: `NotOrientable`, `SeamRunsSameWay` on
  a face of a closed shell (layer 8's `IsClosedShell`), and also `ShellDisconnected` (no action splits a
  shell), `Unclassified`, and `NoOuterBound`/`TwoOuterBounds` on a face with no bound to promote. This
  list is longer than the two cases the brief named, because inventing an action that does not repair
  would be worse; the law states the full list (`IsNamedUnfixable`).
- The "obvious action" per case is a first table, not a validated repair: `FreeEdge` offers declaring
  each shell citing it open, or dropping it; `EdgeOffSurface` offers a projected pcurve or a raised
  length tolerance; `PcurveOffCurve` and `NonOrthonormalPlacement` raise a tolerance to the measured
  gap; `LoopNotChained` reverses the loop; `LoopSelfIntersects` drops the bound; `ZeroLengthDirection`
  skips the instance.
- `CostOf`: `TouchedFaces` is the faces the action changes; `Locality` is `WholeShell` for `FlipShell`
  and `DeclareOpen`, `WholeModel` for `RaiseTolerance`, otherwise `Local` for at most two faces and
  `NeedsNeighbours(faces)` beyond; `ToleranceGrowth` is the new length tolerance over the old for
  `RaiseTolerance`, 1 otherwise.
- `PlanOf` takes each fixable defect's first action, drops Unfixable ones, and sorts stably by class:
  Structural, Tolerance, Geometric, Quality.
- `RepairPolicy`: `Permits(policy, action, cost)`; `StrictPolicy` allows nothing that grows a
  tolerance, changes a table size, or flips a shell.
- `RepairLedger.Records` holds `RepairEntry { Source; Action; Outcome }` as the brief asked.
- `ToStepRepair(action): StepRepairProjection`: `MergeVertices` to `MergedInto(Keep)`, `DropEdge` to
  `DroppedZeroLengthEdge`, `SkipInstance` to `Skipped`, every other action `NotProjected` with an Info
  diagnostic. The way back, `ToRepairAction(record, droppedVertex, droppedEdge)`, needs the raw model's
  indices of what was removed, because `StepRepair` does not hold them.
- `GapClosure.Bridge(From: ModelPoint, To: ModelPoint)` for the catalog's `Bridge(Segment)`.
  `SeamRepair` directions are `SurfaceParameter`; `ToRepairAction(seamRepair, edge)` maps it to an
  action.
- Section 14: `EntityName` is built by `EntityNamesOf(schema)` and `LookupEntity(schema, keyword)` (long
  or short name), `AttributeName` by `AttributeNamesOf(definition)`, `LookupOwnAttribute`, and
  `LookupAttribute(schema, entity, name)` (the flattened record, through layer 3's deferred
  `FlatRecord`). `UnitFactorOf(LengthUnit)` copies `ScaleToMetres` and is `Snapped` for every named unit;
  `AngleFactorOf(radiansPerUnit)` is `Snapped` exactly at pi / 180, the value `DecodePolicy` snaps to.
  `PlacementStepsOf(occurrences, o)` follows `Parent` and stops on a cycle; `PlacementChainOf` is
  deferred (it needs a polar decomposition). `ResolveReference(file, id, expected)`. `DecodeTrace { Step;
  Source: StepSource; Finding: Diagnostic }`.

Laws (33, all pass, cpu64, 2026-10-20):
- Diagnosis (5): DiagnoseUnfixableOnlyForNamedCases, DiagnoseNeverOffersAnEmptyChoice,
  SeamOnClosedShellIsUnfixable, SeamOnOpenShellIsFixable, NotOrientableIsUnfixable. These quantify over
  all 28 sample defects (one per case, the seam twice) on `Witness_BoxWithPolyLoopSheet`, whose face 0
  is in closed shell 0 and face 6 in open shell 1.
- From checks to defects (9): DefectOfInvertsExpectedLaw, HeldCheckHasNoDefect, UnknownLawIsUnclassified,
  DefectsOfEmptyReportIsEmpty, DefectsOfCleanReportIsEmpty (`Witness_UnitBox` through `ValidateBrep`),
  FlippedFaceReportHasMisorientedFace (`Witness_BoxWithFlippedFace` through `ValidateBrep` has
  `MisorientedFace(0)`), EveryFailedCheckIsADefect (`Witness_TwoBoxesSharingCorner`),
  ByClassCountsEveryDefect, ByFaceRowsNameTheirFace.
- Plans, costs, policies (5): PlanFixesStructureBeforeGeometry, PlanHasAStepPerFixableDefect,
  LocalRepairTouchesAtMostTwoFaces, StrictPolicyRefusesTopologyChange, RaisedToleranceGrows.
- Projection (2): StepRepairRoundTrips (the three cases), ReverseFaceDoesNotProject.
- Section 14 (12): LookupEntityFindsEveryLongName, LookupEntityFindsEveryShortName,
  MisspelledEntityIsUnknown, EntityNamesAreTheTablesNames, LookupOwnAttributeFindsEveryDeclaredName,
  UnitFactorRoundTrips, UnitFactorIsScaleToMetres, ScaledUnitIsNotSnapped, DegreeFactorIsSnapped,
  RadianFactorIsNotSnapped, PlacementStepsReachTheRoot, PlacementStepsStopOnACycle.
- No law for `ResolveReference` or `LookupAttribute`: they call layer 3's deferred `InstancePosition`
  and `FlatRecord`, which throw until they have bodies (obligations).

## Merge instructions
- Move the section 13 files into a new `11-repair` layer and the section 14 files into `03-step`;
  delete `catalog-borrowed.types.plato`'s types where the owning tracks declared them.
- Rename `Law_Catalog_*` to the layer's law prefix at merge.

## Contract requests
- `StepRepair` (`03-step/step-decode.types.plato`) becomes a projection of `RepairAction` through
  `ToStepRepair`. For the projection to be lossless, `MergedInto` would carry the dropped vertex's raw
  index and `DroppedZeroLengthEdge` the dropped edge's; today `ToRepairAction` takes them as arguments.
- `RepairRecord` (same file): the catalog asks to extend it with a `RepairAction` and a `RepairOutcome`;
  `RepairEntry` is that record under a new name. Request: `ProvenanceMap.Repairs` holds `RepairEntry`,
  and `RepairRecord` becomes `ToRepairRecord(entry)` where the action projects.
- `RepairAction` gains `SkipInstance(Instance: StepInstanceId)` beside the catalog's 20 cases, so
  `Skipped` has an action; the catalog's list should add it.
- `Check` (layer 0): `DefectOf` can only fill a case whose address is one provenance. The catalog's
  `Claim { Subject: Provenance }` plus per-family addresses (two kernel elements, a slot, a count) in
  the check would let `DefectOf` map the other 19 families instead of leaving them `Unclassified`; or
  a `DefectOf(m, check)` overload could re-derive them from the model.
- `Diagnose`, `PlanOf` take the model (above); the catalog's `Diagnose(defect)` should read
  `Diagnose(model, defect)`.

## Requests to other tracks
- Borrowed in `catalog-borrowed.types.plato`, delete at merge:
  - decided track (section 5): `UndecidedReason`, exact catalog shape. `DecidedDefect` is declared in
    `catalog-repair-defects.types.plato` in section 5's pattern; the decided track may adopt it.
  - validation track (section 10): `LawName { Value: String }`, `WorkBudget { Evaluations; Insertions;
    Flips; Projections }`, exact shape.
  - proof-carrying track (section 4): `PreparedModel { Model: BrepModel }`, narrower than the catalog
    (no `Decoded`).
  - editing track (section 12): `ModelEdit = Geometric | Topological | Tolerance`, with
    `GeometricEdit = MoveVertex`, `TopologicalEdit = ReverseFace | ReverseLoop`, `ToleranceEdit =
    SetTolerances | ScaleTolerances` only: narrower than the catalog. None of these blocks.

## Findings
- A `Check` cannot carry a two-element address, so 19 of the 26 defect families reach `DefectsOf` only
  as `Unclassified`. On the layer 7 negative witnesses, `Witness_BoxWithFlippedFace` maps to
  `MisorientedFace(0)`; `Witness_SphereWithRedundantPoleLoops` and `Witness_TwoBoxesSharingCorner` give
  only `Unclassified` defects (redundant vertex loop needs a bound slot; Euler and vertex-link laws have
  no defect family).
- `Take(1)` on an empty array throws (`At` out of range); `Take` is not clamped. `FirstActionOf` guards
  it.
- An Integer law parameter runs 14 values (-7 to 6), so a selector into 28 samples misses half of them;
  the sample laws quantify over all samples inside the body instead.
- Lint (pinned CLI): LINT014 for `Defects(HealedModel)` against the field `DefectReport.Defects` (the
  catalog names both); LINT010 for `GapClosure` (no function uses it yet); LINT003 infos for fields read
  only by laws.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, README, primer A/B/D/E/F, spec DSL, catalog 4, 5, 10 to 15, layer 0, 2, 3, 7 files) | 30 min | |
| Writing types, concepts, libraries | 35 min | |
| Writing laws and spec | 20 min | |
| Type-check runs | 2 min | 7 server runs (one with a planted error to confirm the folder is read) |
| Law runs | 1 min | 3 runs (21 with 2 errors, 21, 33) |
| Waiting on the server | 0 min | never busy |
| CLI lint | 1 min | 1 |
| Committing | 3 min | 2 commits |

## Lessons
- Read what a `Check` carries before designing `DefectOf`: its single provenance decides which defect
  cases can be built from it.
