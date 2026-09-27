---
id: TKT-40
title: Ask box measurement failed on 'how many tables have at least one row' (Anthropic credit exhausted)
status: done
depends_on: []
owner:
fence: [artifacts/bim-flow-duckdb/**]
---

## Acceptance criteria

- [ ] Rerun 'How many of the tables in this export have at least one row?' from samples/ask/requests.txt against the Claude backend once Anthropic credit is available, and confirm the answer matches the expected '48 tables'.

Measured 2026-09-26: the Anthropic API returned 'Your credit balance is too low to access the Anthropic API' before any tool call ran (see artifacts/bim-flow-duckdb/transcript-ask-claude-opus-5-2026-09-26.md, request 10 of 10, the last of the run). Not a code defect; the account ran out of credit partway through the ten-request run. Sibling tickets for the other four requests that failed the same way in the same run: TKT-36, TKT-37, TKT-38, TKT-39.

Closed 2026-09-26: folded into TKT-41 (one rerun after the account is funded).
