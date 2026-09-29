---
id: TKT-20
title: A chart pane in the DuckDB studio
status: claimed
depends_on: []
owner: claude-tkt20
fence: [bimopenflow/web/packages/app/**, bimopenflow/web/packages/panes/**, samples/duckdb-analyses/**]
---

## Acceptance criteria

- [ ] The studio's right panel gains a Chart tab that renders the chart.bar or chart.line output of the selected node, next to the table
- [ ] A sample graph over Snowdon shows rooms per storey (33 storeys with rooms) as a chart in the studio
- [ ] A browser test covers the tab over a seeded graph

Serves W3 (PROJECT.md). docs/bim-flow-duckdb.md: the studio's right panel shows tables only, while the bim-profile editor already has chartPane.ts; the owner's first aim, detailed analysis and charts over Snowdon, has no surface in the studio until this exists. TKT-13 (sample graphs with charts) depends on it.
