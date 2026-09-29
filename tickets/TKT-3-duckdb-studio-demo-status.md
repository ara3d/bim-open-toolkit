---
id: TKT-3
title: Is the DuckDB workflow studio behind the Ask box a committed, supported demo?
status: done
depends_on: []
owner:
fence: []
kind: question
---

docs/REPOSITORY-HANDOFF.md (2026-09-08) described the DuckDB workflow studio as an uncommitted working-tree feature; docs/bim-flow-duckdb.md and docs/bim-flow-mcp-demo.md (2026-09-18) describe it as the home of the Ask box on ports 5218/5308; docs/DEMOS.md does not list it. PROJECT.md workflows 1 and 2 assume it is supported. If it is not committed, the two most important workflows in the brief rest on files only one machine has.

To settle: git ls-files for the studio (artifacts/bim-flow-duckdb/studio is gitignored; the source that builds it is the question), then add it to docs/DEMOS.md or mark the brief's workflows accordingly.

## Decision (2026-09-26, from the repository)

Committed and supported. The studio's source is tracked (`src/studio/BimOpenFlow.Studio`, `src/studio/BimOpenFlow.Ask`, `bimopenflow/web/packages/app/duckdb.html`, `vite.duckdb.config.ts`), and `docs/DEMOS.md` lists `/duckdb.html` with its guarding test (`TableWorkflows.Tests/DuckDbWorkflowCatalogTests`). The premise that DEMOS.md did not list it was wrong, as the brief's fact-check found. PROJECT.md workflows 1 and 2 stand on committed code.
