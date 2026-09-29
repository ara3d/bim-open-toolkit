---
id: TKT-122
title: Node catalog pack headers show a disclosure triangle
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/app/src/sidebar.ts, bimopenflow/web/packages/app/test/sidebar.test.ts]
---

## Acceptance criteria

- [ ] Each pack header in the Nodes tab shows ▸ before the pack name when closed and ▾ when open, matching the Ask panel's toggle
- [ ] The triangle follows the header's aria-expanded state, including packs opened by typing in the filter
- [ ] Headers show a pointer cursor and a hover tint, so they read as clickable
- [ ] App unit tests pass, with a test for the triangle in both states; gates/web-smoke.mjs passes

Owner's suggestion of 2026-09-28: pack headers (BEAST, BIM, BOS…) expand on click, but show only a name and a count, so nothing says they can be opened. styles.ts is in TKT-120's fence while that ticket is being built, so the triangle and hover rule stay in sidebar.ts. Serves W2.
