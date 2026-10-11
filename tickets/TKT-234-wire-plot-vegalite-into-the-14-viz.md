---
id: TKT-234
title: Wire plot.vegaLite into the 14 viz-analyses graphs once bim-open-plot's C# plot pack lands
status: open
depends_on: []
owner:
fence: [samples/viz-analyses/**]
workflow: [W3]
created: 2026-10-11
---

## Acceptance criteria

- [ ] Each of the 14 graphs in samples/viz-analyses ends in a plot.vegaLite node whose spec param is specs/<id>.vl.json
- [ ] Each graph evaluates and the chart renders in the studio chart pane; the README lists the numbers

Found building the visualization demos (docs/plans/viz-demos.md). Every graph has a ready spec in samples/viz-analyses/specs/<id>.vl.json. Blocked on bim-open-plot's C# plot pack (deps/bim-open-plot; see docs/plans/plot/). The plot pack has no ticket yet, so add depends-on when its id is known.
