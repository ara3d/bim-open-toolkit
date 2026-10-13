---
id: TKT-294
title: The public sample graphs open in the studio look with varied, coloured Vega-Lite charts that fit their pane
status: done
depends_on: []
owner:
fence: [deps/bim-open-flow/**, deps.json, docs/nodes.catalog.json, docs/nodes.md, samples/**, bimopenflow/web/package-lock.json]
workflow: [W1, W3]
related: [TKT-220, TKT-234, TKT-16]
confidence: high
created: 2026-10-12
closed: 2026-10-12
---

## Acceptance criteria

- [x] bim-open-flow's GitHub Pages site (site-web) mounts the editor in the studio look (studioChrome) with the studio canvas theme as the default; its New, Save, Run, flow picker, and connection status are hidden, and the answer pane sits above the canvas at full width as before
- [x] The chart pane (@bimopenflow/panes) renders chart.bar and chart.line through Vega-Lite with one theme object (fonts and the family palette), sized to its pane with a ResizeObserver, so no scrollbar appears when the chart fits
- [x] chart.bar declares layout (vertical, horizontal, stacked) and colorBy (auto, category, series, none) params; the catalog files in both repositories and the chart node tests cover them
- [x] The six samples/buildings graphs use at least three distinct chart layouts and show more than one colour; site/data/buildings.json is regenerated and SiteData_IsCurrent passes
- [x] gates/pages-smoke.mjs passes; the sample layout tests pass in both repositories; deps.json pins the pushed bim-open-flow commit

Asked by the owner on 2026-10-12 from a screenshot of the Schependomlaan room-names graph on the Pages site: the studio theme should be the default, the charts should use BIM Open Plot, vary more, and show more colours, and the chart pane showed two scrollbars it did not need.

Why Vega-Lite inside bim-open-flow rather than an import from bim-open-plot: plot's renderer and theme live in its demos package, and plot is layered above flow (its pack loads in the toolkit's bim profile), so flow cannot depend on it. The chart pane gets its own Vega-Lite spec builder and theme; the theme copies plot's family palette with the flow accent first. Folding the two theme objects into one is deferred: see the follow-up ticket filed at close.

## Close gates

2026-10-12, toolkit sample graphs: `npx vitest run test/sampleCards.test.ts test/sampleLayout.test.ts` in `bimopenflow/web/packages/studio-web` passed.

```
 RUN  v3.2.7 C:/Users/cdigg/git/bim-open-toolkit/bimopenflow/web/packages/studio-web
 ✓ test/sampleLayout.test.ts (2 tests) 3ms
 ✓ test/sampleCards.test.ts (5 tests) 6961ms
   ✓ no sample graph has overlapping node cards  993ms
   ✓ no text overflows its card > for every sample graph as shown and at least width  4177ms
   ✓ no text overflows its card > for every catalog kind with default and long values  1748ms
 Test Files  2 passed (2)
      Tests  7 passed (7)
   Start at  22:47:11
   Duration  17.56s (transform 5.17s, setup 0ms, collect 18.95s, tests 6.96s, environment 0ms, prepare 403ms)
```

2026-10-12, bim-open-flow sample graphs: `npx vitest run test/sampleLayout.test.ts test/sampleOverlap.test.ts test/textOverflow.test.ts` in `deps/bim-open-flow/bimopenflow/web/packages/graph` passed.

```
 ✓ test/sampleOverlap.test.ts (3 tests) 576ms
 ✓ test/sampleLayout.test.ts (2 tests) 1410ms
   ✓ no sample graph has a layout or wiring fault  1047ms
   ✓ names a node moved by hand  354ms
 ✓ test/textOverflow.test.ts (6 tests) 3101ms
   ✓ no text overflows its card > with hidden descriptions, for every catalog kind with default and long values  1496ms
   ✓ no text overflows its card > with brief descriptions, for every catalog kind with default and long values  446ms
   ✓ no text overflows its card > with full descriptions, for every catalog kind with default and long values  532ms
 Test Files  3 passed (3)
      Tests  11 passed (11)
   Start at  22:47:36
   Duration  10.12s (transform 5.32s, setup 0ms, collect 16.03s, tests 5.09s, environment 0ms, prepare 323ms)
```

2026-10-12, bim-open-flow pin: `node scripts/check-pin.mjs bim-open-flow` in `.` passed.

```
bim-open-flow: pinned at 60fdfd2, pushed
```
