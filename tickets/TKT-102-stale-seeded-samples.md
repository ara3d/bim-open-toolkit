---
id: TKT-102
title: The studio store picks up changed sample flows instead of keeping a stale copy
status: open
depends_on: []
owner:
fence: []
---

## Acceptance criteria

- [ ] After a sample flow changes in samples/, restarting the studio shows the new version unless the user edited their copy
- [ ] A copy the user edited is never overwritten silently

Found 2026-09-28: the bim store held an old bim-level-summary (elements, byLevel, levels; no chart) while samples/bim-analyses/bim-level-summary.json has a chart and a note. `scripts/start-bim-flow.mjs` seeding never re-copies a flow that already exists, so every sample fixed in TKT-93 may be stale in existing stores.
