---
id: TKT-105
title: Notebook graph cells: wire peeks and row counts, and node selection shared with the embeds a node produced
status: open
depends_on: [TKT-94, TKT-88]
owner:
fence: [bim-open-notebook:bimopenflow/web/packages/bim-open-notebook/src/embeds/**, bim-open-notebook:bimopenflow/web/packages/bim-open-notebook/test/**]
kind: idea
---

Extension points from docs/plans/graph-editor-package.md. (1) Peeks in a cell: pass readPort bound to api.getResult(embed.analysisId, ...) to createGraphEditor, so hovering a wire in a notebook shows its row count and first rows; the analysis must exist on the host, which refresh() already ensures by restoring it. (2) Cross-cell node selection: the page's SelectionBus carries element ids, and node ids are another identity space, so a node selected in a cell cannot yet highlight the table embed that node produced; a typed bus or a second channel is needed, after TKT-88's chart selection.
