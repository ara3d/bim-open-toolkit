---
id: TKT-328
title: STEP mesher in Plato, step G: solids with holes and hollow solids (genus and voids)
status: claimed
depends_on: []
owner: topology fa587ba3-0ab9-4cde-8228-0725081e9a92
session: fa587ba3-0ab9-4cde-8228-0725081e9a92
fence: [sandbox/step-brep-mesh/**]
workflow: [W3, W4]
related: [TKT-323, TKT-314, TKT-315]
confidence: high
created: 2026-10-18
claimed: 2026-10-18
---

## Acceptance criteria

- [x] Witness_BlockWithThroughHole meshes with Euler characteristic 0 and the expected component counts; Witness_HollowBox meshes with its inner (void) shell giving negative volume; any bodies these need are written in Plato and the layer READMEs updated. Evidence: reviews/verdicts-cpu64.tsv after merge 848b66d6 and 91e6b055: `Law_BlockWithHoleMeshIsOneTorus` pass, `Law_HollowBoxMeshIsTwoSpheres` pass, `Law_HollowBoxVoidMeshVolumeNegative` pass, `Law_HollowBoxOuterMeshVolumePositive` pass, `Law_HollowBoxMeshVolumeIsDifference` pass (first and third rechecked 2026-10-19 on the warm checker, cpu64); no new body needed in layers 2, 6 to 8 (sandbox/step-mesh-staging/genus/TRACK.md), the layer 1 rounding fix F-53 landed in 3f06da40, and 848b66d6 updated 02-topology/README.md
- [ ] Law_EulerPoincareEvenAndBounded passes; the negative witness Witness_TwoBoxesSharingCorner fails Law_VertexLinkIsOneCycle and only the laws it names; the laws run in the Plato interpreter (plato run --laws, TKT-317) and over the C# backend under cpu64 (TKT-315), and the two agree law by law

Part of the epic TKT-323 (the STEP mesher in Plato). Owner approval 2026-10-18. The step and its lists of functions and laws come from sandbox/step-brep-mesh/TASKS.md, the library's build order, where each step adds one harder kind of shape. A law is a Boolean function stating a property the code must have; a witness is a hand-built model with known counts, areas and volumes, so a failing law names the defect. Fence: the whole library folder, because a step adds bodies in several layers; two steps with this fence run one after the other unless the builder narrows the fence when claiming. New here: a solid with a hole through it (genus 1) and a solid with an internal cavity (a second, inward-facing shell), checked by Euler-Poincare counts rather than by comparing with another kernel.


Dependencies changed 2026-10-18 (plan docs/plans/step-mesher-parallel.md): step A's bodies exist, so this step starts now and is developed and checked on the Plato interpreter under cpu64. TKT-314 (step A's close) and TKT-315 (the C# writer and 64-bit profile, paused by the owner) are related, not blocking; the criterion that the C# backend agrees waits on TKT-315 and is checked by the supervisor at close.


TKT-328 waits on TKT-332 (the interpreter speed fix): its hollow-box and through-hole laws mesh whole models, which hit the 60 s budget today.

2026-10-18: dependency on TKT-332 dropped. Its speed work landed in Plato 93907bd7 (pinned for every builder): step A's whole-box laws ran in 171 s wall with nothing near the budget. TKT-332 stays open for its own reporting.

Log 2026-10-18 (topology session fa587ba3). Interpreter verdicts, Plato 93907bd7, cpu64, `--budget=900`, one compile, 17:54:42 to 17:55:29 (47 s wall). C# half not checked (TKT-315).
- New laws (this commit): `Law_BlockWithHoleMeshIsOneTorus` (one component, closed, consistently oriented, unpinched, Euler characteristic 0) pass; `Law_HollowBoxMeshIsTwoSpheres` (two components, each closed, oriented, unpinched, Euler 2) pass.
- Pass: `Law_HollowBoxVoidMeshVolumeNegative`, `Law_HollowBoxOuterMeshVolumePositive`, `Law_HollowBoxMeshVolumeIsDifference` (25 sampled sizes each, 14.1 s the slowest); `Law_EulerPoincareEvenAndBounded`, `Law_VertexLinkIsOneCycle` (25 samples); `Law_SharedCornerBreaksEuler`, `Law_SharedCornerBreaksVertexLink`, `Law_SharedCornerFailsExactlyTwoLaws` (Witness_TwoBoxesSharingCorner fails exactly its two laws); `Law_WitnessEulerIsTwoMinusTwiceGenus` (196 cases).
- Obligation on curved witnesses (steps B and F): `Law_WitnessDivergenceVolumeMatchesFacts`, `Law_WitnessMeshesOk`, `Law_WitnessMeshCrossChecksClean`, `Law_WitnessMeshValidatesClean`. Per witness through scratch laws (32 s; copy in the supervisor's notes folder, topology-scratch-g.laws.plato): the hollow box (k = 6) passes all five of those and `Law_WitnessIsOracleClean`; the block with a hole (k = 5) passes CrossChecksClean, ValidatesClean and divergence volume, and fails `WitnessMeshesOk` and `WitnessIsOracleClean` on one Error only, `Law_DerivativeMatchesCentralDifference`: layer 1's rounding bound at x = 0 (F-53, with step B).
- So no new body is needed in layers 2 and 6 to 8; box 1 waits on that layer 1 fix, box 2 on the backend.

2026-10-19, closer (supervisor of docs/plans/step-mesher-v2.md): box 1 ticked. Stays open on box 2: its interpreter half passes (`Law_EulerPoincareEvenAndBounded`, `Law_VertexLinkIsOneCycle`, `Law_SharedCornerBreaksEuler`, `Law_SharedCornerBreaksVertexLink`, `Law_SharedCornerFailsExactlyTwoLaws` pass in reviews/verdicts-cpu64.tsv), but no C# backend run exists. Waits on a C# run of these laws: the library's layers regenerated to C# under cpu64 (TKT-313, track E, blocked by TKT-347, the C# writer dropping List-first functions) and its laws run over the C# backend.
