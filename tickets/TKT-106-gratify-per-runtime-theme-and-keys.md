---
id: TKT-106
title: Gratify core: a per-runtime token set and focus-scoped keys, so two canvases on a page can differ
status: open
depends_on: []
owner:
fence: [submodules/gratify/**, bimopenflow/web/packages/graph/src/canvasTheme.ts, bimopenflow/web/packages/graph/src/instance.ts]
kind: idea
---

Two gratify core gaps surfaced by TKT-94 (docs/graph-module-layering.md, Consequences). (1) The theme is process-wide: tokens, themes, and themeVersion are module-level in submodules/gratify/src/gratify/theme.ts and every part's style reads the one live token set, so two canvases on a page cannot differ; a token set in RuntimeOpts would let CanvasInstance carry a theme. (2) Every runtime adds a keydown listener on window, so two editable canvases on one page both receive Delete; a focused-runtime rule in core would scope keys. Both go into gratify core, per the layering decision, not into the graph package.
