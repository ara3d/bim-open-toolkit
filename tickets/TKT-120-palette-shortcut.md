---
id: TKT-120
title: A key opens the canvas palette to add a node without the mouse
status: done
depends_on: [TKT-96]
owner: claude-tkt120
fence: [bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/app/src/canvasPalette.ts, bimopenflow/web/packages/app/src/paletteFilter.ts, bimopenflow/web/packages/app/src/styles.ts, bimopenflow/web/packages/app/test/**]
---

## Acceptance criteria

- [x] With the canvas focused and no text field active, pressing Space (or another key chosen in the design, stated in the commit) opens the existing canvas palette (TKT-96) at the pointer when it is over the canvas, otherwise at the canvas centre
- [x] The search box has focus on open: typing filters, arrow keys move, Enter adds the highlighted kind at that point as one undo step, Escape closes without adding
- [x] The key does nothing while typing in any input, textarea, select, or the Ask panel, and does not clash with the existing undo and redo shortcuts
- [x] The shortcut is discoverable: named in the empty-canvas hint or the palette's own placeholder text
- [x] App unit tests pass, and web-smoke.mjs shows no new failures

Owner's request of 2026-09-28, from the sidebar discussion (TKT-116): a quick-add search on the canvas so that building a flow rarely needs the sidebar's Nodes tab. The palette itself exists (canvasPalette.ts, opened today only by a right-click on empty canvas or a wire dropped there, app.ts around line 185); this adds a keyboard way in. The editor's key handler is onKeyDown in app.ts (around line 486). app.ts is also in TKT-116's fence, so build this after TKT-116 lands. Serves W2.

Done 2026-09-28: Space, which does not pan (panning is a drag) and which gratify takes only for a focused part the canvas never declares. The palette opens at the pointer over the canvas, else at its centre, and the placeholder reads "Add a node (Space)". One gap: the graph package keeps its client-to-world conversion private (`clientToWorld` in `graph/src/canvasEditor.ts`, outside this fence), so a node added this way is placed on the first free grid spot, as the Nodes tab places one, not under the pointer; it can land outside the visible viewport. Exposing that conversion on `GraphEditor` would let `app.ts` pass the pointer's world point instead of `undefined`.
