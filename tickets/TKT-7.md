---
id: TKT-7
title: Snowdon graphs open green from a clean clone plus the private files
status: open
depends_on: [TKT-2]
owner:
fence: [samples/duckdb-analyses/**, bimopenflow/web/packages/app/**, scripts/check-bim-flow-duckdb.mjs, docs/bim-flow-duckdb.md]
---

Serves W1 (PROJECT.md). Today the nine sample graphs hold absolute paths and the typed DuckDB is produced by a hand-run prepare, run, export-duckdb sequence, so REPOSITORY-HANDOFF.md says a clean clone of HEAD will not reproduce the demo. Which export is canonical is TKT-2.
