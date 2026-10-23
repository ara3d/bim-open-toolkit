---
id: TKT-480
title: STEP mesher: Law_CollidingSegmentsAgreesOnModel compares the version 1 MeshRegion with the pre-version-1 MeshRegionBody, so it fails on every zero-width face
status: claimed
depends_on: []
owner: v1-gate
fence: [sandbox/step-brep-mesh/08-pipeline/pipeline-collide.laws.plato, sandbox/step-brep-mesh/05-face-meshing/face-meshing-collide.library.plato, sandbox/step-mesh-staging/v1-gate/**]
workflow: [W3]
related: [TKT-456]
confidence: high
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] FaceCollisionsAgree compares only what the collision index decides: CollidingSegments' flags against SegmentCollides' scan, segment by segment
- [ ] Law_CollidingSegmentsAgreesOnModel passes on every model witness, the zero-width corpus witnesses ANNA-B4 491 and ODIN-W260 2625 among them, and fails when the scan reference is broken
- [ ] MeshRegionBody is deleted when nothing else reads it

Found by the merge of V1G-19 (v1-gate TRACK.md, 6c565001). FaceCollisionsAgree (08-pipeline/pipeline-collide.laws.plato) asks, on a region that is not simple, that MeshRegionBody (05-face-meshing/face-meshing-collide.library.plato, the pre-version-1 body: a colliding region gets NotSimpleOutcome) give MeshRegion's outcome. MeshRegion is MeshRegionOnceV1, whose version 1 rules give a zero-width region ZeroWidthOutcome (ZeroWidthMeshedOutcome with V1G-19), so the two disagree on any zero-width face: case 16, Witness_AnnaB4Face491. The law had run past the 120 s cap before, so it never reached that case. The whole-outcome comparison tests the version 1 rules against a body the mesher no longer runs; what the collision index decides is the set of colliding segments. Owner: v1-gate (V1G-21).
