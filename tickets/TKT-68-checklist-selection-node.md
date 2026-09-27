---
id: TKT-68
title: Build the checklist selection node (select.checklist)
status: open
depends_on: []
owner:
fence: []
---

## Acceptance criteria

- [ ] A node shows a checkbox list of the distinct values of a column (types, levels) with counts, and stores the excluded set
- [ ] `PocCoverageTests.cs:45` no longer marks it a gap

The prototype's most valued node (`docs/platoflow/README.md:32`); BimOpenFlow has nothing like it. TKT-23's per-parameter controls do not cover it. Raised by reviews/2026-09-27-status.md
