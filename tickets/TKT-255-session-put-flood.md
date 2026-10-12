---
id: TKT-255
title: The editor repeats identical PUT /api/session requests: a burst of about 150 in a second on load and one a second while idle
status: done
depends_on: []
owner: builder-TKT-255
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [deps/bim-open-flow/bimopenflow/web/packages/app/src/editorSession.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/app.ts, deps/bim-open-flow/bimopenflow/web/packages/app/test/**]
workflow: [W2]
created: 2026-10-11
claimed: 2026-10-11
closed: 2026-10-12
kind: defect
---

## Acceptance criteria

- [x] An idle editor tab sends no PUT /api/session; a selection change sends one after the debounce; a visibility change sends at most one
- [x] A test covers the visibility and mount paths that produced the repeats

Seen 2026-10-11 on the bim profile editor at port 5300: the network log showed about 150 PUT /api/session requests inside one second while the page loaded under the browser pane, and about four per five seconds while idle, all identical. createSessionReporter in editorSession.ts debounces and deduplicates report(), so the repeats come from flush() (called on visibility changes, which the pane triggers often) or from more than one reporter being mounted (the console shows vite connecting three times per load). The host answers 200 each time, so the cost is wasted requests and log noise, not wrong state.

## Resolution

bim-open-flow 0d5c655. The repeats came from `flush()`, which app.ts called on every `visibilitychange` and which PUT the session unconditionally; app/test/sessionReports.test.ts reproduced 151 PUTs for 150 visibility changes before the fix. There is one reporter per app instance and mounting sends one PUT, so extra mounts were not the cause (the three vite connections are page loads, not app instances). `flush()` became `reclaim()` (app/src/editorSession.ts): after the 250 ms debounce it reads GET /api/session once per burst and resends only when the host holds a different session, that is, when another tab took over. An idle tab sends nothing; a selection change sends one PUT after the debounce. Tests: sessionReports.test.ts (mount, idle, burst, takeover, selection) and editorSession.test.ts.
