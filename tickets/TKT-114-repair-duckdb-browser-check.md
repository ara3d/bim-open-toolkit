---
id: TKT-114
title: Repair the studio browser check, scripts/check-bim-flow-duckdb.mjs, so it passes end to end
status: open
depends_on: []
owner:
fence: [scripts/check-bim-flow-duckdb.mjs]
---

## Acceptance criteria

- [ ] The script passes end to end over a freshly prepared store with the private Snowdon files

Found 2026-09-28 by the TKT-20 session: the script now passes the new Chart tab steps but stops at the sort node's column dropdowns (rank-types A), a failure that predates TKT-20. It is Workflow 1's Done check. May depend on the Preview node picker fix.
