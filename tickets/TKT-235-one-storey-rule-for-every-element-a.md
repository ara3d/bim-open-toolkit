---
id: TKT-235
title: One storey rule for every element: a node or bim.elements Level, replacing four SQL variants in the viz graphs
status: open
depends_on: []
owner:
fence: [src/flow/BimOpenFlow.Nodes.BimAnalysis/**, samples/viz-analyses/**]
workflow: [W3]
related: [TKT-227]
created: 2026-10-11
---

## Acceptance criteria

- [ ] One node (or bim.elements' Level column, TKT-227) gives each element's storey on an IFC-derived model, nearest containing storey first
- [ ] All 14 samples/viz-analyses graphs read storeys from it and still evaluate green with unchanged figures, except where an element gains a storey it was missing

The review of the viz demo wave (docs/plans/viz-demos.md) found four storey rules in the graphs: `s.Depth = 1` over StoreyOfElement (facade, window-to-wall ratio, doors, openings, carbon intensity), `arg_min(StoreyName, Depth)` (construction sequence, S-curve), no depth filter (size outliers, clash matrix), and a recursive ContainedIn/MemberOf query (parameter completeness, room areas); storey stacking and model composition use StoreyOfEntity with arg_min. On the Duplex 72 elements (furniture, stair flights) have a storey only at depth 2, so the depth-1 graphs would drop them. A graph should not choose a storey rule in SQL.
