---
id: TKT-7
title: Snowdon graphs open green from a clean clone plus the private files
status: open
depends_on: [TKT-2]
owner:
fence: [samples/duckdb-analyses/**, bimopenflow/web/packages/app/**, scripts/check-bim-flow-duckdb.mjs, docs/bim-flow-duckdb.md]
---

## Acceptance criteria

- [ ] A fresh clone, with the private Snowdon files placed where BIMOPENFLOW.md says, runs the documented prepare step and opens /duckdb.html with every sample graph green and no hand edits
- [ ] The seeded store resolves the database by name (a registry or sources.json), so a store prepared on one machine works on another
- [ ] check-bim-flow-duckdb.mjs evaluates every node of every sample graph and reports the database hash unchanged

Serves W1 (PROJECT.md). Today the typed DuckDB comes from `run-samples.ps1 -Prepare` and `export-duckdb`, run by hand over the private BOS; the committed sample graphs carry a `{DUCKDB}` placeholder that `scripts/prepare-bim-flow-duckdb.mjs` replaces with a machine-local path when it seeds the store, so the store, not the samples, is tied to one machine, and REPOSITORY-HANDOFF.md says a clean clone of HEAD has not been shown to reproduce the demo. Which export is canonical is TKT-2.
