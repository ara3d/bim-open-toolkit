---
id: TKT-103
title: A click on the canvas takes keyboard focus, so Delete and Ctrl+Z reach the graph instead of the sidebar's filter box
status: done
depends_on: []
owner: claude-tkt103
fence: [bimopenflow/web/packages/graph/src/canvasFocus.ts, bimopenflow/web/packages/graph/src/canvasEditor.ts, bimopenflow/web/packages/graph/test/canvasFocus.test.ts]
---

## Acceptance criteria

- [x] After typing in the sidebar's node filter and clicking a node or wire on the canvas, pressing Delete removes the selection and does not edit the filter text
- [x] The same holds for the Steps list and the start page: a canvas click always ends chrome focus

Fence moved from `packages/app` to `packages/graph`: since 5d2a35c (TKT-94) the canvas editor is `createGraphEditor` in `@bimopenflow/graph`, mounted by both the studio and the notebook, so the fix there covers every mount. The canvas had no tabindex in either host; `installCanvasFocus` gives it tabindex -1 and focuses it with `preventScroll` on pointerdown, installed before gratify's mount (commit 9c8da2b). Browser check on the DuckDB studio (host 5219, Vite 5309, agent-door-schedule): typed "sql" in the node filter, clicked the duck.source node, Delete removed it with the filter text intact and focus on the canvas, Ctrl+Z restored it; the same after clicking a Steps entry and after closing the start page with a card focused. Not saved; the stored analysis is unchanged.

Found by the TKT-94 session's browser check after 5d2a35c: gratify's pointerdown does not move focus, so a text box in the chrome keeps it until the user clicks elsewhere in the chrome. Likely fix: a pointerdown listener on the canvas host that blurs the active element (or focuses the canvas, which has tabindex) before gratify handles the press. Serves W2.
