---
id: TKT-63
title: Bound the materialization cache by memory, not by entry count
status: open
depends_on: []
owner:
fence: []
---

## Acceptance criteria

- [ ] `ResultCache` evicts by an estimated byte size with a configurable limit
- [ ] A test fills the cache past the limit with large tables and shows eviction

`docs/proposals/table-graph-migration.md:186` leaves this open. The cache holds 64 results of any size (97694d4), so a few large intermediates can exhaust memory. Raised by reviews/2026-09-27-status.md
