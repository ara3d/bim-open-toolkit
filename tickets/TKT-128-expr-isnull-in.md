---
id: TKT-128
title: The expression language gets isnull(x) and x in ('a', 'b'), so a missing-value test no longer needs SQL
status: done
depends_on: []
owner: claude
fence: []
---

## Acceptance criteria

- [x] isnull(x) returns true or false, never null, for every scalar type; x in ('a', 'b') returns null only when x is null
- [x] table.filter, table.derive, rel.filter, and rel.derive accept both; the rel.* SQL translation emits IS NULL and IN
- [x] Tests cover null, an empty list, mixed literal types, and a type error for a list item that is not a literal
- [x] node-guide.md no longer sends agents to SQL for null tests

Source: node review of 2026-09-29. node-guide.md line 3 sends every missing-value test to SQL because null propagates through ==. The 14-class Category IN lists in the three nb-s09-ids-check graphs are the other main use. Follow the toNumber builtin (ara3d-dataflow e029371).

## Done (2026-09-29)

ara3d-dataflow fb1f32c (engine, spec 0.3.0, conformance 016 to 019) and toolkit 1091be0 (SQL translation, canonical text, agent guide). A non-literal list item is a syntax error, not a type error: the parser rejects it before typing, which keeps the check in one place. `in` is now a keyword; `[in]` still names a column. The DuckDB test `MissingAndMembershipMatchTheEvaluator` checks that rel.filter and the in-memory evaluator keep the same rows around a null cell.

Not done here: rewriting sample graphs to use the new operators. The nb-s09-ids-check Category lists move when TKT-129 (bim.property) replaces those queries.
