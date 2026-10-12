---
id: TKT-255
title: The editor repeats identical PUT /api/session requests: a burst of about 150 in a second on load and one a second while idle
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/bimopenflow/web/packages/app/src/editorSession.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/app.ts, deps/bim-open-flow/bimopenflow/web/packages/app/test/**]
workflow: [W2]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] An idle editor tab sends no PUT /api/session; a selection change sends one after the debounce; a visibility change sends at most one
- [ ] A test covers the visibility and mount paths that produced the repeats

Seen 2026-10-11 on the bim profile editor at port 5300: the network log showed about 150 PUT /api/session requests inside one second while the page loaded under the browser pane, and about four per five seconds while idle, all identical. createSessionReporter in editorSession.ts debounces and deduplicates report(), so the repeats come from flush() (called on visibility changes, which the pane triggers often) or from more than one reporter being mounted (the console shows vite connecting three times per load). The host answers 200 each time, so the cost is wasted requests and log noise, not wrong state.
