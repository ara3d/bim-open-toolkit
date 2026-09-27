---
id: TKT-54
title: Scene labels (view3d.label) and the Windows handover bundle for NRC
status: open
depends_on: [TKT-48, TKT-53]
owner:
fence: []
---

## Acceptance criteria

- [ ] view3d.label writes a label column on the instance table and the viewer draws capped screen-space text; a walkthrough figure shows each storey's total over its slab
- [ ] npm run nrc:package writes artifacts/nrc-package/ with the enriched IFC, Parquet, dictionary, IDS, graphs, figures, transcripts, score table, timings, evidence zip, and a README; a fresh clone on a second Windows machine opens the coloured Duplex from its one command

P7 of Proposal: docs/proposals/nrc-deliverables.md. Windows only, per the owner.
