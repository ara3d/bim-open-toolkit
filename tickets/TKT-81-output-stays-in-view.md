---
id: TKT-81
title: The flow's output stays in view: the pane follows the answer node, editing a parameter never steals it, and the graph fits on open
status: done
depends_on: []
owner:
fence: [bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/app/src/paneArea.ts, bimopenflow/web/packages/app/src/selection.ts, bimopenflow/web/packages/app/src/defaultShown.ts, bimopenflow/web/packages/app/src/canvasEditor.ts, bimopenflow/web/packages/app/test/**, bimopenflow/web/packages/state/**]
---

## Acceptance criteria

- [x] On opening a flow the whole graph fits the canvas and the pane shows the flow's answer node
- [x] Clicking into a node's parameter and editing it does not change what the pane shows; the pane refreshes with the new answer
- [x] The pane header has a pin: pinned, it keeps its node whatever is selected; a Show button on the selected node, or double-clicking a node, shows that node; one click returns to the answer
- [x] Switching flows sends no suggestion or result request for a node of the previous flow

Owner's flow review, 2026-09-27: 'too much clicking back and forth', 'a better way to keep the final output shown and not just the current node'.

Closed 2026-09-28: done in aba5556 (pane follows the answer, pin, double-click to show, Back to answer, fit on open, deferred suggestion refresh), 5fca095 (canvas stays inside the window so Fit centres), 57948c9 (a note is never the answer). The Show gesture is double-click only; there is no separate Show button on the node.
