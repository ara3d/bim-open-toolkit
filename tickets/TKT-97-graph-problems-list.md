---
id: TKT-97
title: One list of every warning and error in the open flow, upstream first, where a click selects the node
status: done
depends_on: []
owner:
fence: [bimopenflow/web/packages/app/src/graphProblems.ts, bimopenflow/web/packages/app/src/problemsPanel.ts, bimopenflow/web/packages/app/test/graphProblems.test.ts, bimopenflow/web/packages/app/test/problemsPanel.test.ts, bimopenflow/web/packages/app/src/app.ts]
---

## Acceptance criteria

- [ ] A strip under the canvas reads 'N problems' (or nothing when every node is Ok) and expands to a list ordered by dataflow depth, so the root cause is first
- [ ] Each entry names the node, its status, the badge text, and the upstream cause when one exists; clicking it selects the node and focuses the canvas on it

Serves W2 ('every node shows its state and names the upstream cause'). docs/proposals/editor-ux-harvest.md, 'Why is this node not ready?': LabVIEW's error list. Reuses nodeBadge.ts.
