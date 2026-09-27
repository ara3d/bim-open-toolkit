---
id: TKT-37
title: Ask box measurement failed on 'which table has the most rows' (Anthropic credit exhausted)
status: open
depends_on: []
owner:
fence: [artifacts/bim-flow-duckdb/**]
---

## Acceptance criteria

- [ ] Rerun 'Which table in this export has the most rows, and how many?' from samples/ask/requests.txt against the Claude backend once Anthropic credit is available, and confirm the answer matches the expected 'evidence, 146669 rows'.

Measured 2026-09-26: the Anthropic API returned 'Your credit balance is too low to access the Anthropic API' before any tool call ran (see artifacts/bim-flow-duckdb/transcript-ask-claude-opus-5-2026-09-26.md, request 7 of 10). Not a code defect; the account ran out of credit partway through the ten-request run. Sibling tickets for the other four requests that failed the same way in the same run: TKT-36, TKT-38, TKT-39, TKT-40.
