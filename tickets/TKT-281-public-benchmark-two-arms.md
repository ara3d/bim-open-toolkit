---
id: TKT-281
title: A committed benchmark over the public models, run twice (toolkit arm and bare arm) by one command, scoring correctness, time and tokens
status: open
depends_on: []
owner:
fence: []
workflow: [W5]
related: [TKT-145, TKT-209]
created: 2026-10-12
---

## Acceptance criteria

- [ ] A question set over the public sample models (Schependomlaan, duplex and the other public .bos/.duckdb files) with known answers checked by hand or by the DuckDB CLI, committed under bench/
- [ ] One command runs every question twice with the same model: once with the toolkit's MCP servers and skills, once with only the raw files and a shell; each run's stream is kept
- [ ] The report gives correctness, wall time, and input, cache and output tokens per arm, and is committed with the transcripts

PROJECT.md workflow 5's Done line. The declared-schemas wave (C3, bench/declared-schemas/2026-10-12/) committed one toolkit-arm run of the Schependomlaan rooms-per-storey question: correct, no exploratory evaluate, 167 s, 0.65 USD; it has no bare arm and only one question, and the existing samples/ask/requests.txt is over the private Snowdon model. In that run Claude read columns with describeDatabase and never called getAnalysis, so whether the inferred columns save tokens is still unmeasured.
