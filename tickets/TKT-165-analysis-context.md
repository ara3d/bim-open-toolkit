---
id: TKT-165
title: Analysis context: the DuckDB studio runs over the public sample buildings, with a landing page, five sample graphs, and a Claude run
status: open
depends_on: []
owner:
fence: [samples/duckdb-analyses/**, bimopenflow/web/packages/studio-web/**, scripts/prepare-bim-flow-duckdb.mjs, docs/bim-flow-duckdb.md, docs/DEMOS.md, site/**]
workflow: [W2, W1]
created: 2026-10-05
---

## Acceptance criteria

- [ ] At least five graphs in samples/duckdb-analyses run green over a public .duckdb from bim-open-data's samples/public (Schependomlaan or DigitalHub), no private model required, and a test asserts their numbers
- [ ] The /duckdb.html page says who it is for (an analyst with a question), opens on a public model, and offers the templates for this context first
- [ ] One Ask request per sample graph is answered correctly by the Claude backend and the transcript is committed under samples/ask

Serves W2 (ask or delegate in Claude) and W1 (one install, a public model). The first of the five demo contexts in docs/proposals/demo-contexts.md. Today every /duckdb.html graph SELECTs from the typed Snowdon tables (door, storey, space, roof), which only the owner has; the public samples carry the BOS tables and the text views (EntityText, ParameterText, StoreyOfElement), so the graphs are rewritten, not copied. The Ask guides under .claude/skills/bim-flow describe the typed schema and need the BOS view vocabulary too. Related: TKT-14 (templates), TKT-8 (Ask measurement), TKT-144 (which models are public).
