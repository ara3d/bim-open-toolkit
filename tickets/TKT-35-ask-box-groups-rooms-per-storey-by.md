---
id: TKT-35
title: Ask box groups rooms-per-storey by storey id, not by storey name
status: done
depends_on: []
owner: claude-tkt35
fence: [.claude/skills/bim-flow/**, samples/ask/requests.txt]
---

## Acceptance criteria

- [x] For 'How many rooms are on each storey?' the answer sums to the physical storey record (id), so repeated display names (multiple storeys named L4) are shown as separate rows; the expected reference answer (see samples/ask/requests.txt) sums by name, giving L4 = 55 rooms. Either the schema guide should tell the agent to group by storey name when the request says 'storey' in the everyday sense, or the guide should explain that storey ids are the right grain and the expected answer in samples/ask/requests.txt needs updating to match. Whichever is chosen, samples/ask/requests.txt and .claude/skills/bim-flow/ should agree.

Measured 2026-09-26 against claude-opus-5 (see artifacts/bim-flow-duckdb/transcript-ask-claude-opus-5-2026-09-26.md, request 1 of 10). The agent built a valid graph, grouped by storey id, and even flagged in its summary that several rows share a display name because each building block has its own storey record. It never saw samples/ask/requests.txt's expected answer, so this is not a model mistake so much as a genuine ambiguity in the request wording ('storey' as a physical record vs. as a display name) that the schema guide does not resolve.

## Resolution (2026-09-28)

Storey id is the grain. Queried against artifacts/building-model-workflows/snowdon-cli.duckdb: 84 storey rows carry 34 names, and each discipline file's names are unique within it, so the repeats are one row per level per source file, not per building block. 290 spaces sit on 33 storey ids (11 names); 4 have no storey. By id the top row is L1 - Block 43 (Electrical file), 26; by name L4 = 55 = 20 Architectural + 15 Electrical + 12 HVAC + 8 Plumbing, and the MEP files' spaces repeat the architectural rooms (Office Unit 401 in four files), so the name sum counts one room up to four times. Merging storeys across files is TKT-30's correspondence table (elevation, then name and GlobalId as corroboration), not a name match; once its FederatedStorey view exists, the expected answer should be re-derived from it. schema-guide.md and samples/ask/requests.txt now agree on the id grain.
