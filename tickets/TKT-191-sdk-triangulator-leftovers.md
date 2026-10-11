---
id: TKT-191
title: Finish the SDK's triangulator cleanup: two Studio examples, the empty KnownIssues project, and PolygonOps.TriangulateEarClipping
status: open
depends_on: []
owner:
fence: [deps/ara3d-sdk/**]
workflow: [kept]
related: [TKT-179]
created: 2026-10-10
---

## Acceptance criteria

- [ ] examples/Ara3D.Studio.Examples/Demos/Stairs.cs:113 and Modifiers/CvtRemesh.cs:74 call Earcut, and PolygonTriangulator is deleted
- [ ] PolygonOps.TriangulateEarClipping (no callers) is deleted; tests/Ara3D.SDK.KnownIssues.Tests is deleted or given a test, and test.bat line 51 and docs/TODO.md item 13 agree

Left by chunk T179 (docs/plans/bos-middle-layer.md), 2026-10-10, whose fence excluded the SDK examples.
