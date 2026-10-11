---
id: TKT-134
title: table.project accepts 'column as alias', so selecting and renaming is one node
status: open
depends_on: []
owner:
fence: []
workflow: [W2]
related: [TKT-208]
---

## Acceptance criteria

- [ ] table.project and rel.select accept 'nominal_width as Width_m' terms; a plain name keeps its name
- [ ] The select-and-rename duck.query nodes in samples/duckdb-analyses/workflows.json (about 12) become duck.read plus table.project, every node green and row counts unchanged

Source: node review of 2026-09-29. Most Snowdon duck.query nodes are only SELECT col AS Alias FROM table.

Note 2026-10-11: TKT-208 writes `table.project`'s schema inference rule; land this ticket before or with it so the rule covers aliases.
