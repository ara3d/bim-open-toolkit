---
id: TKT-248
title: Material profile sets reach BOS as HasMaterial edges
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Ifc.Bos/**]
workflow: [kept]
related: [TKT-50]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] IfcMaterialSelectResolver handles IFCMATERIALPROFILESET and IFCMATERIALPROFILESETUSAGE so IFC4 beams and columns with profile sets carry HasMaterial edges; a test over a MiniIfc beam shows it

From the review of the second IDS wave. The resolver has no case for profile sets, so an IFC4 beam or column reads as having no material and a prohibited material facet in an IDS passes it falsely.
