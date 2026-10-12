---
id: TKT-238
title: duck.table takes a columns parameter of projection terms, so a select-and-rename runs in SQL; then the nine duckdb sample nodes convert
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/src/flow/BimOpenFlow.Nodes.DuckDb/**, samples/duckdb-analyses/**]
workflow: [W2]
related: [TKT-134]
created: 2026-10-11
---

## Acceptance criteria

- [ ] duck.table accepts a List Text parameter 'columns' whose terms use the Relations Projection parser (name, or name as Alias); the select and aliasing happen in the SQL, so columns not named (list columns such as nominal_width_evidence) are never loaded
- [ ] The nine select-and-rename duck.query nodes in duckdb-door-schedule (doors, levels), duckdb-door-types (doors), duckdb-room-schedule (rooms, levels), duckdb-room-distribution (rooms, levels), duckdb-evidence-trace (evidence) and duckdb-source-lineage (source-objects) become duck.table with columns, every node Ok and row counts unchanged on the Snowdon export
- [ ] DuckDbWorkflowCatalogTests.SnowdonOnly_FailsOnlyAtTheQueriesOverSampleDb accepts duck.table as a failing kind; scripts/check-bim-flow-duckdb.mjs inspects duck.table nodes too

Found by the TKT-134 builder (declared-schemas wave A, bim-open-flow f0a36af): converting to duck.table plus table.project loads the whole door table, and its list columns cannot be hashed (see the companion defect). The ticket says duck.read, which reads files; duck.table is the node. The builder's conversion script was a throwaway; the node list above is what it found. TKT-134 criterion 2 moves here.
