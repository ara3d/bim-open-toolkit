---
id: TKT-227
title: bim.elements returns Level and Elevation for IFC-derived BOS files, not only Revit ones
status: open
depends_on: []
owner:
fence: [src/flow/BimOpenFlow.Nodes.BimAnalysis/**]
workflow: [W3]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] bim.elements on samples/nrc/duplex-enriched.bos returns a non-null Level for every element that sits in a storey, and an Elevation where the storey has one
- [ ] A test in the BimAnalysis tests covers an IFC-derived BOS and a Revit-derived one
- [ ] Elements with no storey keep Level and Elevation null (honest absence, PROJECT.md principle 3)

Found building the visualization demo graphs in samples/viz-analyses (docs/plans/viz-demos.md). bim.elements returns null Level and Elevation for all 4,607 rows of samples/nrc/duplex-enriched.bos, because it reads the Revit Level parameter only and an IFC-derived BOS has none. The graphs had to take storeys from StoreyOfElement and StoreyOfEntity in the DuckDB export instead. Fix: fall back to the spatial containment (storey) of the entity when the Revit parameter is absent.
