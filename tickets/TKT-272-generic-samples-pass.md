---
id: TKT-272
title: bim-open-flow analyses and relations graphs: current sort form, answer nodes, notes, shared sources, even columns
status: done
depends_on: [TKT-271]
owner: builder-TKT-272
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [deps/bim-open-flow/samples/analyses/**, deps/bim-open-flow/samples/relations/**, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/tables/category-mix.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/tables/customer-revenue.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/tables/duckdb-warehouse.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/tables/order-size-split.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/tables/sqlite-vs-csv.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/tables/xlsx-enrichment.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/tables/large-orders.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/tables/monthly-spend-sql.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/tables/orders-per-customer.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/tables/revenue-by-customer.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/tables/schema-error.txt]
workflow: [W2]
created: 2026-10-11
claimed: 2026-10-11
closed: 2026-10-12
---

## Acceptance criteria

- [x] customer-revenue and category-mix use A/descendingA on table.sort; every analyses graph ends in `answer` (xlsx-enrichment projects OrderId, ProductName, Quantity, UnitPrice, Revenue); columns 330 px apart in all eleven graphs
- [x] sqlite-vs-csv and schema-error carry an about note (8 of 8 rows intersect; Quantiy is misspelled on purpose); category-mix is rebuilt with table.join and table.derive plus a chart.bar so customer-revenue stays the one SQL showcase; duckdb-warehouse drops the unused OrderDate and CAST or says in a note why it keeps SQL
- [x] Readers of one file share a value.path once the bindable-path ticket lands; monthly-spend-sql's jan sits above feb; revenue-by-customer and orders-per-customer gain a chart or close their 420 to 460 px gaps
- [x] Committed in deps/bim-open-flow with the hash reported; the toolkit goldens under golden/tables re-approved after the pin moves

From the 2026-10-11 review of deps/bim-open-flow/samples/analyses (6) and samples/relations (5), all green. The relations folder is the naming reference (every final node is answer). Node and layout conventions for every sample pass: columns 330 px apart from x 40, rows 184 px (or 240 px when a card carries a long parameter), sources (value.path, duck.source) at x 40, an `about` view.note at (40, 40) with the first row below it and a stored width 560 and a height that fits its text (the canvas shows at most 12 lines of a 300 px note); the final node is named `answer` and carries only readable columns (names, levels, measures with units; ids last or dropped); every reader whose `path` is a socket takes its path from one value.path or duck.source node, and a graph a user would run on their own model declares a graph input `model` whose value.path holds `$model` (bim-discipline-mix and deps/bim-open-flow/samples/buildings/schependomlaan-spaces-per-storey are the references); table.sort uses A/descendingA (the `by` list is the legacy form). Re-approve the folder's goldens with SAMPLE_FLOWS_APPROVE=1 and check the README numbers still hold.
