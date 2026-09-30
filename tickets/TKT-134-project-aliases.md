---
id: TKT-134
title: table.project accepts 'column as alias', so selecting and renaming is one node
status: open
depends_on: []
owner:
fence: []
---

## Acceptance criteria

- [ ] table.project and rel.select accept 'nominal_width as Width_m' terms; a plain name keeps its name
- [ ] The select-and-rename duck.query nodes in samples/duckdb-analyses/workflows.json (about 12) become duck.read plus table.project, every node green and row counts unchanged

Source: node review of 2026-09-29. Most Snowdon duck.query nodes are only SELECT col AS Alias FROM table.
