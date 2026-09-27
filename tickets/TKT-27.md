---
id: TKT-27
title: The node catalog is a collapsed tree grouped by pack, opened by search
status: claimed
depends_on: []
owner: small-job-builder
fence: [bimopenflow/web/packages/app/src/sidebar.ts, bimopenflow/web/packages/app/src/catalogFilter.ts, bimopenflow/web/packages/app/src/prefs.ts, bimopenflow/web/packages/app/src/styles.ts, bimopenflow/web/packages/app/test/**]
---

## Acceptance criteria

- [ ] The catalog opens with every pack (table, rel, chart, view3d, sink, and so on) collapsed to one row with a count; a click expands one pack
- [ ] Typing in the filter expands only the packs with matches and shows the matching nodes; clearing it collapses them again
- [ ] Expanded state survives a reload (prefs.ts), and the catalog never pushes the analysis list out of view
- [ ] A test covers collapse, expand, filter-expands-matches, and restore; gates/web-smoke.mjs passes

Owner's finding of 2026-09-26: the node catalog on the left was fully expanded and too big; a collapsed or tree view was expected. Serves W1 and W2. bimopenflow/web/packages/app/src/sidebar.ts renders one flat list from filterCatalog in catalogFilter.ts; NodeDescriptor.kind already carries the pack prefix.
