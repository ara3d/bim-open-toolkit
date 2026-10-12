---
id: TKT-273
title: docs/DEMOS.md describes showcase-analyses as before TKT-93, undercounts the bim-only NRC graphs, and omits the federation graph
status: done
depends_on: []
owner: builder-TKT-273
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [docs/DEMOS.md]
workflow: [W1]
created: 2026-10-11
claimed: 2026-10-11
closed: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] The showcase-analyses row lists csv-to-chart and bos-to-relations and points to nrc-dc-w1-verdicts and showcase-tables for what moved
- [ ] The nrc-analyses row names the four bim-only graphs; the snowdon-analyses row names federation-match and SnowdonWorkflows.Tests

From the 2026-10-11 review. Line 106 still says the folder shows 'relations into verdicts, a coloured 3D view, a chart, an HTML report' over five input kinds; line 107 says two graphs are bim only (four are); line 115 names only the 3D recipes for the Snowdon folder.
