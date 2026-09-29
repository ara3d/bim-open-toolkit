---
id: TKT-103
title: A click on the canvas takes keyboard focus, so Delete and Ctrl+Z reach the graph instead of the sidebar's filter box
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/app/src/shell.ts, bimopenflow/web/packages/app/test/**]
---

## Acceptance criteria

- [ ] After typing in the sidebar's node filter and clicking a node or wire on the canvas, pressing Delete removes the selection and does not edit the filter text
- [ ] The same holds for the Steps list and the start page: a canvas click always ends chrome focus

Found by the TKT-94 session's browser check after 5d2a35c: gratify's pointerdown does not move focus, so a text box in the chrome keeps it until the user clicks elsewhere in the chrome. Likely fix: a pointerdown listener on the canvas host that blurs the active element (or focuses the canvas, which has tabindex) before gratify handles the press. Serves W2.
