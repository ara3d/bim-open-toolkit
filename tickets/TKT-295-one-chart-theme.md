---
id: TKT-295
title: One chart theme object for bim-open-flow's chart pane and bim-open-plot's demos
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/bimopenflow/web/packages/panes/src/chartTheme.ts, deps/bim-open-plot/packages/demos/src/theme.ts]
workflow: [W3]
related: [TKT-294, TKT-220]
confidence: medium
created: 2026-10-12
---

## Acceptance criteria

- [ ] The palette, fonts, and Vega-Lite config live in one module that both the flow chart pane (chartTheme.ts) and the plot demo page (theme.ts) import, with the product accent as the one parameter
- [ ] @bimopenflow/viz's BarChart and LineChart, which lost their last caller to the Vega-Lite pane in TKT-294, are deleted or given a caller
- [ ] bim-open-notebook's ChartEmbed validator accepts the layout and colorBy fields the pane's ChartPaneOptions gained, and its own pin of bim-open-flow moves past 60fdfd2

TKT-294 gave bim-open-flow's chart pane a Vega-Lite theme copied from bim-open-plot's demo theme (deps/bim-open-plot/packages/demos/src/theme.ts) with the flow blue first instead of plot's ochre. Plot is layered above flow (its pack loads in the toolkit's bim profile) and has no library package yet, so neither could import the other without a cycle. When plot publishes a package, or TKT-220 decides where 2D charts live, fold the two objects into one.
