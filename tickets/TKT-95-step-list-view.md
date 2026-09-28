---
id: TKT-95
title: A step list beside the canvas: the graph read as numbered steps, each with its parameters, status, and row count
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/app/src/graphOrder.ts, bimopenflow/web/packages/app/src/stepList.ts, bimopenflow/web/packages/app/src/sidebar.ts, bimopenflow/web/packages/app/test/graphOrder.test.ts, bimopenflow/web/packages/app/test/stepList.test.ts, bimopenflow/web/packages/app/test/sidebar.test.ts, bimopenflow/web/packages/app/src/app.ts]
---

## Acceptance criteria

- [ ] The sidebar shows the open flow as numbered steps in dataflow order, each naming its node title, a one-line parameter summary, its status, and the row count of its first table output when known
- [ ] Clicking a step selects the node and focuses the canvas on it; the selected node's step is highlighted
- [ ] A join or a branch is shown in the list by naming which earlier steps feed the step

Serves W2 (a graph you can inspect) and W1. docs/proposals/editor-ux-harvest.md, 'Step list view': almost every BimOpenFlow graph is a 4-to-8-node line, so a Power Query style list is a second reading of the same graph. Read-only in this stretch; editing stays on the canvas (principle 1).
