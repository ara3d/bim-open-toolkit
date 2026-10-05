---
id: TKT-67
title: Add a headless end-to-end gate for SQL, write-back, MCP intents, and Ask
status: open
depends_on: []
owner:
fence: [gates/**]
workflow: [process]
---

## Acceptance criteria

- [ ] A script in `gates/` starts the host, runs a SQL query, a write-back, an MCP intent, and an Ask request against a fake backend, and exits non-zero on any failure
- [ ] `gates/README.md` lists it

`gates/` holds only `host-smoke.mjs` and `web-smoke.mjs`, which check that things start. The deleted prototype's `tools/intgate-smoke.mjs` made about 13 end-to-end assertions (`docs/platoflow/README.md:56`). Raised by reviews/2026-09-27-status.md
