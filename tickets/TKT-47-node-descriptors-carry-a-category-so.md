---
id: TKT-47
title: Node descriptors carry a category, so pane choice and the default shown node rank kinds from one field
status: open
depends_on: []
owner:
fence: [contracts/**, bimopenflow/web/packages/contracts/**, bimopenflow/web/packages/app/src/paneChoice.ts, bimopenflow/web/packages/app/src/defaultShown.ts, src/flow/BimOpenFlow.Nodes.*/**]
---

## Acceptance criteria

- [ ] NodeDescriptor in contracts/contracts.json gains a category (source, relation, materialized, viewer, sink, or similar) filled by each pack; paneChoice.ts and defaultShown.ts read it instead of matching kind-name prefixes; the duplicated isView3DKind/isVerdictKind helpers go

Debt from TKT-46 (c2bc808): defaultShown.ts ranks terminal nodes by kind class derived from output port types and kind-name conventions, duplicating a smaller copy of paneChoice.ts's unexported helpers, because the descriptor has no category field. Principle 4: one location for the classification.
