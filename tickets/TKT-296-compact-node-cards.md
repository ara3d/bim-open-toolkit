---
id: TKT-296
title: Compact node cards: a canvas toggle that shows each node as its header, ports, and one summary line
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/bimopenflow/web/packages/graph/src/cardDensity.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/src/viewModel.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/src/canvasEditor.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/src/index.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/test/cardDensity.test.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/cardDensityChoice.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/sidebar.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/chrome.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/app.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/classicChrome.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/studio/studioChrome.ts]
workflow: [W3]
related: [TKT-278, TKT-98]
confidence: high
created: 2026-10-12
---

## Acceptance criteria

- [ ] A button above the step list switches the canvas between full and compact cards without a reload, and the choice persists in localStorage
- [ ] A compact card shows its kind, id, status badge, ports, its wired parameter rows, and one summary line from the first parameter the document sets; no other parameter editors and no description
- [ ] Every wire still lands on its port or parameter socket in compact mode
- [ ] Tests cover compact card content and that compact cards are shorter than full ones on a sample graph

Requested by the owner 2026-10-12 after the LinkedIn hero image (`artifacts/linkedin-hero/hero.html`, git-ignored) drew five nodes of `viz-door-accessibility` as two-line cards: kind and id, then one summary line and a row count. The same graph on the studio canvas is 16 full cards; `view3d.color` alone is about 750 px tall because every parameter is an inline editor and the catalog description wraps below.

First step (this ticket): a page-wide card density, `full` or `compact`, on the pattern of the description level (TKT-278, `graph/src/descriptionLevel.ts`). A compact card keeps its header, badge, and ports; it drops the parameter editors except the wired ones (a parameter socket needs its row for the wire to land), drops the description, and shows one summary line made from the first parameter the document sets. A saved card width is ignored, so the card is as wide as its title. Tidy in compact mode lays the graph out at the compact sizes.

Later, as their own tickets when this proves useful:
- each node kind declares which parameters make its summary line, in the catalog, instead of "the first one set";
- the card shows the row count or verdict of its last evaluation on the summary line;
- fold the branches that do not lead to the shown node (overlaps the folding question in `docs/proposals/editor-ux-harvest.md`);
- a compact picture of a graph for a notebook or report embed.
