---
id: TKT-189
title: IfcToBosConverter drops an instance whose geometry maps to more than one IFC id, so the Duplex roof has no node
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Ifc.Bos/**, deps/bim-open-data/tests/data/**]
workflow: [W2]
related: [TKT-178]
created: 2026-10-10
kind: defect
---

## Acceptance criteria

- [ ] An element whose geometry is shared with another element (Duplex roof #22475 and its slab #22492) gets its own instance, or a relation that says where its geometry is, so ids=22475 draws something
- [ ] The 65 Schependomlaan kozijn frames that Ara3D.Ifc.Mesher draws and BOS does not are explained or fixed

Found by chunk T178 (docs/plans/bos-middle-layer.md), 2026-10-10; the converter's own comment flags the drop. Fixing it changes the committed samples, so it belongs before or with wave C's regeneration.
