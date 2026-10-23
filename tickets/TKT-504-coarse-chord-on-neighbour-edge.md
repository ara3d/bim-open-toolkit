---
id: TKT-504
title: STEP mesher: at a chordal bound near a face's own radius, a coarse triangle's chord can lie on a neighbouring face's edge or generator, so the assembled mesh has a non-manifold edge (Witness_CrossHole at chordal 1.0)
status: claimed
depends_on: []
owner: v1-gate
fence: [sandbox/step-brep-mesh/05-face-meshing/**, sandbox/step-mesh-staging/v1-gate/**]
workflow: [W3]
related: [TKT-484, TKT-460]
confidence: high
created: 2026-10-23
kind: defect
---

## Acceptance criteria

- [ ] A law over Witness_CrossHole meshed by the host's options at chordal 1.0 states no non-manifold and no misoriented edge, and fails on the library with V1G-22 before the fix
- [ ] The fix keeps the guard set's mesh digests and the 88 corpus files no worse

Found by V1G-22 (v1-gate TRACK.md, cd394dd9). With the band's seam cut moved clear of its holes, Witness_CrossHole meshed by the harness's gallery mode at its default chordal bound (1.0, the band's own radius) has 1 non-manifold and 2 misoriented edges; at 0.01 it is closed and oriented. The bad edge runs straight between two model vertices at (0.917, 0.4, 1.5) and (-0.917, 0.4, 1.5), on the two hole loops, which the band (face 2) and the bore (face 3) share. The bore has that segment as a straight generator; the coarse band has it too, as a chord across the cylinder's inside, whose 0.6 sagitta is within the 1.0 bound. Two faces then use one mesh edge, each from both sides. It is not V1G-15's case (a triangle whose three corners lie on one model edge): the chord joins vertices on two different edges. The corpus meshes small features at a 1 mm bound that is often their own radius (ODIN's 0.2 mm fillets), so a chord landing on a neighbour's edge or generator is a real way to a non-manifold edge. Owner: v1-gate (V1G-23), after V1G-22 merges.
