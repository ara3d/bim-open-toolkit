---
id: TKT-314
title: Implement chunk A of the STEP B-rep mesh library: the unit cube through every layer on witnesses
status: claimed
depends_on: [TKT-299]
owner: session cab91351
session: cab91351-5bf8-4a98-95e5-92d43c79efbf
fence: [sandbox/step-brep-mesh/**]
workflow: [W3, W4]
confidence: high
created: 2026-10-17
claimed: 2026-10-22
---

## Acceptance criteria

- [x] every function TASKS.md chunk A lists has a body, and the deferred-body count in each layer README is updated
- [x] layer 2's laws pass on the ten positive witnesses and fail exactly as stated on the three negative ones, through the Plato law runner over the C# backend
- [ ] Witness_UnitBox meshes through MeshModel to 8 vertices and 12 triangles, closed, oriented, reduced Euler characteristic 2, signed volume 1, Rounds 0, Ok true, and every law TASKS.md chunk A lists passes
- [x] the gate stays at PASS with zero errors in scope, and the mechanical items of reviews/FINDINGS.md F-48 (1, 2, 4, 5) and F-47.4 are applied in the first commit

Owner approval 2026-10-17 ("go for it" on the recommendation in the TKT-299 session). The first implementation chunk of sandbox/step-brep-mesh/TASKS.md: witness-driven, no STEP file read, 32-bit Number suffices. Runs beside TKT-311 (does the C# writer compile the library's constructs), the 64-bit Number profile, and TKT-312 (the C# decoder to RawDecodedModel). The boundary agent of TKT-299 is editing 03-step and 07-validation/validation-witnesses.library.plato at the same time; chunk A touches those two last.

Log 2026-10-17: nine commits (d80f3e89 to 36c893f8) landed; the unit box meshes as specified and every chunk A law evaluates true in the builder's scratch harness (a Plato copy with the conditional fix). Boxes 1 and 4 are met; boxes 2 and 3 wait for the laws to be rerun through the fixed C# writer (TKT-315, whole-library build at 8 errors). Leftovers in sandbox/step-brep-mesh/reviews/FINDINGS.md F-52.

Log 2026-10-18 (topology and validation track, session fa587ba3; plan docs/plans/step-mesher-parallel.md). Claimed by hand: `ticket.py claim` refuses while TKT-299 is open. Every verdict below is from the pinned interpreter (Plato 062b8dc7, `plato run --laws`, cpu64, budget 60 s), one `--filter` per law group; none is from the C# backend, so boxes 2 and 3 stay unticked for the supervisor.

Box 2, interpreter half. Layer 2's laws reach the witnesses through layer 7's `Check_` wrappers and witness laws:
- pass, 196 cases exhaustive (k, s in -1..12, every positive witness and an out-of-range index): `Law_WitnessHasStatedCounts`, `Law_WitnessStatedCountsImplyStatedGenus`, `Law_WitnessEulerIsTwoMinusTwiceGenus`, `Law_WitnessOracleEulerMatchesLayerTwo`; pass, 14 cases: `Law_WitnessHasStatedShellCount`, `Law_WitnessHasStatedFaceCount`.
- obligation: `Law_WitnessIsStructurallyClean` and `Law_WitnessValidatesClean` stop at witness 7 (`Witness_BSplinePatchSolid`) on layer 1's bodiless `ProjectBySearch` (reached through `IsPlainInParameters` in `Law_LoopWindingMatchesSameSense`). Chunk F's body, step B's fence.
- So each other positive witness was run alone, through scratch laws in the session's scratchpad (`WitnessAt(k).ValidateBrep(Structural).IsClean` and `.ValidateBrep.IsClean`): pass for witnesses 0, 1, 2, 3, 4, 5, 6, 8, 9 at both levels (18 of 18).
- Negative witnesses, all pass: `Law_RedundantPoleLoopsAreRedundant`, `Law_RedundantPoleLoopVertexIsNotIsolated`, `Law_RedundantPoleLoopsFailExactlyTwoLaws`, `Law_RedundantPoleLoopsReduceToSphere` (25 sampled radii each); `Law_FlippedFaceBreaksWinding`, `Law_FlippedFaceFailsExactlyOneLaw`; `Law_SharedCornerBreaksEuler`, `Law_SharedCornerBreaksVertexLink`, `Law_SharedCornerFailsExactlyTwoLaws`. Each negative witness fails exactly its named laws.
- What is missing for box 2: witness 7 (needs `ProjectBySearch`, chunk F) and the C# backend run (TKT-315).

F-52 item 4, settled (commit ca23e274): implicit free edges of a faceted shell count as boundary edges, as ReducedCounts already counts them as edges. `Law_PolyLoopSheetHasOneBoundaryCycle` and `Law_PolyLoopSheetPassesOpenShellEuler` (new): fail -> pass. `Law_OpenShellEulerEvenAndBounded`, `Law_PolyLoopEdgesPairUp`, `Law_WitnessEulerIsTwoMinusTwiceGenus`, `Law_WitnessHasStatedCounts`: pass -> pass. `Law_OpenShellEulerEvenAndBounded` alone is weak evidence: its 25 samples never draw the sheet's shell 1.

F-52 item 7, open (commit 9c8f5dd4 has the laws, not the body): `Witness_UnitBoxWithBottomPcurve(speed)` and three laws, all obligation today. The body needs two changes in step B's fence, both sent to the supervisor: the OnSurface arm of layer 1's `ClosestParameter` calls the bodiless `ClosestParameterBySearch` even when the master is the space curve, so `EdgeDomain` faults on any edge with a pcurve; and `CopiesInside` (copies of a periodic parameter inside a range) sits in layer 4, which layer 2 may not call, and belongs in layer 0.

F-51 item 1, done before this session in 6409fa52: `SameModel` compares every table (pcurves, parameter-plane curves, loop and body cases, poly-loop points). It stays in layer 7 with its own body, because layer 7 may not name 09-tooling's `DiffModels`; `Law_ModelDiffIsSameExactlyWhenSameModel` makes the two one equality, so a divergence fails a law instead of hiding. Verdicts today: `Law_ModelDiffIsSameExactlyWhenSameModel` pass (169 cases, every pair of model witnesses), `Law_WitnessModelDiffIsSameExactlyWhenSameModel` pass (196 cases), `Law_UnitBoxIsBoxOfOnes` pass. Left for the backend: `SameModel` compares curves and surfaces with `==`, and the generated C# compares a record's array field by reference (docs/interpreter.md, "Where the interpreter and the C# backend differ"), so two separately built B-spline curves would differ there.

Box 3 waits on TKT-332: its whole-box laws hit the 60 s budget.


Log 2026-10-18, box 3 on the interpreter (Plato 93907bd7, the TKT-332 call cache; cpu64; `--budget=900` while the machine runs 6 to 30 times slow; one compile per run through `--laws-from`). Box 3 stays unticked: its C# backend half is the supervisor's.
- Run 1, the TASKS.md chunk A list plus the box and planted-face witness laws, 17:48:28 to 17:51:23 (171 s wall, 58 s in laws, none near the budget): pass for `Law_UnitBoxMeshesAsStated` (new, d9650c6d: 8 vertices, 12 triangles, no quad, closed, oriented, Euler 2, signed volume 1 within VolumeRoundoff, Rounds 0, Ok), the six `Law_PlantedBadFace*` laws, `Law_EmptyFaceIsDiagnosed`, `Law_FinalDiscretizationsMeetFloors`, `Law_OutcomeIsOfItsFace`, `Law_EmptyDiscretizationExactlyWhenEdgeUnusable`, `Law_FailedFaceLeavesOthersUnchanged`, `Law_EdgeReversalPreservesMesh` (29.8 s over 25 cases) and `Law_ValidationIsIdempotent` (now guarded, 31a70b02). The other ten general layer 8 laws (`Law_MeshModelIsDeterministic`, `Law_OkExactlyWhenClean`, `Law_RoundsWithinLimit`, `Law_EveryDiagnosticIsLocated`, `Law_LoopEndsTerminal`, `Law_MeasureIsNeverNegative`, `Law_OutcomesAreCurrent`, `Law_ClosedWhenEveryShellClosedAndNoFaceEmpty`, `Law_OrientedWhenEveryShellClosedAndNoFaceEmpty`, `Law_ShellReversalNegatesVolume`) are sampled over every model witness and stop at an obligation on a curved one: `ExpandedPoles` or `ProjectBySearch`, step B's and chunk F's bodies. `Law_WitnessIsOracleClean` fails at k = 5. That is a layer 1 defect: the rounding bound of `DerivativeAgrees` at x = 0, diagnosed and sent to step B (F-53).
- Run 2, every chunk A law applied to the unit box under the witness options, the integer arguments exhausted over -1..12, plus `Law_EmptyFaceIsDiagnosed` and `Law_FailedFaceLeavesOthersUnchanged` on `Witness_BoxWithFlippedFace` and on the planted sheet, 17:52:15 to 17:53:28 (72 s wall, 13 s in laws): 20 of 20 pass. These scratch laws live outside the repository; a copy is in the supervisor's notes folder (topology-scratch-box.laws.plato). Of the ten above, each passes on the box, among them `Law_EdgeReversalPreservesMesh` on all 12 edges and `Law_FailedFaceLeavesOthersUnchanged` over 196 face pairs.
- Left for box 3: the C# backend run (TKT-315), and the ten general laws over the curved witnesses, which wait for steps B and F.

2026-10-19, closer (supervisor of docs/plans/step-mesher-v2.md): stays open. Boxes 2 and 3 unmet. Box 2: no C# backend run of layer 2's laws exists, and `Law_WitnessIsStructurallyClean` and `Law_WitnessValidatesClean` are still obligations on witness 7 (`ProjectBySearch`, chunk F, TKT-327) in reviews/verdicts-cpu64.tsv. Box 3: on the interpreter the box meshes as stated (`Law_UnitBoxMeshesAsStated` pass) and every chunk A law passes on the box, but ten of the listed layer 8 laws are obligations in the verdict file over the curved witnesses (`ExpandedPoles`, TKT-325; `ProjectBySearch`, TKT-327), and C# (TKT-313) meshes the cube through `StepMesher.Mesh` without layer 8's `MeshModel` (no `Rounds` or `Ok`). Waits on TKT-325, TKT-327 and a C# run of these laws: the library's layers regenerated to C# under cpu64 (TKT-313, track E, blocked by TKT-347, the C# writer dropping List-first functions) and its laws run over the C# backend.
- 2026-10-22, session cab91351 (track E, L1). Both backends on the library exported at toolkit cd33c998 (layers last changed in c47db0b3), stdlib from Plato e37c032f without `brep.*`, CLI `C:/Users/cdigg/.plato-cli/e37c032f`, cpu64: compiled C# with `--budget=2 --parallel=6`, interpreter with `--budget=120`; laws matched as Block.Law, overloads joined. Columns: law, interpreter, compiled C#.
  Box 2, layer 2 on the witnesses: 17 of 17 agree, every one pass on both, witness 7 (`Witness_BSplinePatchSolid`) included now that chunk F has bodies. Ticked.
  | Law | Interpreter | Compiled |
  |---|---|---|
  | `BrepWitnessesLaws.Law_WitnessHasStatedCounts` | pass | pass |
  | `BrepWitnessesLaws.Law_WitnessStatedCountsImplyStatedGenus` | pass | pass |
  | `BrepWitnessesLaws.Law_WitnessEulerIsTwoMinusTwiceGenus` | pass | pass |
  | `BrepWitnessesLaws.Law_WitnessOracleEulerMatchesLayerTwo` | pass | pass |
  | `BrepWitnessesLaws.Law_WitnessHasStatedShellCount` | pass | pass |
  | `BrepWitnessesLaws.Law_WitnessHasStatedFaceCount` | pass | pass |
  | `BrepWitnessesLaws.Law_WitnessIsStructurallyClean` | pass | pass |
  | `BrepWitnessesLaws.Law_WitnessValidatesClean` | pass | pass |
  | `BrepWitnessesLaws.Law_RedundantPoleLoopsAreRedundant` | pass | pass |
  | `BrepWitnessesLaws.Law_RedundantPoleLoopVertexIsNotIsolated` | pass | pass |
  | `BrepWitnessesLaws.Law_RedundantPoleLoopsFailExactlyTwoLaws` | pass | pass |
  | `BrepWitnessesLaws.Law_RedundantPoleLoopsReduceToSphere` | pass | pass |
  | `BrepWitnessesLaws.Law_FlippedFaceBreaksWinding` | pass | pass |
  | `BrepWitnessesLaws.Law_FlippedFaceFailsExactlyOneLaw` | pass | pass |
  | `BrepWitnessesLaws.Law_SharedCornerBreaksEuler` | pass | pass |
  | `BrepWitnessesLaws.Law_SharedCornerBreaksVertexLink` | pass | pass |
  | `BrepWitnessesLaws.Law_SharedCornerFailsExactlyTwoLaws` | pass | pass |
  Box 3, the box through MeshModel: 16 of 18 agree, all pass. `Law_EdgeReversalPreservesMesh` (4.8 s over 4 cases) and `Law_ValidationIsIdempotent` (10.1 s over 25 cases) pass in the interpreter and exceed the 2 s compiled budget, which TKT-354 counts as a defect. Box 3 stays open on those two, ranked in TKT-356 (no version 1 track holds it).
  | Law | Interpreter | Compiled |
  |---|---|---|
  | `StepToMeshMeshedWitnessesLaws.Law_UnitBoxMeshesAsStated` | pass | pass |
  | `StepToMeshLoopRunLaws.Law_MeshModelIsDeterministic` | pass | pass |
  | `StepToMeshOutcomeMeshedLaws.Law_OkExactlyWhenClean` | pass | pass |
  | `StepToMeshLoopRunLaws.Law_RoundsWithinLimit` | pass | pass |
  | `StepToMeshOutcomeMeshedLaws.Law_EveryDiagnosticIsLocated` | pass | pass |
  | `StepToMeshLoopRunLaws.Law_LoopEndsTerminal` | pass | pass |
  | `StepToMeshLoopRunLaws.Law_MeasureIsNeverNegative` | pass | pass |
  | `StepToMeshLaws.Law_OutcomeIsOfItsFace` | pass | pass |
  | `StepToMeshLoopRunLaws.Law_OutcomesAreCurrent` | pass | pass |
  | `StepToMeshLoopRunLaws.Law_EmptyDiscretizationExactlyWhenEdgeUnusable` | pass | pass |
  | `StepToMeshLoopRunLaws.Law_FinalDiscretizationsMeetFloors` | pass | pass |
  | `StepToMeshLoopRunLaws.Law_ClosedWhenEveryShellClosedAndNoFaceEmpty` | pass | pass |
  | `StepToMeshLoopRunLaws.Law_OrientedWhenEveryShellClosedAndNoFaceEmpty` | pass | pass |
  | `StepToMeshLoopRunLaws.Law_EdgeReversalPreservesMesh` | pass | error |
  | `StepToMeshLoopRunLaws.Law_ShellReversalNegatesVolume` | pass | pass |
  | `StepToMeshLaws.Law_ValidationIsIdempotent` | pass | error |
  | `StepToMeshLoopRunLaws.Law_EmptyFaceIsDiagnosed` | pass | pass |
  | `StepToMeshLoopRunLaws.Law_FailedFaceLeavesOthersUnchanged` | pass | pass |
