---
id: TKT-32
title: Deterministic graphs and tests for the paper's Q2, Q4, and Q6 so CI asserts all eight answers
status: claimed
depends_on: []
owner: small-job-builder
fence: [samples/nrc-analyses/**, tests/flow/BimOpenFlow.NrcWorkflows.Tests/**]
---

## Acceptance criteria

- [ ] samples/nrc-analyses gains nrc-q2, nrc-q4, and nrc-q6 graphs whose results match the expected values in scripts/demo-ifc-mcp.mjs
- [ ] NrcWorkflows.Tests asserts each by number and CI fails when one changes

TKT-19 left CI covering six of eight answers: only Q1, Q3, Q5, Q7, and Q8 have graphs, and the MCP replay adds Q1, Q5, Q7, Q8. Serves W6.
