---
id: TKT-277
title: Chip is the only node card style: make it the default and remove classic, banner and bar with their selector
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/bimopenflow/web/packages/graph/src/**, deps/bim-open-flow/bimopenflow/web/packages/graph/test/**, deps/bim-open-flow/bimopenflow/web/packages/app/src/**, deps/bim-open-flow/bimopenflow/web/packages/app/test/**, bimopenflow/web/packages/studio-web/src/**]
workflow: [W2]
created: 2026-10-11
---

## Acceptance criteria

- [ ] Node cards draw in the chip style everywhere, with no selector in the top bar and no stored preference; the classic, banner and bar branches in nodeRender.ts and nodeStyleNames are deleted, with their tests
- [ ] A saved preference naming another style is ignored, not an error
- [ ] The studio and classic looks (the other selector) still work

Owner's request 2026-10-11 after looking at the bim profile editor: the chip style is the one to keep; the others add a choice nobody needs. TKT-98 added the switcher; this removes it. nodeStyle.ts lists classic, banner, chip, bar; nodeRender.ts has a branch per style.
