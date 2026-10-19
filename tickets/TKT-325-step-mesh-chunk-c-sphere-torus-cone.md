---
id: TKT-325
title: STEP mesher in Plato, step C: mesh the sphere, torus and cone (poles, surfaces closed in two directions, the cone's tip)
status: claimed
depends_on: []
owner: session 81f546ae
session: 81f546ae-4c48-48bb-aa18-dfabd21e83ad
fence: [sandbox/step-brep-mesh/**]
workflow: [W3, W4]
related: [TKT-323, TKT-324, TKT-315]
confidence: high
created: 2026-10-18
claimed: 2026-10-18
---

## Acceptance criteria

- [ ] bodies for layer 1 LimitNormal and the Sphere, Torus and Cone arms; every body this step owns is written in Plato, no throwaway C# body remains, and the deferred-body count in each touched layer README is updated
- [ ] Witness_Sphere(r), Witness_SphereByPoleLoops(r), Witness_Torus(R, r) and Witness_Cone(r, h) mesh closed and oriented; the negative witness Witness_SphereWithRedundantPoleLoops(r) fails exactly the laws it names
- [ ] every step A and B law passes on these shapes; the torus has Euler characteristic 0; the torus volume oracle holds over a boundary that wraps in v; Gauss-Bonnet (total curvature equals 2 pi times the Euler characteristic) holds on every closed mesh; the laws run in the Plato interpreter (plato run --laws, TKT-317) and over the C# backend under cpu64 (TKT-315), and the two agree law by law

Part of the epic TKT-323 (the STEP mesher in Plato). Owner approval 2026-10-18. The step and its lists of functions and laws come from sandbox/step-brep-mesh/TASKS.md, the library's build order, where each step adds one harder kind of shape. A law is a Boolean function stating a property the code must have; a witness is a hand-built model with known counts, areas and volumes, so a failing law names the defect. Fence: the whole library folder, because a step adds bodies in several layers; two steps with this fence run one after the other unless the builder narrows the fence when claiming. New here: poles, where a whole edge of the surface's parameter rectangle collapses to one point; triangles dropped there; degenerate edges of one segment; a torus, closed in both directions, needing two seam cuts; and the cone's tip.

2026-10-18: dependency on TKT-324 dropped. Step B's bodies are in (criteria 1 and 2 met, b3c038b0); its open half is the C# backend (TKT-315, paused) and a runner verdict that itself needs this step's ExpandedPoles. Step C continues in step B's session with the same fence.

## Log

- 2026-10-19, session 81f546ae, poles track of plan version 2 (staging folder `sandbox/step-mesh-staging/poles`; fence narrowed to it and this file). Bodies staged for `LimitNormal`, `ExpandedPoles` and `CutWholePeriods`, plus `WithSeamCutAll`, test mirrors and 26 `Law_Poles_*` laws; `TRACK.md` there holds the verdicts, merge instructions, requests and findings, and sets `Status: ready to merge`.
- Criterion 1: the bodies are written in Plato and staged; no C# body. The deferred counts in the layer 01 and 05 READMEs change at merge (one fewer in layer 01, two fewer in layer 05), as the merge instructions say.
- Criterion 2: the seamed sphere, the sphere bounded by its pole vertices, the torus and the cone mesh closed and consistently oriented with the right Euler characteristic and volume (gpu32, before the wave 1 merges). The negative witness meshes as the seamed sphere does; whether it fails exactly its named layer 02 laws is unchanged by this track.
- Criterion 3 is not met. The torus has Euler characteristic 0 and its volume oracle holds; Gauss-Bonnet holds under cpu64 (gaps below 1e-10) but not under gpu32 (layer 07's float sum). Open: one sphere element of 1,913 that refinement flags but cannot split; the torus face checks fail for a reason not yet found; whole-model laws exceed the budget on the merged library; the C# backend half.
