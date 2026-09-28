---
id: TKT-80
title: Analysis notebook prototype: a session transcript with live embeds, over the NRC samples
status: claimed
depends_on: []
owner: notebook-supervisor
fence: [bimopenflow/web/packages/bim-open-notebook/**, samples/notebooks/**, docs/plans/notebook.md, docs/proposals/notebook-sessions.md, bimopenflow/web/package-lock.json, apps/README.md, README.md, docs/ARCHITECTURE.md, docs/OVERVIEW.md, docs/claude-cli-login.md, gates/web-smoke.mjs, bimopenflow/web/package.json]
---

## Acceptance criteria

- [ ] samples/notebooks/nrc-eight-questions.notebook.json opens in the notebook page with no host, showing eight turns whose embeds carry the paper's expected answers (37,196.2 kgCO2e/yr for Q1)
- [ ] Against a tables-profile host, Re-evaluate marks each graph-backed embed current or changed, showing both values when changed
- [ ] Against the studio host, a typed request appends a turn built from /api/ask events: reply text, tool calls, and embeds for the graph's answer nodes; a follow-up continues the same analysis
- [ ] Save writes a .notebook.json that parses back to an equal notebook; Open loads one
- [ ] Editing and resending a request keeps the old reply as an earlier version and marks later turns stale; delete and undo work
- [ ] Embeds of kind value, table, chart, graph, view3d, picture, and file render; the package's typecheck and tests pass

Serves workflow 2. Design and sessions: docs/proposals/notebook-sessions.md. Plan: docs/plans/notebook.md.
