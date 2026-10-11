---
id: TKT-220
title: Does bim-open-flow's tables profile keep a 2D chart node when chart.* moves to bim-open-plot?
status: open
depends_on: []
owner:
fence: [deps/bim-open-plot/]
created: 2026-10-11
kind: question
---

Serves bim-open-plot workflow 1 (deps/bim-open-plot/PROJECT.md). The Viz pack (chart.bar, chart.line) is loaded in both the bim and the tables profiles (docs/DEMOS.md). The plot brief replaces chart.* with plot.* kinds from bim-open-plot, whose map, drawing, and 3D kinds know about BOS and the viewer. Options: 1. plot.* 2D kinds are BIM-free and the tables profile loads them too. 2. flow keeps a minimal chart node of its own. 3. the tables profile has no charts. Default: option 1, the 2D Vega-Lite kinds depend on nothing BIM-specific.
