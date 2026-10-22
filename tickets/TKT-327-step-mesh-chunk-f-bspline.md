---
id: TKT-327
title: STEP mesher in Plato, step F: mesh B-spline (freeform) faces
status: claimed
depends_on: []
owner: session cab91351
session: cab91351-5bf8-4a98-95e5-92d43c79efbf
fence: [sandbox/step-brep-mesh/**]
workflow: [W3, W4]
related: [TKT-323]
confidence: high
created: 2026-10-18
claimed: 2026-10-18
---

## Acceptance criteria

- [x] bodies for layer 1 BSplinePoint, BSplineDerivative, BSplinePartial, ClosestParameterBySearch, ProjectBySearch and ProjectNearBySearch, and layer 4 Sagitta; every body this step owns is written in Plato, no throwaway C# body remains, and the deferred-body count in each touched layer README is updated
- [x] Witness_BSplinePatchSolid(bump) meshes closed within the area bound of layer 7's witness table; its MaxRefinementRounds 0 variant reports PIPELINE-FACE-UNRESOLVED; a self-intersecting loop produces a LoopSelfIntersects request
- [ ] every law of steps A to C passes on the B-spline witness; the laws run in the Plato interpreter (plato run --laws, TKT-317) and over the C# backend under cpu64 (TKT-315), and the two agree law by law

Part of the epic TKT-323 (the STEP mesher in Plato). Owner approval 2026-10-18. The step and its lists of functions and laws come from sandbox/step-brep-mesh/TASKS.md, the library's build order, where each step adds one harder kind of shape. A law is a Boolean function stating a property the code must have; a witness is a hand-built model with known counts, areas and volumes, so a failing law names the defect. Fence: the whole library folder, because a step adds bodies in several layers; two steps with this fence run one after the other unless the builder narrows the fence when claiming. Most faces in real STEP files of manufactured parts are B-splines. New here: edge seeds placed at knots, bounding the error by the control hull's sagitta, and finding a point's surface parameters by search, since B-splines have no closed-form inverse.

2026-10-18: no longer waits on TKT-325. Plan docs/plans/step-mesher-v2.md runs steps C and F as independent tracks in their own staging folders (sandbox/step-mesh-staging/bspline).
- 2026-10-22, session cab91351 (track E, L5). Both backends on the library exported at toolkit cd33c998 (layers last changed in c47db0b3), stdlib from Plato e37c032f without `brep.*`, CLI `C:/Users/cdigg/.plato-cli/e37c032f`, cpu64: compiled C# with `--budget=2 --parallel=6`, interpreter with `--budget=120`; laws matched as Block.Law, overloads joined. Columns: law, interpreter, compiled C#.
  Box 1: the six layer 1 bodies and `Sagitta` are Plato (`geometry-splines`, `geometry-surfaces`, `geometry-curves`, `BsplineSagitta`) and `01-geometry/README.md` records them under the deferred table. Ticked. Box 2: the three named laws pass on both. Ticked.
  | Law | Interpreter | Compiled |
  |---|---|---|
  | `BsplinePipelineLoopRunLaws.Law_BumpSolidMeshesClosedWithinAreaBound` | pass | pass |
  | `BsplinePipelineLoopRunLaws.Law_NoRoundsLeaveCrossingFaceUnresolved` | pass | pass |
  | `BsplinePipelineLoopRunLaws.Law_CrossingLoopAsksLoopSelfIntersects` | pass | pass |
  Box 3, the step A to C laws on the B-spline witness: `Law_BumpSolidValidatesStructurally` fails on both backends (agree; the bump top's element, TKT-401 and TKT-415, v1-faces); `Law_BumpSolidLoopLaws`, `Law_BumpSolidWatertightLaws`, `Law_BumpSolidMeshAgainstModelLaws` pass on both; `Law_BumpSolidNeedsNoRound` passes compiled and runs out of time in the interpreter (242 s); `Law_BumpTopAreaInBracket` passes in the interpreter and exceeds the compiled budget (7.6 s); `BsplinePipelineLaws.Law_TighterChordalStaysWithinLooserBound` runs out of time on both (TKT-356). Stays open on TKT-401/TKT-415 (v1-faces) and TKT-356.
