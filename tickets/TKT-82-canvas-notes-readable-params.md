---
id: TKT-82
title: Notes on the canvas and readable parameters: a view.note node, file names instead of absolute paths, multi-line SQL and expressions
status: open
depends_on: []
owner:
fence: [src/flow/BimOpenFlow.Nodes.Viz/**, tests/flow/BimOpenFlow.Nodes.Viz.Tests/**, docs/nodes.md, bimopenflow/web/packages/app/src/canvas*.ts, bimopenflow/web/packages/app/src/paramText.ts, bimopenflow/web/packages/app/src/longValueEditor.ts, bimopenflow/web/packages/app/src/graphWidgets.ts, bimopenflow/web/packages/app/src/viewModel.ts, bimopenflow/web/packages/app/src/nodeBadge.ts, bimopenflow/web/packages/app/src/styles.ts]
---

## Acceptance criteria

- [ ] A view.note node (Viz pack, both profiles) has one text parameter, no ports, and draws on the canvas as a sticky note whose text wraps and is edited in place
- [ ] A FilePath parameter shows its file name, with the full path on hover
- [ ] SQL and expression parameters show up to six wrapped lines on the node instead of one truncated line

Owner's flow review, 2026-09-27: 'Text notes in the graph as comments might help'; paths showed as a truncated C:/Users/... prefix; SQL was cut to one line.
