---
id: TKT-80
title: Analysis notebook prototype: a session transcript with live embeds, over the NRC samples
status: open
depends_on: []
owner:
fence: [bim-open-notebook:bimopenflow/web/packages/bim-open-notebook/**, samples/notebooks/**, bim-open-notebook:docs/plans/notebook.md, bim-open-notebook:docs/proposals/notebook-sessions.md, bimopenflow/web/package-lock.json, apps/README.md, README.md, docs/ARCHITECTURE.md, docs/OVERVIEW.md, docs/claude-cli-login.md, gates/web-smoke.mjs, bimopenflow/web/package.json]
workflow: [W2]
---

## Acceptance criteria

- [ ] samples/notebooks/nrc-eight-questions.notebook.json opens in the notebook page with no host, showing eight turns whose embeds carry the paper's expected answers (37,196.2 kgCO2e/yr for Q1)
- [ ] Against a tables-profile host, Re-evaluate marks each graph-backed embed current or changed, showing both values when changed
- [ ] Against the studio host, a typed request appends a turn built from /api/ask events: reply text, tool calls, and embeds for the graph's answer nodes; a follow-up continues the same analysis
- [ ] Save writes a .notebook.json that parses back to an equal notebook; Open loads one
- [ ] Editing and resending a request keeps the old reply as an earlier version and marks later turns stale; delete and undo work
- [ ] Embeds of kind value, table, chart, graph, view3d, picture, and file render; the package's typecheck and tests pass

Serves workflow 2. Design and sessions: docs/proposals/notebook-sessions.md. Plan: docs/plans/notebook.md.

## Notes

- 2026-10-03: claim released; the session that held it (notebook-supervisor) had stopped. Checked against the code that day. Done: the prototype in `bim-open-notebook:bimopenflow/web/packages/bim-open-notebook` (chunks N1 to N10, W1, W2, A1 to A9, G, the graph editor in cells via TKT-94, markdown replies); typecheck clean and 300 tests passing on 2026-10-03; 13 sample notebooks. Left before closing: one live multi-turn run against the studio host (criterion 3; a single Haiku request worked in b70e270), and `node gates/web-smoke.mjs`. The plan's Outcome section is out of date. Two defects seen 2026-10-03 are filed separately (the 3D embed's legend, mid-word underscores in replies). The rest of the work is in TKT-86 to TKT-92, TKT-104 and TKT-105.
