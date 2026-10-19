---
id: TKT-326
title: STEP mesher in Plato, step D: PrepareModel, the Plato half of reading a file (closure, mirrored parts, tolerances, repairs)
status: claimed
depends_on: []
owner: session 0e4f63ff
session: 0e4f63ff-c9b9-4b15-94b8-0d538d7cb10d
fence: [sandbox/step-brep-mesh/**]
workflow: [W3, W4]
related: [TKT-323, TKT-312, TKT-314, TKT-315]
confidence: high
created: 2026-10-18
claimed: 2026-10-18
---

## Acceptance criteria

- [x] PrepareModel(raw): DecodedModel and every function it composes have bodies, including Reduced and ToleranceDiagnostics, which TKT-312 found missing; every body this step owns is written in Plato, no throwaway C# body remains, and the deferred-body count in each touched layer README is updated
- [ ] Law_PrepareIsIdempotent, Law_PrepareKeepsPointSet, Law_RawHasNoClosures, Law_RawHasNoClosedPeriodicity, Law_UnitsFactorsAgree, Law_CurveClosureDecidedByEnds, Law_SurfaceClosureDecidedBySides, Law_ClosureMarksAreTheDecisions and the fold laws pass; the laws run in the Plato interpreter (plato run --laws, TKT-317) and over the C# backend under cpu64 (TKT-315), and the two agree law by law
- [x] Law_RawUnitCubePreparesToUnitBox and Law_RawTwoCubesPreparesToTwoBodies pass on the library's witnesses, and TKT-312's open criterion (the same two laws with the C# decoder's output) can then be checked

Part of the epic TKT-323 (the STEP mesher in Plato). Owner approval 2026-10-18. The step and its lists of functions and laws come from sandbox/step-brep-mesh/TASKS.md, the library's build order, where each step adds one harder kind of shape. A law is a Boolean function stating a property the code must have; a witness is a hand-built model with known counts, areas and volumes, so a failing law names the defect. Fence: the whole library folder, because a step adds bodies in several layers; two steps with this fence run one after the other unless the builder narrows the fence when claiming. The C# decoder (TKT-312) hands Plato the model exactly as the file writes it (RawDecodedModel). PrepareModel makes the four decisions that are geometry: which curves and surfaces are closed (their ends coincide within the length tolerance), flipping left-handed (mirrored) placements, tolerance floors set from the model's size, and repairs of degenerate pieces. Until it has bodies, no real STEP file can be meshed. Uses step A's ScaledBy, RigidlyMoved, ReducedCounts and IsSameModel.


Dependencies changed 2026-10-18 (plan docs/plans/step-mesher-parallel.md): step A's bodies exist, so this step starts now and is developed and checked on the Plato interpreter under cpu64. TKT-314 (step A's close) and TKT-315 (the C# writer and 64-bit profile, paused by the owner) are related, not blocking; the criterion that the C# backend agrees waits on TKT-315 and is checked by the supervisor at close.

## Log

- 2026-10-18, builder 0e4f63ff (fence narrowed to `sandbox/step-brep-mesh/03-step/**` and this file, at the supervisor's assignment). Commit 72d36820: `Reduced` and `ToleranceDiagnostics` get Plato bodies from their contracts, with six helpers (`VertexJoints`, `LoopJoints`, `RunsBackToStart`, `Renumbering`, `ReducedLoop`, `UnclampedLengthTolerance`). PrepareModel composes no other bodiless function, and no C# body was written. The layer README's count is now 236 functions, 217 with bodies, 19 deferred (was 21); every function still deferred is a C# host obligation or a decode step outside PrepareModel.
- Verdicts, pinned CLI 062b8dc7, `--profile=cpu64`, interpreter. Before: every law below over the raw witnesses was "host obligation: Reduced". After: all pass.
  - Criterion 1 evidence: PrepareModel runs on both raw witnesses with no host obligation.
  - Criterion 3: `Law_RawUnitCubePreparesToUnitBox` pass (1 case), `Law_RawTwoCubesPreparesToTwoBodies` pass (1 case).
  - Criterion 2, interpreter half: `Law_PrepareIsIdempotent` pass (2 cases), `Law_PrepareKeepsPointSet` pass (28), `Law_ClosureMarksAreTheDecisions` pass (2), `Law_CurveClosureDecidedByEnds` pass (28), `Law_SurfaceClosureDecidedBySides` pass (56), `Law_FoldPreservesInteriorSide` pass (25), `Law_FoldFlipsExactlyRecorded` pass (28), `Law_MirrorFoldRecordedOnce` pass (28), `Law_LeftHandedSurfacesAreFolded` pass (28). `Law_RawHasNoClosures`, `Law_RawHasNoClosedPeriodicity`, `Law_RawTolerancesUnset` and `Law_UnitsFactorsAgree` pass before and after.
  - Every law's `Part21File` form, plus `Law_RawFaceFlagsAreTheFiles` and `Law_FoldRecordsNameFalseFlags`, stays "host obligation: DecodeRaw" until the C# decoder is wired in (TKT-313).
  - Criterion 2's C# backend half waits on TKT-315 and is left to the supervisor.
- Leftovers for the supervisor to move into FINDINGS.md:
  - No witness exercises `Reduced`'s merge and drop paths, or any of `ToleranceDiagnostics`' three findings. Both witnesses state 1e-6 mm, have no coincident vertex pair, and are not mirrored. A raw witness with a duplicated loop-joint vertex, a zero-length line edge and a closed circle edge with two vertices would test them (`Law_MergedVerticesCoincide` and `Law_RepairsAreDiagnosed` have only Part21File forms today).
  - The vertex classes are transitive, so a chain of joints each within the tolerance can merge two vertices farther apart than it (see README, "Implementation, chunk D").
  - `UncertaintyClamped` is also reported when the policy default, not only a stated value, is raised to the resolution at the extent (review F6's survey-coordinate case). The library comment was widened to say so.
  - The `plato-navigation` server indexes only Plato's stdlib, so `plato_check` cannot check the sandbox. The law run's compile served as the type check. Compiles took 15 s at the baseline run and 340 to 650 s later under the machine's load.
  - The witness laws run slowly in the interpreter: 11 to 14 s for each witness law, and up to 51 s for a fold law over 25 cases.
- 2026-10-19, closer (supervisor of docs/plans/step-mesher-v2.md): stays open. Box 2's interpreter half is met (log above; reviews/verdicts-cpu64.tsv); its C# backend half is not: no C# run of these laws exists. Waits on a C# run of these laws: the library's layers regenerated to C# under cpu64 (TKT-313, track E, blocked by TKT-347, the C# writer dropping List-first functions) and its laws run over the C# backend.
