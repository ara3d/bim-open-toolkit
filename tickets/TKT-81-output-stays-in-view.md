---
id: TKT-81
title: The flow's output stays in view: the pane follows the answer node, editing a parameter never steals it, and the graph fits on open
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/app/src/paneArea.ts, bimopenflow/web/packages/app/src/selection.ts, bimopenflow/web/packages/app/src/defaultShown.ts, bimopenflow/web/packages/app/src/canvasEditor.ts, bimopenflow/web/packages/app/test/**, bimopenflow/web/packages/state/**]
---

## Acceptance criteria

- [ ] On opening a flow the whole graph fits the canvas and the pane shows the flow's answer node
- [ ] Clicking into a node's parameter and editing it does not change what the pane shows; the pane refreshes with the new answer
- [ ] The pane header has a pin: pinned, it keeps its node whatever is selected; a Show button on the selected node, or double-clicking a node, shows that node; one click returns to the answer
- [ ] Switching flows sends no suggestion or result request for a node of the previous flow

Owner's flow review, 2026-09-27: 'too much clicking back and forth', 'a better way to keep the final output shown and not just the current node'.
