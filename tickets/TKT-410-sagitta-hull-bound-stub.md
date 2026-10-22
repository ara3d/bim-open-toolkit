---
id: TKT-410
title: STEP mesher: the compiler emits BisectionCached.SagittaByHullBoundGiven as a throwing stub (no ground TIR for a moved member), so 24,439 of 40,378 B-spline edges and all 20,684 surface-curve edges of the corpus throw and 22,410 faces go unmeshed
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/04-discretization/**]
workflow: [W3]
related: [TKT-313, TKT-327, TKT-348]
created: 2026-10-21
kind: defect
---

## Acceptance criteria

- [ ] A corpus rerun (docs/plans/step-mesher-corpus-2026-10-21.md, How to rerun) reports no edge throwing NotImplementedException from SagittaByHullBoundGiven
- [ ] Either the Plato compiler monomorphizes the moved member (a Plato-side fix, with the commit named here) or the library calls the sagitta bound through a form the compiler grounds, with a law that the two agree on the corpus witnesses

Found by the corpus rerun of 2026-10-21 (library 8984df4b, bim-open-data 3245cb7). regen-step-brep.ps1 reports one DEGRADED body: 'BisectionCached.SagittaByHullBoundGiven [recv BrepModel]', emitted as a throwing stub; the message at run time is 'plato: no ground TIR for moved member BisectionCached.SagittaByHullBoundGiven [recv BrepModel] (not monomorphized)'. Run A's baseline files never reached it. In the corpus, every edge whose sagitta falls to the hull bound reaches it: 24,439 of 40,378 B-spline edges over 71 files (CEL/LARA.STEP 566 of 1,100; CEL/LENA-R8.STEP 488 of 562; 2 files lose every B-spline edge) and all 20,684 SURFACE_CURVE edges of SHO/ELLA-W1.STEP (every one on plane+plane). The faces that cite a thrown edge are unmeshed with PIPELINE-FACE-UNDISCRETIZED: 11,290 planes, 9,050 B-spline faces, 1,618 cylinders, 232 extrusions, 112 cones, 91 tori, 17 spheres, 22,410 in all, the largest cause of the 73 partly meshed files. Examples: CEL/LARA.STEP edge 1993 (bspline on bspline+plane), SHO/ELLA-W1.STEP edge 0 (on-surface, plane+plane).
