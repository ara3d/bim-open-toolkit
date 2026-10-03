---
id: TKT-16
title: One colour domain with a legend across panes
status: open
depends_on: []
owner:
fence: [src/flow/BimOpenFlow.Nodes.Viz/**, src/flow/BimOpenFlow.Nodes.Geometry/**, src/flow/BimOpenFlow.Nodes.Support/**, src/flow/BimOpenFlow.NodeDocs/NodeNotes.cs, bimopenflow/web/packages/panes/**, bimopenflow/web/packages/viz/src/barChart.ts, bimopenflow/web/packages/viz/test/barChart.test.ts, tests/flow/BimOpenFlow.Nodes.Geometry.Tests/**, tests/flow/BimOpenFlow.Nodes.Viz.Tests/**, tests/flow/BimOpenFlow.View3dWorkflows.Tests/**, tests/flow/BimOpenFlow.TableWorkflows.Tests/HostProfileTests.cs, tests/flow/BimOpenFlow.PocParity.Tests/PocCoverageTests.cs, samples/view3d-analyses/**, docs/nodes.md, docs/plans/shared-colour-legend.md]
---

## Acceptance criteria

- [ ] view3d.color accepts a manual domain and emits a legend table that reports the domain actually used, so a clamped domain is visible
- [ ] The 3D pane and the chart pane over the same channel share one colour scale and show the same legend
- [ ] A sample graph demonstrates it over Snowdon

Serves W4 and W3. docs/proposals/core-node-sets.md Set 4 (view3d.colormap, view3d.color v2, unshipped) and docs/proposals/bimopenflow-ux-proposal.md section 5 P1; the PoC's most common novice trap was a silently clamped manual domain.

## Notes

- 2026-09-28 (TKT-80): another session changed `bimopenflow/web/packages/panes/src/viewPane3D.ts`'s status line from "N instances" to "N rendered instances" to stop it disagreeing with the notebook's 714-instance count from `view3d.instances` (commit 4972d92). No uncommitted work under `panes/` was found and the last commit to that file predated this by more than 2 hours, so the fence rule allowed the edit.
- 2026-10-03: claim released; the session that held it (small-job-builder) had stopped. Checked against the code that day. Done: the colour-scale model, `view.colormap`, a manual domain on `view3d.color` with a legend that reports the domain used, and the shared legend strip in both panes (C1 to C10, C12). Left: C11's test and README line for `samples/view3d-analyses/shared-color-legend.json` (Duplex), C13 (the pane area pushes a node's legend to the 3D and chart panes), and C14 (the Snowdon sample, needs TKT-30).
