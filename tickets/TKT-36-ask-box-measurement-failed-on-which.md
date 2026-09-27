---
id: TKT-36
title: Ask box measurement failed on 'which source documents contributed elements' (Anthropic credit exhausted)
status: done
depends_on: []
owner:
fence: [artifacts/bim-flow-duckdb/**]
---

## Acceptance criteria

- [ ] Rerun 'Which source documents contributed elements, and how many elements came from each?' from samples/ask/requests.txt against the Claude backend once Anthropic credit is available, and confirm the answer matches the expected '7 source documents'.

Measured 2026-09-26: the Anthropic API returned 'Your credit balance is too low to access the Anthropic API' before any tool call ran (see artifacts/bim-flow-duckdb/transcript-ask-claude-opus-5-2026-09-26.md, request 6 of 10). Not a code defect; the account ran out of credit partway through the ten-request run. Sibling tickets for the other four requests that failed the same way in the same run: TKT-37, TKT-38, TKT-39, TKT-40.

Closed 2026-09-26: folded into TKT-41 (one rerun after the account is funded).
