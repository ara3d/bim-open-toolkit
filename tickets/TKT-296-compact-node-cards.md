---
id: TKT-296
title: Compact node cards: a canvas toggle that shows each node as its header, ports, and one summary line
status: done
depends_on: []
owner:
fence: [deps/bim-open-flow/bimopenflow/web/packages/graph/src/cardDensity.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/src/viewModel.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/src/canvasEditor.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/src/index.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/test/cardDensity.test.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/cardDensityChoice.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/sidebar.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/chrome.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/app.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/classicChrome.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/studio/studioChrome.ts]
workflow: [W3]
related: [TKT-278, TKT-98]
confidence: high
created: 2026-10-12
closed: 2026-10-12
---

## Acceptance criteria

- [x] A button above the step list switches the canvas between full and compact cards without a reload, and the choice persists in localStorage
- [x] A compact card shows its kind, id, status badge, ports, its wired parameter rows, and one summary line from the first parameter the document sets; no other parameter editors and no description
- [x] Every wire still lands on its port or parameter socket in compact mode
- [x] Tests cover compact card content and that compact cards are shorter than full ones on a sample graph

Requested by the owner 2026-10-12 after the LinkedIn hero image (`artifacts/linkedin-hero/hero.html`, git-ignored) drew five nodes of `viz-door-accessibility` as two-line cards: kind and id, then one summary line and a row count. The same graph on the studio canvas is 16 full cards; `view3d.color` alone is about 750 px tall because every parameter is an inline editor and the catalog description wraps below.

First step (this ticket): a page-wide card density, `full` or `compact`, on the pattern of the description level (TKT-278, `graph/src/descriptionLevel.ts`). A compact card keeps its header, badge, and ports; it drops the parameter editors except the wired ones (a parameter socket needs its row for the wire to land), drops the description, and shows one summary line made from the first parameter the document sets. A saved card width is ignored, so the card is as wide as its title. Tidy in compact mode lays the graph out at the compact sizes.

Later, as their own tickets when this proves useful:
- each node kind declares which parameters make its summary line, in the catalog, instead of "the first one set";
- the card shows the row count or verdict of its last evaluation on the summary line;
- fold the branches that do not lead to the shown node (overlaps the folding question in `docs/proposals/editor-ux-harvest.md`);
- a compact picture of a graph for a notebook or report embed.

## Build log

2026-10-12, bim-open-flow c3e7941: the toggle reads "Cards: Full" or "Cards: Compact" above the step list, in both looks. Checked in the running studio on `nrc-dc-w1-verdicts`: compact cards keep every wire, and Tidy packs the graph at the compact sizes. Outside the fence: `app/src/styles.ts` and `app/src/studio/studio.css` (the button shares the description control's look), and `app/test/studioChrome.test.ts` (its mock actions gained `setCardDensity`). The toolkit's pin of bim-open-flow in `deps.json` is not moved.

## Close gates

2026-10-12, toolkit sample graphs: `npx vitest run test/sampleCards.test.ts test/sampleLayout.test.ts` in `bimopenflow/web/packages/studio-web` passed.

```
 RUN  v3.2.7 C:/Users/cdigg/git/bim-open-toolkit/bimopenflow/web/packages/studio-web
 ✓ test/sampleLayout.test.ts (2 tests) 3ms
 ✓ test/sampleCards.test.ts (5 tests) 3829ms
   ✓ no text overflows its card > for every sample graph as shown and at least width  2152ms
   ✓ no text overflows its card > for every catalog kind with default and long values  1548ms
 Test Files  2 passed (2)
      Tests  7 passed (7)
   Start at  23:01:37
   Duration  6.39s (transform 1.23s, setup 0ms, collect 4.46s, tests 3.83s, environment 0ms, prepare 211ms)
```

2026-10-12, bim-open-flow sample graphs: `npx vitest run test/sampleLayout.test.ts test/sampleOverlap.test.ts test/textOverflow.test.ts` in `deps/bim-open-flow/bimopenflow/web/packages/graph` passed.

```
 RUN  v3.2.7 C:/Users/cdigg/git/bim-open-toolkit/deps/bim-open-flow/bimopenflow/web/packages/graph
 ✓ test/sampleOverlap.test.ts (3 tests) 143ms
 ✓ test/sampleLayout.test.ts (2 tests) 169ms
 ✓ test/textOverflow.test.ts (6 tests) 1187ms
   ✓ no text overflows its card > with hidden descriptions, for every catalog kind with default and long values  326ms
 Test Files  3 passed (3)
      Tests  11 passed (11)
   Start at  23:01:52
   Duration  3.01s (transform 828ms, setup 0ms, collect 2.68s, tests 1.50s, environment 1ms, prepare 352ms)
```

2026-10-12, bim-open-flow pin: `node scripts/check-pin.mjs bim-open-flow` in `.` passed.

```
bim-open-flow: pinned at c3e7941, pushed
```

2026-10-12, bim-open-flow 2a12e98: in the studio look the toggle is a Compact button in the canvas toolbar beside Tidy, highlighted while on; the owner could not find the sidebar text. The classic look keeps it above the step list.
