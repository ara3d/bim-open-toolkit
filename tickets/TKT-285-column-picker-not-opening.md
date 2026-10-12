---
id: TKT-285
title: The column picker never opens in a real browser: the listbox stays hidden and empty on focus, Down and typing although the suggestions arrive
status: open
depends_on: []
owner:
fence: []
workflow: [W2]
related: [TKT-205, TKT-210, TKT-23]
created: 2026-10-12
kind: defect
---

Seen by the supervisor on 2026-10-12 in the built-in browser against bim-open-flow's generic host built from source at the wave C head (flow-host-alt on 5215, flow-web-alt on 5304, analysis schependomlaan-spaces-per-storey uploaded from samples/buildings with {PUBLIC} substituted). Clicking the perStorey Group By box gives it focus (document.activeElement is the 'perStorey groupBy' textbox), the editor requests GET .../suggestions/perStorey/groupBy and the host answers 200 with nine columns (EntityIndex:Integer ... Depth:Integer), yet every [role=listbox] div in the DOM stays display:none with no option children; ArrowDown and typing a comma change nothing (value becomes 'StoreyName,' with no list). The native datalist path still works for other controls (bof-suggest-entities::table exists). The TKT-205 and TKT-210 jsdom tests pass, so they do not exercise the open path the browser takes: check how attachSuggestions in bimopenflow/web/packages/graph/src/suggestInput.ts decides to show the picker (the focus event may fire before the suggestions promise resolves and nothing re-opens on resolve, or the popup is created in a container the canvas never mounts), and add a test that drives the real DOM events (focus, then the resolved fetch) rather than calling the handler directly. The sort node's key comboboxes on the same page do list the inferred columns (StoreyName, Spaces), so the schema-driven suggestions themselves reach the editor.
