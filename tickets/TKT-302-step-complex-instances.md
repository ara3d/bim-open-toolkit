---
id: TKT-302
title: Ara3D.IO.StepParser reads complex instances: a definition holds every partial entity with its own attribute list
status: open
depends_on: [TKT-301]
owner:
fence: [deps/ara3d-sdk/src/Ara3D.IO.StepParser/**, deps/ara3d-sdk/tests/**, deps.json]
workflow: [W3, W4]
confidence: high
created: 2026-10-17
---

## Acceptance criteria

- [ ] a definition written #n=(A(...)B(...)...); exposes each partial entity's name and attribute list, in file order
- [ ] simple definitions keep their current API and token layout; existing IFC loading tests pass
- [ ] a test covers a rational B-spline surface and an SI length unit written as complex instances
- [ ] the bim-open-toolkit deps.json pin for ara3d-sdk moves to the pushed commit

Plan: docs/plans/step-reader.md (reading STEP geometry in C# the way IFC is read: generated schema types from EXPRESS via Parakeet). Gap 3.
