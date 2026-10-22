---
id: TKT-406
title: STEP mesher: refinement's 15 degree surface-angle criterion is unattainable on boundary chords spanning over 30 degrees of arc, so it inserts points until the guards refuse
status: done
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/perf-angle/**]
workflow: [W3]
related: [TKT-323, TKT-405, TKT-346]
created: 2026-10-21
closed: 2026-10-21
kind: defect
---

## Acceptance criteria

- [ ] A law states that on every witness face the refinement test's SideNormalsTurn flag is attainable: either layer 04 raises a curve-on-curved-surface edge's segment count to at least ceil(arc / surface angle), or the first pass refuses a triangle whose constrained side's end normals already differ by over twice the angle, and the chosen form is named in the plan
- [ ] On the four baseline files of docs/plans/step-mesher-ideas-evaluation.md with PreferQuads off, the 9-to-16-edge cylinder family (36 faces, 247 ms, 6.3% of face time) and the four-edge family show their flag counts and triangle counts before and after, and every mesh stays closed and oriented

Idea 28 of the speed-ideas evaluation, found by run C: on the four baseline files all 82,450 refinement flags came from the 15 degree SideNormalsTurn criterion and none from the chordal criteria; EMMY-W1 face 365 went from 10 boundary points to 720 triangles over 13 passes without ever meeting it, because a boundary chord on an arc of over 30 degrees cannot. The quad strip (TKT-405) sidesteps this on the faces it reaches; the faces it does not reach keep paying. Staging rules: sandbox/step-mesh-staging/README.md.

## Builder notes (2026-10-21)

Built in `sandbox/step-mesh-staging/perf-angle` (TRACK.md there has the measurements and the one wiring line). Neither form above: the cause is layer 04's minimum-length cap (`ArcLengthCap`), which leaves arcs of one to five segments on small radii, and form (a) would break that cap while form (b) changed nothing on 18 degree chords. The chosen form exempts a side from the 15 degree test when its chord is shorter than twice the minimum length, the length the insertion guard cannot halve. Laws over the 42 triangulated witnesses and six capped models show it changes no library witness mesh and leaves fewer unmet flags and no more triangles on capped faces, with closed, oriented meshes.

Box 1 is left for the supervisor: the laws exist, but the form is a third one and naming it in the plan is outside this fence. Box 2 needs the four-file harness run, which is the supervisor's.

## Closed with criteria unmet

2026-10-21: Box 1: the law Law_SideNormalsTurnAttainable states the flag is attainable on every witness face, but by a third form, measured against both named ones: the cause is layer 04's minimum-length cap (every arc is already split to 15 degrees unless the cap binds), so raising counts (a) would undo the cap and the first-pass refusal (b) changed nothing at 18 degree chords; a side counts for the angle test only when its chord is at least twice the minimum length (recorded in docs/plans/step-mesher-ideas-evaluation.md idea 28 and the complexity ledger). Box 2: the four-file harness counts are the host re-measure after the wave lands (run A's harness is in deps/bim-open-data, outside this fence); the witness numbers are in the ledger row
