---
id: TKT-294
title: The public sample graphs open in the studio look with varied, coloured Vega-Lite charts that fit their pane
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/**, deps.json, docs/nodes.catalog.json, docs/nodes.md, samples/**, bimopenflow/web/package-lock.json]
workflow: [W1, W3]
related: [TKT-220, TKT-234, TKT-16]
confidence: high
created: 2026-10-12
---

## Acceptance criteria

- [ ] bim-open-flow's GitHub Pages site (site-web) mounts the editor in the studio look (studioChrome) with the studio canvas theme as the default; its New, Save, Run, flow picker, and connection status are hidden, and the answer pane sits above the canvas at full width as before
- [ ] The chart pane (@bimopenflow/panes) renders chart.bar and chart.line through Vega-Lite with one theme object (fonts and the family palette), sized to its pane with a ResizeObserver, so no scrollbar appears when the chart fits
- [ ] chart.bar declares layout (vertical, horizontal, stacked) and colorBy (auto, category, series, none) params; the catalog files in both repositories and the chart node tests cover them
- [ ] The six samples/buildings graphs use at least three distinct chart layouts and show more than one colour; site/data/buildings.json is regenerated and SiteData_IsCurrent passes
- [ ] gates/pages-smoke.mjs passes; the sample layout tests pass in both repositories; deps.json pins the pushed bim-open-flow commit

Asked by the owner on 2026-10-12 from a screenshot of the Schependomlaan room-names graph on the Pages site: the studio theme should be the default, the charts should use BIM Open Plot, vary more, and show more colours, and the chart pane showed two scrollbars it did not need.

Why Vega-Lite inside bim-open-flow rather than an import from bim-open-plot: plot's renderer and theme live in its demos package, and plot is layered above flow (its pack loads in the toolkit's bim profile), so flow cannot depend on it. The chart pane gets its own Vega-Lite spec builder and theme; the theme copies plot's family palette with the flow accent first. Folding the two theme objects into one is deferred: see the follow-up ticket filed at close.
