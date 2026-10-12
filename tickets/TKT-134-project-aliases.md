---
id: TKT-134
title: table.project accepts 'column as alias', so selecting and renaming is one node
status: done
depends_on: []
owner:
fence: []
workflow: [W2]
related: [TKT-208]
closed: 2026-10-11
---

## Acceptance criteria

- [x] table.project and rel.select accept 'nominal_width as Width_m' terms; a plain name keeps its name
- [moved to TKT-238] The select-and-rename duck.query nodes in samples/duckdb-analyses/workflows.json (about 12) become duck.read plus table.project, every node green and row counts unchanged

Source: node review of 2026-09-29. Most Snowdon duck.query nodes are only SELECT col AS Alias FROM table.

Note 2026-10-11: TKT-208 writes `table.project`'s schema inference rule; land this ticket before or with it so the rule covers aliases.

Note 2026-10-11 (declared-schemas wave A, A4): criterion 1 is bim-open-flow `f0a36af` (one `Projection` parser in `Relations/Plan/Projection.cs` serves `rel.select` and `table.project`). Criterion 2 failed as written: `duck.table` loads whole tables, and the Snowdon door table's list columns cannot be hashed (TKT-239); the ticket's `duck.read` reads files. It moves to TKT-238, where `duck.table` gains a `columns` parameter of the same terms. Closed on that basis.
