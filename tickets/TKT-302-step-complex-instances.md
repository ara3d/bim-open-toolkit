---
id: TKT-302
title: Ara3D.IO.StepParser reads complex instances: a definition holds every partial entity with its own attribute list
status: done
depends_on: []
owner: session 10b9c9c6
session: 10b9c9c6-0052-40f3-a1c2-c12f2f8861d7
fence: [deps/ara3d-sdk/src/Ara3D.IO.StepParser/**, deps/ara3d-sdk/tests/**, deps.json]
workflow: [W3, W4]
confidence: high
created: 2026-10-17
claimed: 2026-10-17
closed: 2026-10-17
---

## Acceptance criteria

- [x] a definition written #n=(A(...)B(...)...); exposes each partial entity's name and attribute list, in file order
- [x] simple definitions keep their current API and token layout; existing IFC loading tests pass (checked instead by dumping every definition of four IFC files before and after: byte-identical; correction: the IFC projects build the parser from deps/ara3d-sdk source through bim-open-data's Directory.Build.targets, so they do run this change, and Ara3D.Ifc.Tests was run in full afterwards, see the plan's build log)
- [x] a test covers a rational B-spline surface and an SI length unit written as complex instances
- [x] the bim-open-toolkit deps.json pin for ara3d-sdk moves to the pushed commit

Plan: docs/plans/step-reader.md (reading STEP geometry in C# the way IFC is read: generated schema types from EXPRESS via Parakeet). Gap 3.
