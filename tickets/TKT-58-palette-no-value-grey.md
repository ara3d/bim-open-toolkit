---
id: TKT-58
title: No palette colour may be mistaken for the no-value grey: category10's Wall is (0.498, 0.498, 0.498) against grey (0.5, 0.5, 0.5)
status: open
depends_on: [TKT-16]
owner:
fence: []
workflow: [W3]
---

## Acceptance criteria

- [ ] The no-value colour used by view3d.color for unmatched rows is at least a set perceptual distance from every entry of every palette and gradient in ColorMaps.cs, and a test enforces that for all of them
- [ ] On the NRC test kit graph nrc-join-analytics, instances coloured by category Wall are visibly distinct from unmatched instances; the assertion in JoinAnalyticsTests that is ignored with a reason naming this ticket is re-enabled and passes

Found by the fresh-eyes review of TKT-52 (defect 8): ColorScale.cs sorts categories ordinally and category10 index 7 is 0x7f7f7f, so with the test kit's nine categories every Wall is painted (0.498, 0.498, 0.498), indistinguishable from the (0.5, 0.5, 0.5) that marks no value; matched walls look unmatched, which breaks honest absence (PROJECT.md principle 3). The palette code (src/flow/BimOpenFlow.Nodes.Support/ColorMaps.cs, ColorScale.cs) is inside TKT-16's work on one colour domain across panes, so this waits for it or is folded into it by that ticket's owner.
