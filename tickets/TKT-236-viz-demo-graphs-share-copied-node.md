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

Added 2026-10-11 from the sample graph review: "run on my model" needs several inputs, not one, because a viz graph reads up to three representations of one building (duplex-enriched.duckdb, .ifc, .bos) plus the carbon CSV; csv.read's path has no socket (TKT-271 adds one), so until then the CSV can be swapped only through a `$name` input, never a value.path. The recursive storeys sql.query (ContainedIn/MemberOf walk to IfcBuildingStorey) is identical in viz-parameter-completeness and viz-room-areas, a pair not listed above; both work around TKT-227 and die when it lands. colored.joinColumn is `globalId` in five graphs and `GlobalId` in four (TKT-232 settles the behaviour; the samples then pick one spelling).
