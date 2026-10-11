---
id: TKT-198
title: The entity-properties wire contract declares parameter group, name and value as non-null strings, so the API sends "" for an absent value
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/contracts/**, deps/bim-open-flow/src/flow/BimOpenFlow.Host.Api/**, bimopenflow/web/packages/panes/**]
workflow: [W2]
related: [TKT-175]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] EntityParameter's group, name and value are nullable in contracts/contracts.json, the generated types are regenerated, ApiMapping.ToParameter passes null through, and the properties pane (entityProperties.ts) shows an absent value as absent

Found by fixer F4 of the BOS middle-layer wave (docs/plans/bos-middle-layer.md), 2026-10-11. ModelEntityIndex keeps absence as null since bim-open-flow 81c058a; ApiMapping converts null to "" only because the contract requires a string.
