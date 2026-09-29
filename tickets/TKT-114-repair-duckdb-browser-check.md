---
id: TKT-114
title: Repair the studio browser check, scripts/check-bim-flow-duckdb.mjs, so it passes end to end
status: done
depends_on: []
owner: wave-w6
fence: [scripts/check-bim-flow-duckdb.mjs]
---

## Acceptance criteria

- [x] The script passes end to end over a freshly prepared store with the private Snowdon files

Found 2026-09-28 by the TKT-20 session: the script now passes the new Chart tab steps but stops at the sort node's column dropdowns (rank-types A), a failure that predates TKT-20. It is Workflow 1's Done check. May depend on the Preview node picker fix.

## Closing note

2026-09-29, wave W6. Run over a store prepared fresh with `scripts/prepare-bim-flow-duckdb.mjs`, a host built from source at `babe6c0` (ports 5482 and 5483): three consecutive passes, all 50 nodes of the 9 sample graphs green, 142 doors, 290 spaces, 33 storey bars, database SHA-256 `eff5e7a96d96312b745acaa97403a587d5477bac8c8108d5e54a3810242ac9b3` unchanged. Two failures, both stale script steps, no app bug:

- The Chart/Table tab check read every `.bof-app-tab` on the page and found the sidebar's new Steps and Nodes tabs (ecb143a, TKT-116). The tab selectors are now scoped to `.bof-app-panearea`.
- The startup-error check stubbed `/api/analyses` with a 503 and expected "Could not open the DuckDB demo". Since the host status banner (83c5670), a 5xx means the host is down and the banner says "Host not reachable at .../api"; the page's own error is for a reachable host that cannot open the demo. The check now covers both: every `/api` call failing shows the banner, and a host listing no sample flows shows "Could not open the DuckDB demo ... Demo workflows are missing."

The sort dropdown failure (rank-types A) did not reproduce at `babe6c0`, with either the source-built host or the prebuilt Sep 26 host, so it was most likely the Preview node picker bug fixed in TKT-113.
