---
id: TKT-188
title: ifc_mesh, ifc_bounds and ifc_volume measure Approach1 geometry while ifc_export_glb now draws the BOS geometry, and Approach1 does not clip walls under roofs
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/mcp/BimOpenMcp.Ifc/IfcGeometryTools.cs, deps/bim-open-data/src/mcp/BimOpenMcp.Ifc/IfcGeometry.cs, deps/bim-open-data/src/data/Ara3D.Ifc.Mesher/**, deps/bim-open-data/tests/mcp/**]
workflow: [W2]
related: [TKT-178]
created: 2026-10-10
kind: defect
---

## Acceptance criteria

- [ ] The four geometry tools report numbers from one geometry source, or each says which source it uses and why they may differ
- [ ] Either Approach1 clips walls by roofs (AC20-FZK-Haus #67536 and #75347 are up to 2.83 m too tall) or the measuring tools move to the BOS geometry, judged with GlbSourceComparisonTests

Found by chunk T178 of the BOS middle-layer wave (docs/plans/bos-middle-layer.md), 2026-10-10. Bounds agree within 1 cm for 86 of 90 elements on FZK-Haus, 774 of 784 on Institute-Var-2, 3490 of 3493 on Schependomlaan; all 14 large disagreements on the AC20 models are roof-clipped upper walls. Approach1 also misses 17 Schependomlaan elements. A volume or bounds answer can therefore disagree with the GLB a user is shown.
