---
id: TKT-422
title: STEP decoder: a file written with entity short names (CRTPNT, PLYLP, FCSRF) decodes to no faces; STEP Tools' clip.stp gives 0 faces
status: claimed
depends_on: []
owner: session 0d12cac2
session: 0d12cac2-46fb-4ad4-b4ca-2a2a83bdf507
fence: [deps/bim-open-data/src/data/Ara3D.Step.Decode/**, deps/bim-open-data/src/data/Ara3D.Step.Entities/**]
workflow: [W3]
related: [TKT-305, TKT-323]
created: 2026-10-22
claimed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [x] STEP Tools' clip.stp (data/step-samples/steptools-ap203) decodes to its 155 faces, with the STEP-SHORT-NAMES diagnostic reported
- [x] A test decodes one short-name file and its long-name twin to the same raw model

Found 2026-10-22 while adding public samples to the STEP mesher gallery (`docs/plans/step-mesher-gallery.md`). `data/step-samples/steptools-ap203/clip.stp` writes every entity by its AP203 short name: 501 `CRTPNT` (CARTESIAN_POINT), 362 `DRCTN`, 155 `PLYLP` (POLY_LOOP), 155 `PLANE`, 155 `FCSRF` (FACE_SURFACE), 155 `FCOTBN` (FACE_OUTER_BOUND), 39 `TRMCRV`, 30 `LINE`, 9 `CIRCLE`. The harness's `one` mode reports status done, 0 faces, 0 edges: the C# decoder matches long names only, so nothing is recognised and nothing is reported. The Plato library already has the diagnostic `STEP-SHORT-NAMES` (`StepDiagnosticCode.ShortNamesUsed`), so the expansion table belongs to the C# side, which reads the file.

After the expansion the faces are bounded by poly loops, which version 1 reports as `FACE-POLY-LOOP` and does not mesh, so this fix alone yields diagnosed faces, not triangles.
