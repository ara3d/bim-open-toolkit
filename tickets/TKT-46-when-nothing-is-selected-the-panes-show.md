---
id: TKT-46
title: When nothing is selected, the panes show the graph's answer node instead of going blank
status: claimed
depends_on: []
owner: small-job-builder
fence: [bimopenflow/web/packages/app/src/defaultShown.ts, bimopenflow/web/packages/app/test/defaultShown.test.ts, bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/app/src/paneArea.ts, bimopenflow/web/packages/app/test/paneArea.test.ts, bimopenflow/web/packages/app/README.md]
---

## Acceptance criteria

- [ ] With an analysis open and no node selected, the pane area shows one node chosen by a pure function over the document and evaluation state: the last shown node if it still exists; else the best terminal node (no outgoing wires) ranked by has-a-result, kind (viewers and sinks, then materialized relations, then relations, then sources), upstream depth, position (right then down), then document order; an empty graph or one with no terminal shows nothing
- [ ] The default is shown, not selected: the selection stays empty, no upstream path lights, the editor session reports an empty selection, and the pane carries a quiet header naming the node and saying nothing is selected
- [ ] Selecting a node overrides it; clearing the selection returns to the same shown node without a jump while editing
- [ ] A unit test covers a linear graph, a fork with two terminals of different kinds, a graph whose only terminal has no result yet, and an empty graph; the app suite and typecheck stay green

Serves W2 and principle 9 (start from data, not a blank canvas). Today app.ts passes null to paneArea.showNode whenever primaryNodeId is null, so a freshly opened analysis shows a graph beside an empty table until the user clicks; only the graph demo keeps the last shown node. Design discussed with the owner 2026-09-27: one pure function (defaultShownNode) over the document and evalState, one call site in app.ts, one header line in the pane area. A strip of the other terminal nodes, and a 'shown' field in the editor session for agents, are extension points, not part of this ticket.
