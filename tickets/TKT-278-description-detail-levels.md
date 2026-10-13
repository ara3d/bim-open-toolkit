---
id: TKT-278
title: Node descriptions show two sentences by default, with a hidden, brief, full toggle for the step list and the cards
status: done
depends_on: []
owner: builder-TKT-278
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [deps/bim-open-flow/bimopenflow/web/packages/app/src/stepList.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/sidebar.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/prefs.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/topbar.ts, deps/bim-open-flow/bimopenflow/web/packages/app/test/**, deps/bim-open-flow/bimopenflow/web/packages/graph/src/nodeSize.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/src/canvasParts.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/test/**]
workflow: [W2]
created: 2026-10-11
claimed: 2026-10-12
closed: 2026-10-12
---

## Acceptance criteria

- [x] The step list shows the first two sentences of a node's catalog description by default, not one
- [x] One control (in the Steps tab header or the top bar) cycles three levels: hidden (no description text), brief (two sentences), full (the whole catalog description); the level is remembered per browser and applies to the step list and to the card footer on the canvas
- [x] Card heights follow the level so no text overflows and the layout algorithms use the real card sizes (TKT-125)

Owner's request 2026-10-11: the one-sentence descriptions in the step list are too short to say what a step does; two sentences by default, and a way to hide them or see the whole text. stepList.ts takes firstSentence(desc.description); canvasParts.ts fits the description to the card.

## Progress 2026-10-12

Criterion 1 is done in bim-open-flow 57c60cd: `leadSentences(text, BRIEF_SENTENCES)` in app/src/stepList.ts. Criteria 2 and 3 stopped at the fence. They need these files besides the fence's:

- `graph/src/viewModel.ts`: `cardContent` must carry the description, so `nodeSize` can size the card for it (today `nodeSize` never sees the description).
- `graph/src/nodeRender.ts`: since TKT-277 the card draws its description fitted onto header line 2, with no footer. A brief or full level needs a wrapped block at the bottom of the card, inside the height `nodeSize` gives it, so `nodeFootprint` and the layouts see the real size.
- `graph/src/index.ts`: export the level seam (a `DescriptionLevel` of hidden, brief, full with a setter and a change signal, as nodeStyle.ts was), so the app can set it.
- `app/src/app.ts` and `app/src/chrome.ts`: a `setDescriptionLevel` chrome action that saves the choice (prefs.ts), sets the seam, re-renders the step list, and refreshes the canvas; and `classicChrome.ts` / `studio/studioChrome.ts` to place the one control (topbar.ts and sidebar.ts are already fenced).

## Done 2026-10-12

bim-open-flow cae7643 (graph package): `graph/src/descriptionLevel.ts` is the page-wide level seam (hidden, brief, full; default brief); `cardContent` cuts the description to the level, `nodeSize` adds its wrapped lines to the card's height, `nodeRender` draws them as a block below the param rows (header line 2 keeps only the id), and every mounted canvas re-syncs on a change, so `nodeFootprint`, `autoLayout` and `freePosition` use the real height. Tests: `test/descriptionCards.test.ts`, `test/descriptionLevel.test.ts`, and `test/textOverflow.test.ts` now at all three levels.

bim-open-flow 5c3741d (app package): a "Descriptions: Brief" button above the steps in both looks cycles the level; the `setDescriptionLevel` chrome action saves it (`bof-app-description-level`), sets the seam, and redraws the step list. Test: `app/test/descriptionLevel.test.ts`.

Left over: the committed layouts in bim-open-flow's samples/analyses and samples/relations, and the toolkit's own samples, were laid out for the shorter cards and overlap at brief; the layout session (TKT-286) relays them out, and the app lays out an overlapping flow afresh when it opens it.
