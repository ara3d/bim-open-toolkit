---
id: TKT-222
title: How does a figure's selection reach the notebook and the viewer?
status: open
depends_on: []
owner:
fence: [deps/bim-open-plot/]
created: 2026-10-11
kind: question
---

Serves bim-open-plot workflow 1 and principle 4 (deps/bim-open-plot/PROJECT.md): a selection is a set of element ids, storeys, or classes shared by chart, drawing, 3D view, and table. Vega-Lite exposes selection only through compiled signal names (view.addSignalListener), the viewer has its own selection events, and the notebook's chart embed has TKT-88 open for selection. Options: 1. one selection bus in bim-open-plot that each host adapts to. 2. per-host adapters with no shared object. 3. the notebook's selection.ts becomes the shared contract. Default: option 1, with the notebook's selection.ts as the first adapter.
