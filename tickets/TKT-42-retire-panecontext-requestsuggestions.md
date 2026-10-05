---
id: TKT-42
title: Retire PaneContext.requestSuggestions and PaneInput.inspect.nodeId, which no pane uses since the properties panel went
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/panes/src/pane.ts, bimopenflow/web/packages/app/src/canvasControls.ts, bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/panes/test/**]
workflow: [process]
---

## Acceptance criteria

- [ ] packages/panes/src/pane.ts no longer declares requestSuggestions or inspect.nodeId; the app's SuggestionProvider type takes their place and npm test --workspaces --if-present passes

Debt from TKT-22 (docs/plans/remove-properties-panel.md). Small, but outside TKT-22's fence.
