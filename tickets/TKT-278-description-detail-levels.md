---
id: TKT-278
title: Node descriptions show two sentences by default, with a hidden, brief, full toggle for the step list and the cards
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/bimopenflow/web/packages/app/src/stepList.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/sidebar.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/prefs.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/topbar.ts, deps/bim-open-flow/bimopenflow/web/packages/app/test/**, deps/bim-open-flow/bimopenflow/web/packages/graph/src/nodeSize.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/src/canvasParts.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/test/**]
workflow: [W2]
created: 2026-10-11
---

## Acceptance criteria

- [ ] The step list shows the first two sentences of a node's catalog description by default, not one
- [ ] One control (in the Steps tab header or the top bar) cycles three levels: hidden (no description text), brief (two sentences), full (the whole catalog description); the level is remembered per browser and applies to the step list and to the card footer on the canvas
- [ ] Card heights follow the level so no text overflows and the layout algorithms use the real card sizes (TKT-125)

Owner's request 2026-10-11: the one-sentence descriptions in the step list are too short to say what a step does; two sentences by default, and a way to hide them or see the whole text. stepList.ts takes firstSentence(desc.description); canvasParts.ts fits the description to the card.
