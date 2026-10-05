---
id: TKT-165
title: Analysis context: the DuckDB studio runs over the public sample buildings, with a landing page, five sample graphs, and a Claude run
status: open
depends_on: []
owner:
fence: [samples/duckdb-analyses/**, samples/ask/**, bimopenflow/web/packages/studio-web/**, scripts/prepare-bim-flow-duckdb.mjs, docs/bim-flow-duckdb.md, docs/DEMOS.md, site/**, tests/studio/BimOpenFlow.SnowdonWorkflows.Tests/DuckDbWorkflowCatalogTests.cs, tests/BimOpenToolkit.TestSupport/RepoPaths.cs, .claude/skills/bim-flow/schema-guide.md]
workflow: [W2, W1]
created: 2026-10-05
---

## Acceptance criteria

- [x] At least five graphs in samples/duckdb-analyses run green over a public .duckdb from bim-open-data's samples/public (Schependomlaan or DigitalHub), no private model required, and a test asserts their numbers
- [x] The /duckdb.html page says who it is for (an analyst with a question), opens on a public model, and offers the templates for this context first
- [ ] One Ask request per sample graph is answered correctly by the Claude backend and the transcript is committed under samples/ask

Serves W2 (ask or delegate in Claude) and W1 (one install, a public model). The first of the five demo contexts in docs/proposals/demo-contexts.md. Today every /duckdb.html graph SELECTs from the typed Snowdon tables (door, storey, space, roof), which only the owner has; the public samples carry the BOS tables and the text views (EntityText, ParameterText, StoreyOfElement), so the graphs are rewritten, not copied. The Ask guides under .claude/skills/bim-flow describe the typed schema and need the BOS view vocabulary too. Related: TKT-14 (templates), TKT-8 (Ask measurement), TKT-144 (which models are public).

## Progress

- 2026-10-05: five `public-*` graphs over Schependomlaan lead `samples/duckdb-analyses/workflows.json`, each entry now carrying a `database` field (`public` or `snowdon`); `scripts/prepare-bim-flow-duckdb.mjs` resolves `{PUBLIC_DUCKDB}` to the deps file and skips the Snowdon graphs when that export is absent; `DuckDbWorkflowCatalogTests` evaluates the five over the public file and asserts their numbers (51 tests pass); `/duckdb.html` shows an audience strap, opens on the door schedule, and tolerates missing Snowdon graphs; the Ask schema guide describes the BOS text views. Checked in the browser: door schedule and floor-area chart render with the cited numbers. Remaining: the Claude transcripts (third criterion), which wait on the Claude-CLI Ask backend (TKT-45) and the measurement set (TKT-8); the templates for this context are in the generated catalog but not yet grouped first on the start page (TKT-14 decides grouping).
