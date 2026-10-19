---
id: TKT-350
title: Plato's generated C# recomputes a mapped range on every read (MapRange is lazy), so MeshModel re-meshes every face many times
status: claimed
depends_on: []
owner: session 2b20f2f0
session: 2b20f2f0-4d99-4684-a062-1b2db12618c7
fence: [../plato/src/Plato.Intrinsics/**, ../plato/writers/**, ../plato/tests/**]
workflow: [W3, W4]
related: [TKT-313, TKT-323, TKT-335]
confidence: high
created: 2026-10-19
claimed: 2026-10-19
kind: defect
---

## Acceptance criteria

- [ ] a mapped range bound to a name is computed once in generated C#: MapRange is materialised (or memoised) so each element's function runs once, with a writer or intrinsics test that counts the calls
- [ ] regenerated Ara3D.StepBrep meshes the unit cylinder through one MeshModel call in under 10 s (over 10 minutes today), with the same mesh as the restated pipeline
- [ ] the change keeps the interpreter and the C# backend agreeing on the stdlib and STEP laws they share

Found 2026-10-19 by the C# wiring track (TKT-313; bim-open-data 374f2b4, CLI 128cf769): MapRange in Plato.Intrinsics (Ara3D.StepBrep/Intrinsics/Integer.cs line 87) returns a lazy list that calls its function on every read, so MeshModel's face outcomes are meshed again each time the refinement loop, assembly and validation read them. Cube 5.1 s, cylinder over 10 minutes. The interpreter's call cache (TKT-332) hides this, which is why laws did not show it.
