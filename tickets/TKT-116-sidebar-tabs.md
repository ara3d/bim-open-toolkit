---
id: TKT-116
title: The left sidebar is two tabs, Steps and Nodes, and the flow list lives only in the top bar
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/app/src/sidebar.ts, bimopenflow/web/packages/app/src/stepList.ts, bimopenflow/web/packages/app/src/catalogFilter.ts, bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/app/src/topbar.ts, bimopenflow/web/packages/app/src/styles.ts, bimopenflow/web/packages/app/src/prefs.ts, bimopenflow/web/packages/app/test/**, gates/web-smoke.mjs]
---

## Acceptance criteria

- [ ] The sidebar no longer lists flows; the top bar's existing flow picker is the one place to switch flows, and every flow the sidebar listed is reachable from it
- [ ] The sidebar shows two tabs, Steps and Nodes; the active tab's list takes the sidebar's full height and scrolls on its own, with the Nodes filter box staying visible
- [ ] The last tab chosen is remembered across reloads; with no remembered choice, a flow with nodes opens on Steps and an empty flow on Nodes
- [ ] Clicking a step still selects and focuses its node, and clicking a catalog entry still adds a node
- [ ] App unit tests pass, and web-smoke.mjs shows no new failures

Owner's decision of 2026-09-28. Today the sidebar stacks Flows, Steps and Node catalog, with Flows and Steps capped (max-height 30%) so the catalog keeps room, so all three are cramped. Flows is a which-document choice the top bar already offers (topbar.ts setAnalyses), Steps is for reading a flow, the catalog for building one; the two are rarely needed at once, so tabs cost little. A canvas quick-add search is a possible later step and is out of scope. Serves W2.
