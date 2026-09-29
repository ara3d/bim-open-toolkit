---
id: TKT-20
title: A chart pane in the DuckDB studio
status: done
depends_on: []
owner: claude-tkt20
fence: [bimopenflow/web/packages/app/**, bimopenflow/web/packages/panes/**, samples/duckdb-analyses/**]
---

## Acceptance criteria

- [x] The studio's right panel gains a Chart tab that renders the chart.bar or chart.line output of the selected node, next to the table
- [x] A sample graph over Snowdon shows rooms per storey (33 storeys with rooms) as a chart in the studio
- [x] A browser test covers the tab over a seeded graph

Serves W3 (PROJECT.md). docs/bim-flow-duckdb.md: the studio's right panel shows tables only, while the bim-profile editor already has chartPane.ts; the owner's first aim, detailed analysis and charts over Snowdon, has no surface in the studio until this exists. TKT-13 (sample graphs with charts) depends on it.

## Done (2026-09-28)

- f17c554: studioPanes in app/src/paneChoice.ts; the studio's pane area shows Chart and Table tabs for chart.* nodes, and no strip otherwise.
- 97d889d: duckdb-room-distribution gains chart-rows (sql.query) and chart (chart.bar); over snowdon-cli.duckdb the chart has 33 rows.
- 33a703d, ee9fd55: bar charts slant labels that do not fit their bars; the chart pane sizes its chart to the pane.
- 66d36f5: scripts/check-bim-flow-duckdb.mjs drives the Chart tab over the seeded graph and captures rooms-per-storey-chart.png.

Not done here: docs/bim-flow-duckdb.md still says the right panel has no Chart tab, because another session held uncommitted edits to it. An existing store keeps its old duckdb-room-distribution graph (prepare preserves edits); delete that folder and prepare again to get the chart.
