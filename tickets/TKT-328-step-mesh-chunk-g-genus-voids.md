---
id: TKT-328
title: STEP mesher in Plato, step G: solids with holes and hollow solids (genus and voids)
status: open
depends_on: [TKT-332]
owner:
fence: [sandbox/step-brep-mesh/**]
workflow: [W3, W4]
related: [TKT-323, TKT-314, TKT-315]
confidence: high
created: 2026-10-18
---

## Acceptance criteria

- [ ] Witness_BlockWithThroughHole meshes with Euler characteristic 0 and the expected component counts; Witness_HollowBox meshes with its inner (void) shell giving negative volume; any bodies these need are written in Plato and the layer READMEs updated
- [ ] Law_EulerPoincareEvenAndBounded passes; the negative witness Witness_TwoBoxesSharingCorner fails Law_VertexLinkIsOneCycle and only the laws it names; the laws run in the Plato interpreter (plato run --laws, TKT-317) and over the C# backend under cpu64 (TKT-315), and the two agree law by law

Part of the epic TKT-323 (the STEP mesher in Plato). Owner approval 2026-10-18. The step and its lists of functions and laws come from sandbox/step-brep-mesh/TASKS.md, the library's build order, where each step adds one harder kind of shape. A law is a Boolean function stating a property the code must have; a witness is a hand-built model with known counts, areas and volumes, so a failing law names the defect. Fence: the whole library folder, because a step adds bodies in several layers; two steps with this fence run one after the other unless the builder narrows the fence when claiming. New here: a solid with a hole through it (genus 1) and a solid with an internal cavity (a second, inward-facing shell), checked by Euler-Poincare counts rather than by comparing with another kernel.


Dependencies changed 2026-10-18 (plan docs/plans/step-mesher-parallel.md): step A's bodies exist, so this step starts now and is developed and checked on the Plato interpreter under cpu64. TKT-314 (step A's close) and TKT-315 (the C# writer and 64-bit profile, paused by the owner) are related, not blocking; the criterion that the C# backend agrees waits on TKT-315 and is checked by the supervisor at close.


TKT-328 waits on TKT-332 (the interpreter speed fix): its hollow-box and through-hole laws mesh whole models, which hit the 60 s budget today.
