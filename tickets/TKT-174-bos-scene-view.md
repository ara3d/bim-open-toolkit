---
id: TKT-174
title: A shared scene view over BOS in ObjectModel, and the GLB, USD and BCF writers moved onto it
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.BimOpenSchema.ObjectModel/**, deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Gltf/**, deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Usd/**, deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Bcf/**, deps/bim-open-data/tests/data/**]
workflow: [W3]
related: [TKT-170, TKT-171, TKT-173]
created: 2026-10-10
---

## Acceptance criteria

- [ ] One view, built once in O(n), gives instances with entity, mesh, material and world transform under a filter (entities, hidden); elements with geometry; parameter rows per entity; GlobalId and name as null when absent; per-entity bounds; typed parameter values that are null when missing
- [ ] Invalid mesh, material and transform indices are found once in the view, counted, and skipped, not handled differently by each writer
- [ ] GLB, USD and BCF use it; their own copies (the three hidden checks, GltfSceneBuilder.EntityString, ElementBounds, RowGroups, BosValues) are deleted, and their tests pass unchanged

Found in the BOS formats wave (docs/plans/bos-formats.md, Architecture notes). Each writer re-derived these pieces. BimObjectModel cannot serve: it copies every mesh through ToModel3D and keys parameters by name. DataModel's GeometryConversion already has per-instance IsHidden and bounds; reuse it if it fits.
