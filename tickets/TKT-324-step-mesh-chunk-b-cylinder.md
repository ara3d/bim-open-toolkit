---
id: TKT-324
title: STEP mesher in Plato, step B: mesh the cylinder (circles, curved faces, the seam cut, refinement to tolerance, quad meshes)
status: open
depends_on: [TKT-314, TKT-315]
owner:
fence: [sandbox/step-brep-mesh/**]
workflow: [W3, W4]
related: [TKT-323, TKT-316]
confidence: high
created: 2026-10-18
---

## Acceptance criteria

- [ ] bodies for the layer 1 Circle and Cylinder arms, layer 4 RefineEdge, and layer 5 QuadSidesOf, QuadGrid and MatchingFloors; every body this step owns is written in Plato, no throwaway C# body remains, and the deferred-body count in each touched layer README is updated
- [ ] Witness_Cylinder(r, h, 2 pi) with its seam, the band without a seam, the sector Witness_Cylinder(r, h, sweep), and the same with PreferQuads true mesh closed and oriented, with the cylinder area and volume oracles (closed-form answers) met
- [ ] Law_StepDecreasesMeasure, Law_RefinementNeverCoarsens, Law_OnlyFacesOfChangedEdgesAreRemeshed, Law_RequestsNameEdgesOfTheirFace, Law_PendingRequestIsInSomeOutcome, and Law_TighterChordalStaysWithinLooserBound at three chordal bounds pass, and every step A law still passes; the laws run in the Plato interpreter (plato run --laws, TKT-317) and over the C# backend under cpu64 (TKT-315), and the two agree law by law

Part of the epic TKT-323 (the STEP mesher in Plato). Owner approval 2026-10-18. The step and its lists of functions and laws come from sandbox/step-brep-mesh/TASKS.md, the library's build order, where each step adds one harder kind of shape. A law is a Boolean function stating a property the code must have; a witness is a hand-built model with known counts, areas and volumes, so a failing law names the defect. Fence: the whole library folder, because a step adds bodies in several layers; two steps with this fence run one after the other unless the builder narrows the fence when claiming. A cylinder is the first curved shape. New here: circles with closed-form arc counts, closed edges, cutting a closed surface along a seam so it can be flattened for triangulation, stretched (anisotropic) triangles, refining the mesh until it is within the chordal tolerance of the surface, and structured quad meshes. Needs 64-bit numbers (TKT-315).
