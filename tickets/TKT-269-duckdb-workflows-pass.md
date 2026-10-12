---
id: TKT-269
title: DuckDB studio workflows pass: a model input on all 14 graphs, single-row layouts, filters without flag columns, current docs, a golden for the public five
status: done
depends_on: []
owner: builder-TKT-269
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [samples/duckdb-analyses/**, scripts/prepare-bim-flow-duckdb.mjs, scripts/duckdb-graph.mjs, scripts/duckdb-graph.test.mjs, scripts/check-bim-flow-duckdb.mjs, tests/studio/BimOpenFlow.SnowdonWorkflows.Tests/DuckDbWorkflowCatalogTests.cs, docs/bim-flow-duckdb.md]
workflow: [W2]
created: 2026-10-11
claimed: 2026-10-11
closed: 2026-10-11
---

## Acceptance criteria

- [x] Every entry declares a graph input `model` (default {PUBLIC_DUCKDB} or {DUCKDB}) and its duck.source `database` holds $model; prepare-bim-flow-duckdb.mjs rewrites inputs[].default as SampleSeeding.RewritePaths does, and DuckDbWorkflowCatalogTests accepts the placeholder there
- [x] The nine Snowdon layouts run left to right in one row at 330 px (database at (20, 30)); no answer sits under its reader
- [x] CASE flag columns that exist only to be filtered (duckdb-missing-widths, duckdb-typed-schema, public-missing-widths) become table.filter expressions; public-floor-area-by-use's answer is table.derive plus table.sort; duckdb-room-distribution feeds chart from answer and has a note on the duplicate storey names; public-door-schedule gains a WidthStatus column and the Dutch Use values a glossary note
- [x] docs/bim-flow-duckdb.md says 14 graphs (5 public, 9 Snowdon) with the public rows in its table; the public five have a golden or a numbers test

From the 2026-10-11 review of samples/duckdb-analyses/workflows.json. No entry declares a graph input although the DuckDB studio is the Ask box's home and the brief's workflow 2 demo. The page auto-arranges on open, so the layout fixes matter for Download and other editors. Node and layout conventions for every sample pass: columns 330 px apart from x 40, rows 184 px (or 240 px when a card carries a long parameter), sources (value.path, duck.source) at x 40, an `about` view.note at (40, 40) with the first row below it and a stored width 560 and a height that fits its text (the canvas shows at most 12 lines of a 300 px note); the final node is named `answer` and carries only readable columns (names, levels, measures with units; ids last or dropped); every reader whose `path` is a socket takes its path from one value.path or duck.source node, and a graph a user would run on their own model declares a graph input `model` whose value.path holds `$model` (bim-discipline-mix and deps/bim-open-flow/samples/buildings/schependomlaan-spaces-per-storey are the references); table.sort uses A/descendingA (the `by` list is the legacy form). Re-approve the folder's goldens with SAMPLE_FLOWS_APPROVE=1 and check the README numbers still hold.
