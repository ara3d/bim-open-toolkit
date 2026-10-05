---
id: TKT-101
title: Nodes added by the Ask box land in free space, not on top of existing nodes
status: open
depends_on: [TKT-84]
owner:
fence: []
workflow: [W2]
---

## Acceptance criteria

- [ ] Adding two nodes through the Ask box to bim-level-summary leaves no two node boxes overlapping

Found 2026-09-28: both nodes the Ask box added covered the `table.aggregate` card. The canvas palette (TKT-96) places nodes at the cursor; an agent edit has no cursor.
