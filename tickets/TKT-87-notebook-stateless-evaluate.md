---
id: TKT-87
title: A stateless evaluate endpoint, so notebook restores stop writing to the store
status: open
depends_on: [TKT-80]
owner:
fence: [src/flow/BimOpenFlow.Host.Api/**, bim-open-notebook:bimopenflow/web/packages/bim-open-notebook/**]
---

## Acceptance criteria

- [ ] Re-evaluating a notebook whose analysis is missing evaluates the embedded graph without PUT /api/analyses
- [ ] Placeholders ({SAMPLES}, {DATA}, {SNOWDON}) resolve the same way as in seeding, and the sample script sends them unexpanded

From docs/plans/notebook.md, Debt: restoring a raw sample graph finds no model; the Snowdon default path, twice; re-evaluation writes to the analysis store.
