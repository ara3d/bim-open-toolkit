---
id: TKT-109
title: The notebook column is 50% wider by default
status: done
depends_on: []
owner: claude
fence: [bimopenflow/web/packages/bim-open-notebook/src/page/styles.ts, bimopenflow/web/packages/bim-open-notebook/src/page/shellStyles.ts]
---

## Acceptance criteria

- [ ] The notebook's reading column (.nb-column) is 1140 px wide at most, up from 760 px, and the error banner in shellStyles.ts keeps the same width as the column
- [ ] At a narrow window the column still shrinks to the window with its 16 px gutters, with no horizontal scroll

Requested by the owner 2026-09-28: the default notebook width should be about 50% wider. The width lives in one place per stylesheet today (styles.ts .nb-column, shellStyles.ts error banner). Runs alongside TKT-108 (graph embeds fit the cell), which verifies its fit against the column width.
