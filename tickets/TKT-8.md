---
id: TKT-8
title: Measure the Claude backend on the Ask request set and record the transcript
status: open
depends_on: []
owner:
fence: [scripts/ask-bim-flow.mjs, docs/bim-flow-mcp-demo.md, artifacts/bim-flow-duckdb/**, samples/duckdb-analyses/**]
---

Serves W2. The Claude backend landed in commit d0aa10c (2026-09-18) and 'has not been measured on the same request set yet'; the only published numbers are gpt-5's 8 correct, 2 honest, 0 wrong of 10. Nothing about the Ask box should change before this baseline exists. Informs TKT-6.
