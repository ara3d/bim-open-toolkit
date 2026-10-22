---
id: TKT-465
title: Seam vertices on periodic faces sit 0.5 mm from the surface at their parameters, and their elements read as flipped
status: done
depends_on: []
owner: v1-reliability
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-323]
confidence: medium
created: 2026-10-22
closed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [x] on JODY-W5 and W6 CARD faces 322, 444, 584 and NINA-B222-W1x2 face 678 every element corner lies within the length tolerance of the surface at its parameter, and no element is flipped

Corpus run 2026-10-22. SHO/M2_JODY-W5 and W6 CARD.STEP B-spline faces 322, 444, 584 (8 of 19 elements flipped each) and SHO/NINA-B222-W1x2.STEP cylinder face 678 (1 of 8): the flipped elements touch the seam u = 2*pi (JODY) or a vertex at u = pi (NINA-B222), and those corners' 3D positions lie 0.45 to 0.5 mm from the surface evaluated at their parameters (corner gaps of other elements: 1e-13). So a seam vertex's position (from the shared edge) and its parameter in the face disagree: either the parameter is on the wrong side of the seam or the B-spline surface is not closed where the edge says it is. Owner to confirm: face meshing or the B-spline track.

Owner: v1-close, which is bisecting the JODY-W5/W6 regression and may be looking at the same faces (supervisor, 2026-10-22).

## Resolution (merger, 2026-10-22)

Two causes. Cause A (JODY faces 322, 444, 584): a closed B-spline direction was evaluated at unwrapped parameters
and extrapolated; R2A, merged in 640a2005, evaluates layer 1's index-level entry points at the copy in the range.
Cause B (NINA-B222 face 678): the closest-parameter search on near-periodic 2D lines landed whole turns away; J5
(TKT-414, 3cc7edb4) fixed it. Evidence: `Law_V1Reliability_JodyCornersOnSurface` (fails before R2A) and
`Law_V1Reliability_NinaB222Face678CornersOnSurface` (fails before J5) pass on HEAD, each corner within 1e-4 mm of
its surface; the track's scratch regenerations: JODY-W5/W6 0 flipped elements with the contract holding, NINA-B222-W1x2
closed and oriented with the contract holding on its 1,007 faces. The laws' bound is 1e-4 mm, not the model's
length tolerance; the regenerations' contract check is what reads the flipped elements.
