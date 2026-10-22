---
id: TKT-426
title: STEP mesher: Law_WellFormedBSplineKeepsRecord fails at k = 0 compiled and passes interpreted (FINDINGS F-59)
status: open
depends_on: []
owner:
fence: [C:/Users/cdigg/git/plato/**]
workflow: [W3]
related: [TKT-348]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] StepToMeshProofsBSplinesLaws.Law_WellFormedBSplineKeepsRecord gives the same verdict on both backends of the pinned CLI, and that verdict is pass

Recorded in reviews/FINDINGS.md F-59 (2026-10-21, chunk D1) as a compiled-backend discrepancy that predates D1 (control run on a git archive copy, pinned CLI e37c032f, cpu64); no ticket held it until the v1-gate track's triage (V1G-5, 2026-10-22). Gate kind: structure (a well-formed B-spline keeps its record through decoding). Fence: v1-compiler (the Plato compiler's C# backend).
