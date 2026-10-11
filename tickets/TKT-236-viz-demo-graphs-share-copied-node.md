---
id: TKT-236
title: Viz demo graphs share copied node chains and hard-coded Duplex values; make them model-independent
status: open
depends_on: []
owner:
fence: [samples/viz-analyses/**]
workflow: [W3, W5]
created: 2026-10-11
---

## Acceptance criteria

- [ ] Each viz graph runs on a second public model (e.g. deps/bim-open-data/samples/public/duplex-federated or schependomlaan) by changing one graph input, with no silent truncation
- [ ] The shared prefixes are either one node or documented as intentionally separate

From the viz wave review: facade-orientation and window-to-wall-ratio share an identical five-node start including the Duplex-only filter `Storey != 'T/FDN' and not contains(Name, 'Party Wall')`; storey-stacking and model-composition share seven nodes including a 15-row class map; construction-sequence and progress-s-curve share their element query. Hard-coded Duplex values: viz-progress-s-curve stops its week range at 11 (cut short without a warning when daysPerTask grows), the stacking chart's valueColumns and spec fold list name 12 classes, viz-room-areas lists the storeys by name and ends its colour scale at 32 m2. Graph inputs (TKT-204) are the likely mechanism.
