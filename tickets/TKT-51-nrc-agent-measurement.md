---
id: TKT-51
title: Measure Claude on 16 NRC questions, five runs each, expected answers from graphs
status: open
depends_on: [TKT-48, TKT-49, TKT-50, TKT-45]
owner:
fence: []
---

## Acceptance criteria

- [ ] samples/nrc/questions.json: 16 questions over element, zone, storey, building, absence, provenance, ambiguity, and IDS, each naming the graph that computes its expected answer
- [ ] bimopenmcp-ifc-ask scores answers (numeric within 0.1 percent, lists as sets, absence as stated absence) and runs each question five times through the Claude CLI backend
- [ ] Transcript and score table committed under artifacts/nrc-walkthrough/duplex/; target at least 14 of 16 matching in four of five runs, and the table is committed even if missed

P4 of Proposal: docs/proposals/nrc-deliverables.md. Supersedes the IFC half of TKT-41.
