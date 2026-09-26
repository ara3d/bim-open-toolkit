---
id: TKT-2
title: Which Snowdon DuckDB export is canonical for analysis and charts?
status: open
depends_on: []
owner:
fence: []
kind: question
---

Two documents dated 2026-09-18 disagree. docs/bim-flow-duckdb.md says the R5 export populates 48 of 83 tables and holds walls and windows; docs/bim-flow-mcp-demo.md item 1 and .claude/skills/bim-flow say the export has 11 tables with rows and no walls or windows. Either one is an older build, or they are two files. PROJECT.md workflow 1 and every chart over Snowdon depend on the answer, and the bim-flow skill's line 'The supplied Snowdon export has no walls or windows' is wrong for one of them.

To settle: list the tables with rows in the file artifacts/building-model-workflows/snowdon-cli.duckdb and in whatever /duckdb.html loads; record the SHA-256 of the chosen file next to the graphs.
