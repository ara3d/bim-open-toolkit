---
id: TKT-326
title: STEP mesher in Plato, step D: PrepareModel, the Plato half of reading a file (closure, mirrored parts, tolerances, repairs)
status: open
depends_on: [TKT-314]
owner:
fence: [sandbox/step-brep-mesh/**]
workflow: [W3, W4]
related: [TKT-323, TKT-312]
confidence: high
created: 2026-10-18
---

## Acceptance criteria

- [ ] PrepareModel(raw): DecodedModel and every function it composes have bodies, including Reduced and ToleranceDiagnostics, which TKT-312 found missing; every body this step owns is written in Plato, no throwaway C# body remains, and the deferred-body count in each touched layer README is updated
- [ ] Law_PrepareIsIdempotent, Law_PrepareKeepsPointSet, Law_RawHasNoClosures, Law_RawHasNoClosedPeriodicity, Law_UnitsFactorsAgree, Law_CurveClosureDecidedByEnds, Law_SurfaceClosureDecidedBySides, Law_ClosureMarksAreTheDecisions and the fold laws pass; the laws run in the Plato interpreter (plato run --laws, TKT-317) and over the C# backend under cpu64 (TKT-315), and the two agree law by law
- [ ] Law_RawUnitCubePreparesToUnitBox and Law_RawTwoCubesPreparesToTwoBodies pass on the library's witnesses, and TKT-312's open criterion (the same two laws with the C# decoder's output) can then be checked

Part of the epic TKT-323 (the STEP mesher in Plato). Owner approval 2026-10-18. The step and its lists of functions and laws come from sandbox/step-brep-mesh/TASKS.md, the library's build order, where each step adds one harder kind of shape. A law is a Boolean function stating a property the code must have; a witness is a hand-built model with known counts, areas and volumes, so a failing law names the defect. Fence: the whole library folder, because a step adds bodies in several layers; two steps with this fence run one after the other unless the builder narrows the fence when claiming. The C# decoder (TKT-312) hands Plato the model exactly as the file writes it (RawDecodedModel). PrepareModel makes the four decisions that are geometry: which curves and surfaces are closed (their ends coincide within the length tolerance), flipping left-handed (mirrored) placements, tolerance floors set from the model's size, and repairs of degenerate pieces. Until it has bodies, no real STEP file can be meshed. Uses step A's ScaledBy, RigidlyMoved, ReducedCounts and IsSameModel.
