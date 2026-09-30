---
id: TKT-128
title: The expression language gets isnull(x) and x in ('a', 'b'), so a missing-value test no longer needs SQL
status: open
depends_on: []
owner:
fence: []
---

## Acceptance criteria

- [ ] isnull(x) returns true or false, never null, for every scalar type; x in ('a', 'b') returns null only when x is null
- [ ] table.filter, table.derive, rel.filter, and rel.derive accept both; the rel.* SQL translation emits IS NULL and IN
- [ ] Tests cover null, an empty list, mixed literal types, and a type error for a list item that is not a literal
- [ ] node-guide.md no longer sends agents to SQL for null tests

Source: node review of 2026-09-29. node-guide.md line 3 sends every missing-value test to SQL because null propagates through ==. The 14-class Category IN lists in the three nb-s09-ids-check graphs are the other main use. Follow the toNumber builtin (ara3d-dataflow e029371).
