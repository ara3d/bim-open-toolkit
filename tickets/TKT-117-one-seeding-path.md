---
id: TKT-117
title: The host seeds the DuckDB workflows too, so the sample seeding rules live in one place
status: open
depends_on: []
owner:
fence: [src/flow/BimOpenFlow.Host/**, scripts/prepare-bim-flow-duckdb.mjs, scripts/seed-store.mjs, scripts/seed-store.test.mjs, tests/flow/BimOpenFlow.Host.Tests/**, docs/bim-flow-duckdb.md]
---

## Acceptance criteria

- [ ] The host seeds samples/duckdb-analyses, binding {DUCKDB} the way it binds {SNOWDON}
- [ ] scripts/seed-store.mjs is deleted and duckdb:prepare no longer seeds the store

Left by TKT-102 (2026-09-28): the refresh rules (record in <store>/.samples.json, refresh untouched copies, keep edited ones) exist twice, in SampleSeeding.Seed and in seed-store.mjs, which breaks don't-repeat-yourself. Coordinate with TKT-30, whose chunk C12 edits the prepare script.
