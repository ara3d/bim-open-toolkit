---
id: TKT-112
title: The editor's Ask panel docks at the top of the right column with a fixed height
status: done
depends_on: [TKT-84]
owner:
fence: [bimopenflow/web/packages/app/src/askPanel.ts, bimopenflow/web/packages/app/src/askPanel.css, bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/app/src/shell.ts, bimopenflow/web/packages/app/src/styles.ts, bimopenflow/web/packages/app/test/**]
---

## Acceptance criteria

- [x] The Ask panel sits at the top of the right-hand column, above the pane tabs, inside the layout: it never overlays the canvas, sidebar, or panes
- [x] Its height is fixed (about 200px by default), adjustable with a drag handle, and remembered across reloads; the log scrolls inside it and keeps the newest line visible
- [x] Ask events arriving do not move or resize the canvas or the panes (a test renders twenty events and asserts the boxes do not change)
- [x] Collapsed, it is one row holding the input; a host without /api/ask still shows nothing and the right column is unchanged
- [ ] Web unit tests and gates/web-smoke.mjs pass (app: 256 of 256; the gate fails only in @bimopenflow/api-client, whose endpoint test predates the getAnalysisText endpoint added in 130c910)

Owner's finding of 2026-09-28: they expected the Ask Claude box in the upper right, not too small, and not resizing as chat text arrives. Today askPanel.css pins a full-width strip to the bottom of the window over the layout, and its log grows from 0 to 140px, covering more canvas with each line (the same fault TKT-25 fixed in duckdbDemo.css). The right column is kept rather than a pane tab so results stay visible while the agent answers. Serves W2.
