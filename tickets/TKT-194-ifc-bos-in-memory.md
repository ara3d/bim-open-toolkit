---
id: TKT-194
title: IfcToBosConverter exposes only its DataSet, so an IFC session writes a .bos and reads it straight back
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Ifc.Bos/**, deps/bim-open-data/src/mcp/BimOpenMcp.Ifc/**]
workflow: [W2]
related: [TKT-177]
created: 2026-10-10
---

## Acceptance criteria

- [ ] The converter returns its IBimData, and an IFC session builds its BOS session from it without re-reading the archive; the .bos file is still written for ifc_to_bos

From the BOS middle-layer wave review (docs/plans/bos-middle-layer.md, Review findings), 2026-10-10. Found by T177; measure the first-call time of ifc_sql on Schependomlaan before and after.
