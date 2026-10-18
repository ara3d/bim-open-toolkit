---
id: TKT-325
title: STEP mesher in Plato, step C: mesh the sphere, torus and cone (poles, surfaces closed in two directions, the cone's tip)
status: open
depends_on: [TKT-324]
owner:
fence: [sandbox/step-brep-mesh/**]
workflow: [W3, W4]
related: [TKT-323]
confidence: high
created: 2026-10-18
---

## Acceptance criteria

- [ ] bodies for layer 1 LimitNormal and the Sphere, Torus and Cone arms; every body this step owns is written in Plato, no throwaway C# body remains, and the deferred-body count in each touched layer README is updated
- [ ] Witness_Sphere(r), Witness_SphereByPoleLoops(r), Witness_Torus(R, r) and Witness_Cone(r, h) mesh closed and oriented; the negative witness Witness_SphereWithRedundantPoleLoops(r) fails exactly the laws it names
- [ ] every step A and B law passes on these shapes; the torus has Euler characteristic 0; the torus volume oracle holds over a boundary that wraps in v; Gauss-Bonnet (total curvature equals 2 pi times the Euler characteristic) holds on every closed mesh; the laws run in the Plato interpreter (plato run --laws, TKT-317) and over the C# backend under cpu64 (TKT-315), and the two agree law by law

Part of the epic TKT-323 (the STEP mesher in Plato). Owner approval 2026-10-18. The step and its lists of functions and laws come from sandbox/step-brep-mesh/TASKS.md, the library's build order, where each step adds one harder kind of shape. A law is a Boolean function stating a property the code must have; a witness is a hand-built model with known counts, areas and volumes, so a failing law names the defect. Fence: the whole library folder, because a step adds bodies in several layers; two steps with this fence run one after the other unless the builder narrows the fence when claiming. New here: poles, where a whole edge of the surface's parameter rectangle collapses to one point; triangles dropped there; degenerate edges of one segment; a torus, closed in both directions, needing two seam cuts; and the cone's tip.
