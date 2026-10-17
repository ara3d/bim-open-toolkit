---
id: TKT-308
title: A face with one hole of the same vertex count is meshed as a twisted band when the hole winds the same way as the outer ring
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.MeshKernel/**, deps/bim-open-data/tests/data/Ara3D.MeshKernel.Tests/**, deps.json]
workflow: [W3]
related: [TKT-305]
confidence: medium
created: 2026-10-17
kind: defect
---

## Acceptance criteria

- [ ] PolygonWithHoles.TryTriangulateCongruentRing checks orientation and coverage as TryTriangulateOffsetRing does, and the face path applies the 1 % area check to its result
- [ ] a test: a 4-vertex face with a clockwise 4-vertex hole yields triangles whose area equals the face area minus the hole (12 in the builder's case, not 24) and all face one way

Found 2026-10-17 by the TKT-305 kernel-extraction builder (bim-open-data 2b4104b), behaviour kept unchanged there. The quad-band shortcut for one hole with the outer ring's vertex count runs without the orientation and coverage check and skips the 1 % area check; a clockwise hole gives triangles covering twice the face area, facing both ways. IFC window openings in walls may hit it. The comment in the new Ara3D.MeshKernel.Tests face test records it.
