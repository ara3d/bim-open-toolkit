# 11-repair: diagnosis and repair plans as data

Layer 11 of the STEP B-rep to mesh design ([../README.md](../README.md)), TYPE-CATALOG.md sections
13 and 15 (`IRepairable`). A repair is a value (`RepairAction`, one case per defect family). For each
defect layer 7 reports (`Defect`, `07-validation/validation-defects.types.plato`), `Diagnose(m,
defect)` names the obvious action, a choice of actions, or why none applies. `PlanOf(m, defects)`
orders the actions, structure first, and `Permits(policy, action, cost)` says what a caller allows.
The repair itself (`Repair`) is deferred. Nothing below layer 11 names anything declared here; the
layer reads layer 8's `IsClosedShell` and layer 10's `ModelEdit`, `FacesOnSurface` and
`FacesOfLoop`.

Written 2026-10-20 by the catalog-repair track (TKT-323) and merged the same day. The defect types
went to layer 7 and section 14's STEP names and units to layer 3 (`03-step/step-decoding.*`).

| File | Holds |
|---|---|
| `repair-diagnosis.types.plato` | `RepairAction` (the catalog's 20 cases and `SkipInstance`), `RepairCost`, `Fixability`, `GapClosure`, `SeamRepair`, `StepRepairProjection` |
| `repair-plans.types.plato` | `RepairStep`, `RepairPlan`, `RepairPolicy`, `RepairOutcome`, `RepairEntry`, `RepairLedger`, `HealedModel` |
| `repair.concepts.plato` | `IRepairable { Defects(x); Repair(x, plan, policy) }`, declared by `HealedModel` |
| `repair-diagnosis.library.plato` | library `BrepRepairDiagnosis`: the faces an action touches, `CostOf`, `RaisedLength`, `RaisedAngle`, `Diagnose(m, defect)`, `PlanOf(m, defects)`, `ChangesTopology`, `FlipsShell`, `Permits`, `ToStepRepair`, `ToRepairAction(record)`, `ToRepairAction(seamRepair, edge)` |
| `repair-plans.library.plato` | library `BrepRepairPlans`, the layer's main block: `StrictPolicy`, `EmptyLedger`, `Recorded`, `IsRepaired`, `ToPreparedModel`, `Defects(HealedModel)`; `Repair` deferred |
| `repair.laws.plato` | library `BrepRepairLaws`: 12 laws |
| `repair.spec.plato` | contracts of `Fixability`, `Diagnose`, `RepairCost`, `RepairAction`, `ToStepRepair`, `RepairPlan`, `PlanOf`, `RepairPolicy`, `RepairOutcome`, `Repair`, `RepairLedger`, `HealedModel`; the gate does not read it |

The library files sort diagnosis, plans, and each calls only files that sort before it, or lower
layers.

## Completions the catalog only sketched

- `Diagnose(m, defect)` takes the model, not only the defect: whether a seam's face is in a closed
  shell, which bounds a face has to promote, and the tolerances a `RaiseTolerance` replaces all come
  from it. So `PlanOf(m, defects)` takes it too. TYPE-CATALOG.md section 13 now says so.
- The obvious action per case is a first table, not a validated repair: `FreeEdge` offers declaring
  each shell citing it open, or dropping it; `EdgeOffSurface` offers a projected pcurve or a raised
  length tolerance; `PcurveOffCurve` and `NonOrthonormalPlacement` raise a tolerance to the measured
  gap; `LoopNotChained` reverses the loop; `LoopSelfIntersects` drops the bound;
  `ZeroLengthDirection` skips the instance.
- `CostOf`: `TouchedFaces` is the faces the action changes; `Locality` is `WholeShell` for
  `FlipShell` and `DeclareOpen`, `WholeModel` for `RaiseTolerance`, otherwise `Local` for at most two
  faces and `NeedsNeighbours(faces)` beyond; `ToleranceGrowth` is the new length tolerance over the
  old for `RaiseTolerance`, 1 otherwise.
- `PlanOf` takes each fixable defect's first action, drops the Unfixable ones, and sorts stably by
  class: Structural, Tolerance, Geometric, Quality.
- `StrictPolicy` allows nothing that grows a tolerance, changes a table size, or flips a shell.
- `RepairLedger.Records` holds `RepairEntry { Source; Action; Outcome }`.
- `ToStepRepair(action)`: `MergeVertices(keep, drop)` is `MergedInto(keep, drop)`, `DropEdge(e)` is
  `DroppedZeroLengthEdge(e)`, `SkipInstance` is `Skipped`, every other action `NotProjected` with an
  Info diagnostic. Since the merge `StepRepair` keeps the raw index of what it removed, so
  `ToRepairAction(record)` is the way back with no extra argument.
- `GapClosure.Bridge(From, To)` stands for the catalog's `Bridge(Segment)`; `SeamRepair` directions
  are `SurfaceParameter`, and `ToRepairAction(seamRepair, edge)` maps one to an action.
  `GapClosure` has no reader yet (LINT010).

## Laws

Each law quantifies over layer 7's 28 sample defects (`SampleDefect`, one per case and the seam
twice) on `Witness_BoxWithPolyLoopSheet`, whose face 0 is in closed shell 0 and face 6 in open
shell 1. All 12 pass under cpu64.

- Diagnosis: `Law_DiagnoseUnfixableOnlyForNamedCases`, `Law_DiagnoseNeverOffersAnEmptyChoice`,
  `Law_SeamOnClosedShellIsUnfixable`, `Law_SeamOnOpenShellIsFixable`, `Law_NotOrientableIsUnfixable`.
- Plans, costs, policies: `Law_PlanFixesStructureBeforeGeometry`, `Law_PlanHasAStepPerFixableDefect`,
  `Law_LocalRepairTouchesAtMostTwoFaces`, `Law_StrictPolicyRefusesTopologyChange`,
  `Law_RaisedToleranceGrows`.
- Projection: `Law_StepRepairRoundTrips` (the three cases), `Law_ReverseFaceDoesNotProject`.

## Unfixable

`Diagnose` says Unfixable exactly for these (`IsNamedUnfixable` in the laws): `NotOrientable`;
`SeamRunsSameWay` on a face of a closed shell (layer 8's `IsClosedShell`); `ShellDisconnected` (no
action splits a shell); `Unclassified` (no family is known for the law); `NoOuterBound` and
`TwoOuterBounds` on a face with no bound to promote. The list is longer than the catalog's two cases,
because inventing an action that does not repair would be worse.

## Open

- `ProvenanceMap.Repairs` stays `Array<RepairRecord>`: `RepairEntry.Outcome` is a `RepairOutcome`,
  whose `Repaired` case carries layer 10's `ModelEdit`, so layer 3 cannot hold it (VOCABULARY.md,
  "Changes to this contract").
- `Repair(h, plan, policy)` is deferred: apply each permitted step, check its expected law before and
  after, revert what worsens.
- Only 7 of the 26 defect families come out of `DefectOf` filled; the rest are `Unclassified`,
  because a `Check` holds one provenance (reviews/FINDINGS.md, F-58).
- LINT014: `Defects(HealedModel)` shares its name with the fields `DefectReport.Defects` and
  `CorpusRow.Defects` (the catalog names both).
