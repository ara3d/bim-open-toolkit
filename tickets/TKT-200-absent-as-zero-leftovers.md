---
id: TKT-200
title: BimLevelsNode.Elevation and the BOS Browser's number cells still show 0 for an absent value
status: open
depends_on: []
owner:
fence: [src/flow/BimOpenFlow.Nodes.BimAnalysis/BimLevelsNode.cs, tests/flow/BimOpenFlow.Nodes.BimAnalysis.Tests/**, deps/bim-open-data/apps/Ara3D.BimOpenSchema.Browser/DataTableFromEntities.cs]
workflow: [W2]
related: [TKT-175]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] A level with no elevation has a null elevation in bim.levels output, and the Browser shows an empty cell, not 0, for an absent number

Left by fixer F8 of the BOS middle-layer wave (docs/plans/bos-middle-layer.md), 2026-10-11, outside finding D9. PROJECT.md principle 3.
