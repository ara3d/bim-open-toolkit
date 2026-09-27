---
id: TKT-11
title: Peek at any wire: hover a port for its table, row counts on wires
status: claimed
depends_on: []
owner: assembly-line-supervisor
fence: [bimopenflow/web/packages/app/src/portResults.ts, bimopenflow/web/packages/app/src/portGeometry.ts, bimopenflow/web/packages/app/src/portHover.ts, bimopenflow/web/packages/app/src/peekCard.ts, bimopenflow/web/packages/app/src/viewModel.ts, bimopenflow/web/packages/app/src/canvasParts.ts, bimopenflow/web/packages/app/src/canvasEditor.ts, bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/app/README.md, bimopenflow/web/packages/app/test/**, tests/flow/BimOpenFlow.Host.Tests/PeekHostTests.cs, docs/plans/peek-any-wire.md]
---

## Acceptance criteria

- [ ] Hovering or clicking any output port shows the first rows and the column names of the table on it, paged from the host
- [ ] Every table-carrying wire shows its row count, computed as a count aggregate over the upstream plan rather than by materialising the table
- [ ] The peek never triggers an effect node (principle 2)

Serves W2 and W3, and principle 5 (every wire can be peeked at). docs/proposals/bimopenflow-ux-proposal.md section 4 item 2 calls this the single highest-leverage feature because every workflow flows tables; docs/proposals/table-graph-layers.md names the count mechanism: execute(compile(Aggregate(plan, count))).
