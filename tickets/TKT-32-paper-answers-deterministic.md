---
id: TKT-32
title: Deterministic graphs and tests for the paper's Q2, Q4, and Q6 so CI asserts all eight answers
status: done
depends_on: []
owner: small-job-builder
fence: [samples/nrc-analyses/**, tests/flow/BimOpenFlow.NrcWorkflows.Tests/**]
---

## Acceptance criteria

- [ ] samples/nrc-analyses gains nrc-q2, nrc-q4, and nrc-q6 graphs whose results match the expected values in scripts/demo-ifc-mcp.mjs
- [ ] NrcWorkflows.Tests asserts each by number and CI fails when one changes

TKT-19 left CI covering six of eight answers: only Q1, Q3, Q5, Q7, and Q8 have graphs, and the MCP replay adds Q1, Q5, Q7, Q8. Serves W6.

## Result (2026-09-26, commit 5793cf7)

Three graphs and three tests; NrcWorkflows 55 pass and a deliberately broken expectation fails. Q2: Level 2 has the higher mean EUI, 40.56 against 40.5. Q4 is not one number: the name is a Revit family:type shared by four doors (117.3, 61.8, 54.0, 146.1 kgCO2e/yr, sum 379.2), so the graph lists all four. Q6: every element cites run-2026-09-17-01, scenario Baseline; no separate timestamp exists in the data. Correction: scripts/demo-ifc-mcp.mjs replays only Q1, Q5, Q7, Q8, so the "expected values" this ticket cited for Q2, Q4, Q6 never existed there; the values above come from the checked-in CSVs.
