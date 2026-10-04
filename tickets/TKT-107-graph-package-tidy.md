---
id: TKT-107
title: Move the graph document helpers down to state and give the graph package subfolders
status: open
depends_on: [TKT-12, TKT-17]
owner:
fence: [bimopenflow/web/packages/graph/**, bimopenflow/web/packages/state/src/**, bimopenflow/web/packages/app/src/**, bim-open-notebook:bimopenflow/web/packages/bim-open-notebook/src/**]
---

## Acceptance criteria

- [ ] graphPreview.ts's nodeTitle, upstreamIds, and previewAfterEdit live in @bimopenflow/state (they are pure over a GraphDocument) and app, graph, and the notebook import them from there
- [ ] packages/graph/src has subfolders (parts, slots, results, or similar) and the README's layout section matches

Deferred by docs/plans/graph-editor-package.md because state/** was in TKT-12's and TKT-17's fences and a rename in the same commit as a move would hide the move from git log --follow. Also record here if ids.ts's freshNodeId turns out to be wanted by the package (addNodePlan uses it from app today).
