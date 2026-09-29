---
id: TKT-113
title: The studio's Preview node picker changes what the right panel shows
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/app/test/**]
---

## Acceptance criteria

- [ ] Choosing a node in the Preview node picker shows that node's output in the right panel, as a double-click does
- [ ] A test covers the picker selecting a node other than the flow's answer

Found 2026-09-28 by the TKT-20 session: since TKT-81 the panel follows only the flow's answer, a double-click, or the pin, so choosing 'answer' in Rooms by storey leaves the chart showing. scripts/check-bim-flow-duckdb.mjs relies on the picker.
