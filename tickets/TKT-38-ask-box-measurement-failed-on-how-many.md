---
id: TKT-38
title: Ask box measurement failed on 'how many walls' (Anthropic credit exhausted)
status: open
depends_on: []
owner:
fence: [artifacts/bim-flow-duckdb/**]
---

## Acceptance criteria

- [ ] Rerun 'How many walls are in this export?' from samples/ask/requests.txt against the Claude backend once Anthropic credit is available, and confirm the answer matches the expected '1277 walls'.

Measured 2026-09-26: the Anthropic API returned 'Your credit balance is too low to access the Anthropic API' before any tool call ran (see artifacts/bim-flow-duckdb/transcript-ask-claude-opus-5-2026-09-26.md, request 8 of 10). Not a code defect; the account ran out of credit partway through the ten-request run. Sibling tickets for the other four requests that failed the same way in the same run: TKT-36, TKT-37, TKT-39, TKT-40.
