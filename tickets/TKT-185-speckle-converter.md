---
id: TKT-185
title: Convert between BOS and Speckle objects in both directions, with MCP tools
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Speckle/**, deps/bim-open-data/tests/data/Ara3D.BimOpenSchema.IO.Speckle.Tests/**, deps/bim-open-data/src/mcp/BimOpenMcp.Ifc/BosFileTools.cs, deps/bim-open-data/tools/bos-to-speckle/**]
workflow: [W1, W3]
related: [TKT-172, TKT-170, TKT-184]
created: 2026-10-10
---

## Acceptance criteria

- [ ] A library call writes an IBimData as a .speckle.json file: a flat array of Speckle objects with SDK content-hash ids, the root Collection first, one DataObject per element with Speckle's IFC-importer property layout and world-space displayValue meshes, render material proxies
- [ ] A library call reads such a file into BimData with entities, parameters, containment relations, and z-up metre geometry; null values produce no parameter; unknown units fail naming the string
- [ ] The Duplex round trip keeps element counts per category, GlobalIds, storey pairs, typed parameter counts, and triangle count; vertices agree within 0.1 mm; the numbers are recorded in the plan
- [ ] MCP tools bos_export_speckle and speckle_to_bos in bimopen-ifc, the saved .bos holding geometry

Plan: docs/plans/speckle-converter-and-viewer.md, chunks D1 to D7. Depends on Speckle.Sdk 2026.8.0 (Apache-2.0, net8.0); the 2026.9 bundle format stays an extension point while it is beta.
