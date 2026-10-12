---
id: TKT-277
title: Chip is the only node card style: make it the default and remove classic, banner and bar with their selector
status: done
depends_on: []
owner: builder-TKT-277
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [deps/bim-open-flow/bimopenflow/web/packages/graph/src/**, deps/bim-open-flow/bimopenflow/web/packages/graph/test/**, deps/bim-open-flow/bimopenflow/web/packages/app/src/**, deps/bim-open-flow/bimopenflow/web/packages/app/test/**, bimopenflow/web/packages/studio-web/src/**]
workflow: [W2]
created: 2026-10-11
claimed: 2026-10-12
closed: 2026-10-12
---

## Acceptance criteria

- [x] Node cards draw in the chip style everywhere, with no selector in the top bar and no stored preference; the classic, banner and bar branches in nodeRender.ts and nodeStyleNames are deleted, with their tests
- [x] A saved preference naming another style is ignored, not an error
- [x] The studio and classic looks (the other selector) still work

Owner's request 2026-10-11 after looking at the bim profile editor: the chip style is the one to keep; the others add a choice nobody needs. TKT-98 added the switcher; this removes it. nodeStyle.ts lists classic, banner, chip, bar; nodeRender.ts has a branch per style.

## Resolution

bim-open-flow 5bc239f. nodeStyle.ts, nodeStyleChoice.ts, both pickers, `ChromeActions.setNodeStyle` and `AppChrome.setNodeStyle` are gone; nodeRender.ts draws the chip layout only, with no footer, so `nodeFootprint` is the card plus its sockets. Nothing reads `bof-app-node-style` any more (app/test/nodeCardStyle.test.ts mounts both looks with "banner" stored). Left for the supervisor when the pin moves: bimopenflow/web/packages/studio-web/test/sampleCards.test.ts (outside this fence) imports `defaultNodeStyle`, `nodeStyleNames` and `setNodeStyle` from @bimopenflow/graph; drop the `afterAll` and the per-style loop and run its two overflow checks once. `nodeFootprint` keeps an unused optional measure because deps/bim-open-flow/bimopenflow/web/packages/graph/scripts/sampleGraphs.ts passes one; drop both together. Card widths (nodeSize.ts) are unchanged, so committed layouts keep their spacing.
