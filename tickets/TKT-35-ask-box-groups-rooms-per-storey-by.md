---
id: TKT-35
title: Ask box groups rooms-per-storey by storey id, not by storey name
status: open
depends_on: []
owner:
fence: [.claude/skills/bim-flow/**, samples/ask/requests.txt]
---

## Acceptance criteria

- [ ] For 'How many rooms are on each storey?' the answer sums to the physical storey record (id), so repeated display names (multiple storeys named L4) are shown as separate rows; the expected reference answer (see samples/ask/requests.txt) sums by name, giving L4 = 55 rooms. Either the schema guide should tell the agent to group by storey name when the request says 'storey' in the everyday sense, or the guide should explain that storey ids are the right grain and the expected answer in samples/ask/requests.txt needs updating to match. Whichever is chosen, samples/ask/requests.txt and .claude/skills/bim-flow/ should agree.

Measured 2026-09-26 against claude-opus-5 (see artifacts/bim-flow-duckdb/transcript-ask-claude-opus-5-2026-09-26.md, request 1 of 10). The agent built a valid graph, grouped by storey id, and even flagged in its summary that several rows share a display name because each building block has its own storey record. It never saw samples/ask/requests.txt's expected answer, so this is not a model mistake so much as a genuine ambiguity in the request wording ('storey' as a physical record vs. as a display name) that the schema guide does not resolve.
