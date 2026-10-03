---
id: TKT-8
title: Measure the Claude backend on the Ask request set and record the transcript
status: open
depends_on: [TKT-45]
owner:
fence: [scripts/ask-bim-flow.mjs, docs/bim-flow-mcp-demo.md, artifacts/bim-flow-duckdb/**, samples/duckdb-analyses/**]
---

## Acceptance criteria

- [ ] The ten questions in docs/bim-flow-mcp-demo.md and their expected answers are committed as a request file (for example samples/ask/requests.txt) that scripts/ask-bim-flow.mjs --file reads; correct means a match to the expected value
- [ ] The file runs against the Claude backend and the transcript is committed beside the gpt-5 one
- [ ] docs/bim-flow-mcp-demo.md shows both backends' scores in one table (correct graphs, honest answers, wrong answers) with the date and commit
- [ ] Each wrong or failed request becomes a ticket naming the cause

Serves W2. The Claude backend landed in commit d0aa10c (2026-09-18) and 'has not been measured on the same request set yet'; the only published numbers are gpt-5's 8 correct, 2 honest, 0 wrong of 10. Nothing about the Ask box should change before this baseline exists. TKT-6 is closed: the host already prefers the Anthropic key; this ticket supplies the measurement and the committed set the brief's success line names.

## Result so far (2026-09-26, commits 70fdc55, d3a9d7a)

samples/ask/requests.txt holds the ten questions with expected answers; one pass with claude-opus-5 scored 4 correct, 0 honest, 1 wrong (TKT-35: rooms per storey grouped by storey id, not name), and 5 failed because the Anthropic account ran out of credit mid-run. The transcript and the score table are committed. Stays open until TKT-41 reruns the five with a funded account.



## Owner's decision, 2026-09-27

The Anthropic API account is not to be used. Claude is called from the command line (the Claude Code CLI signed in on the owner's machine), with Haiku models at medium effort. TKT-45 builds that backend; the rerun this ticket waits for (TKT-41) runs through it. The opus-5 row in the score table stays as history; the next row is Haiku over the command line. Depends on TKT-45 now.

## Notes

- 2026-10-03: claim released; the session that held it (small-job-builder) had stopped. Checked against the code that day. Done: the ten-question request file `samples/ask/requests.txt` (70fdc55) and an opus-5 run (4 correct, 1 wrong, 5 failed for credit) in `docs/bim-flow-mcp-demo.md`. Left: run the request file through the Claude CLI backend (Haiku, TKT-45), commit the transcript, add its row to the score table, and file a ticket per wrong answer. The five failures sit in TKT-41.
