---
id: TKT-410
title: STEP mesher: the compiler emits BisectionCached.SagittaByHullBoundGiven as a throwing stub (no ground TIR for a moved member), so 24,439 of 40,378 B-spline edges and all 20,684 surface-curve edges of the corpus throw and 22,410 faces go unmeshed
status: done
depends_on: []
owner: session f58080da
session: f58080da-237d-478d-a779-1bc570009dc2
fence: [sandbox/step-brep-mesh/04-discretization/**]
workflow: [W3]
related: [TKT-313, TKT-327, TKT-348]
created: 2026-10-21
claimed: 2026-10-21
closed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [x] A corpus rerun (docs/plans/step-mesher-corpus-2026-10-21.md, How to rerun) reports no edge throwing NotImplementedException from SagittaByHullBoundGiven
- [x] Either the Plato compiler monomorphizes the moved member (a Plato-side fix, with the commit named here) or the library calls the sagitta bound through a form the compiler grounds, with a law that the two agree on the corpus witnesses

Found by the corpus rerun of 2026-10-21 (library 8984df4b, bim-open-data 3245cb7). regen-step-brep.ps1 reports one DEGRADED body: 'BisectionCached.SagittaByHullBoundGiven [recv BrepModel]', emitted as a throwing stub; the message at run time is 'plato: no ground TIR for moved member BisectionCached.SagittaByHullBoundGiven [recv BrepModel] (not monomorphized)'. Run A's baseline files never reached it. In the corpus, every edge whose sagitta falls to the hull bound reaches it: 24,439 of 40,378 B-spline edges over 71 files (CEL/LARA.STEP 566 of 1,100; CEL/LENA-R8.STEP 488 of 562; 2 files lose every B-spline edge) and all 20,684 SURFACE_CURVE edges of SHO/ELLA-W1.STEP (every one on plane+plane). The faces that cite a thrown edge are unmeshed with PIPELINE-FACE-UNDISCRETIZED: 11,290 planes, 9,050 B-spline faces, 1,618 cylinders, 232 extrusions, 112 cones, 91 tori, 17 spheres, 22,410 in all, the largest cause of the 73 partly meshed files. Examples: CEL/LARA.STEP edge 1993 (bspline on bspline+plane), SHO/ELLA-W1.STEP edge 0 (on-surface, plane+plane).

## Resolution (2026-10-22, Plato 0ef7e686; pin c8c83c8b)

A Plato-side fix. The resolver gives a `match` its sum type before type checking, from the function group of the subject call; a function joins its group in the same loop that resolves bodies, and in the regen's one input folder `discretization-ranged-bisection.library.plato` sorts before `geometry.library.plato`, which declares `CurveAt`. The group was empty, the match had no sum type (CHK304, which the CLI does not print), and the body's TIR was unresolved. Plato 0ef7e686 makes `SumTypeOfCall` read declared methods' return types too (resolved before any body), with the fixture `tests/plato-test-sum/match-on-later-library-call.plato`; the library needs no change, so the second half of the criterion (a library restatement with an agreement law) does not apply. A degraded body's log line now names its cause.

Corpus rerun (88 files, `step-corpus-harness all ... 120 --path host --parallel --warmup`; bim-open-data 58f6fcb regenerated in a scratch clone with `regen-step-brep.ps1 -PlatoCommit c8c83c8b`, library 83a5da13): 0 generated stubs; 0 edges throw (24,439 B-spline and 20,684 surface-curve edges did); 0 edge or face rows cite SagittaByHullBoundGiven; 67 files fully meshed and 20 partly (14 and 73 before); 191,315 of 191,450 faces meshed (99.9%, 88.3% before); 1 file over 120 s (NINA-B222-W1x2, TKT-414). What remains: 30 faces with ArgumentOutOfRangeException (TKT-411), 24 one-edge plane faces in the two M2-JODY-W377 files whose B-spline edge now returns 0 segments without an exception, and the not-simple planes (TKT-412).
