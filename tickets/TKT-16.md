---
id: TKT-16
title: One colour domain with a legend across panes
status: claimed
depends_on: []
owner: small-job-builder
fence: [src/flow/BimOpenFlow.Nodes.Viz/**, src/flow/BimOpenFlow.Nodes.Geometry/**, bimopenflow/web/packages/panes/**, docs/nodes.md]
---

## Acceptance criteria

- [ ] view3d.color accepts a manual domain and emits a legend table that reports the domain actually used, so a clamped domain is visible
- [ ] The 3D pane and the chart pane over the same channel share one colour scale and show the same legend
- [ ] A sample graph demonstrates it over Snowdon

Serves W4 and W3. docs/proposals/core-node-sets.md Set 4 (view3d.colormap, view3d.color v2, unshipped) and docs/proposals/bimopenflow-ux-proposal.md section 5 P1; the PoC's most common novice trap was a silently clamped manual domain.
