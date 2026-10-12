---
id: TKT-246
title: EntityText carries TypeIndex so table-built IDS checks resolve types by index
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.BimOpenSchema.DuckDb/**, src/flow/BimOpenFlow.Nodes.Bos/**, deps/bim-open-data/src/data/Ara3D.Ids/**]
workflow: [kept]
related: [TKT-237, TKT-50]
created: 2026-10-11
---

## Acceptance criteria

- [ ] The EntityText view carries TypeIndex (e.Type) and bos.load passes it through, so IdsModel.FromTables resolves an occurrence type by index and never by name
- [ ] IdsTypeObjects name matching and its ambiguity warning are deleted

From the review of the second IDS wave (docs/plans/ids-bcf-nodes.md). Ara3D.Ids 5a23e83 resolves a type from the EntityText Type column by name because the view has no index; the Duplex has two door styles per name, so FromTables warns and gives InfoNotAvailable. A TypeIndex column removes the workaround.
