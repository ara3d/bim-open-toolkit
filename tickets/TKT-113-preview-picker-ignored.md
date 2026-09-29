---
id: TKT-113
title: The studio's Preview node picker changes what the right panel shows
status: done
depends_on: []
owner: wave-w2
fence: [bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/app/test/**]
---

## Acceptance criteria

- [x] Choosing a node in the Preview node picker shows that node's output in the right panel, as a double-click does
- [x] A test covers the picker selecting a node other than the flow's answer

Found 2026-09-28 by the TKT-20 session: since TKT-81 the panel follows only the flow's answer, a double-click, or the pin, so choosing 'answer' in Rooms by storey leaves the chart showing. scripts/check-bim-flow-duckdb.mjs relies on the picker.

Done 2026-09-28 (wave W2): the picker's change handler now counts as an explicit choice, like a double-click. Choosing any node other than the flow's answer shows it with "Showing ..." and a "Back to answer" button; choosing the answer drops the override and any pin and follows the answer again. The node is still selected and brought into view. Covered by `bimopenflow/web/packages/app/test/previewPicker.test.ts`, which drives the real `createApp` in jsdom; checked in the browser on Rooms by storey (picking `answer` shows the 34-row table, picking `chart` shows the chart).
