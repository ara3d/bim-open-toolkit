---
id: TKT-8
title: Measure the Claude backend on the Ask request set and record the transcript
status: claimed
depends_on: []
owner: small-job-builder
fence: [scripts/ask-bim-flow.mjs, docs/bim-flow-mcp-demo.md, artifacts/bim-flow-duckdb/**, samples/duckdb-analyses/**]
---

## Acceptance criteria

- [ ] The ten questions in docs/bim-flow-mcp-demo.md and their expected answers are committed as a request file (for example samples/ask/requests.txt) that scripts/ask-bim-flow.mjs --file reads; correct means a match to the expected value
- [ ] The file runs against the Claude backend and the transcript is committed beside the gpt-5 one
- [ ] docs/bim-flow-mcp-demo.md shows both backends' scores in one table (correct graphs, honest answers, wrong answers) with the date and commit
- [ ] Each wrong or failed request becomes a ticket naming the cause

Serves W2. The Claude backend landed in commit d0aa10c (2026-09-18) and 'has not been measured on the same request set yet'; the only published numbers are gpt-5's 8 correct, 2 honest, 0 wrong of 10. Nothing about the Ask box should change before this baseline exists. TKT-6 is closed: the host already prefers the Anthropic key; this ticket supplies the measurement and the committed set the brief's success line names.
