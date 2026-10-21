---
id: TKT-406
title: STEP mesher: refinement's 15 degree surface-angle criterion is unattainable on boundary chords spanning over 30 degrees of arc, so it inserts points until the guards refuse
status: open
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/eval-angle/**]
workflow: [W3]
related: [TKT-323, TKT-405, TKT-346]
created: 2026-10-21
kind: defect
---

## Acceptance criteria

- [ ] A law states that on every witness face the refinement test's SideNormalsTurn flag is attainable: either layer 04 raises a curve-on-curved-surface edge's segment count to at least ceil(arc / surface angle), or the first pass refuses a triangle whose constrained side's end normals already differ by over twice the angle, and the chosen form is named in the plan
- [ ] On the four baseline files of docs/plans/step-mesher-ideas-evaluation.md with PreferQuads off, the 9-to-16-edge cylinder family (36 faces, 247 ms, 6.3% of face time) and the four-edge family show their flag counts and triangle counts before and after, and every mesh stays closed and oriented

Idea 28 of the speed-ideas evaluation, found by run C: on the four baseline files all 82,450 refinement flags came from the 15 degree SideNormalsTurn criterion and none from the chordal criteria; EMMY-W1 face 365 went from 10 boundary points to 720 triangles over 13 passes without ever meeting it, because a boundary chord on an arc of over 30 degrees cannot. The quad strip (TKT-405) sidesteps this on the faces it reaches; the faces it does not reach keep paying. Staging rules: sandbox/step-mesh-staging/README.md.
