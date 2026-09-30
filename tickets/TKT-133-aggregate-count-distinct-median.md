---
id: TKT-133
title: table.aggregate and rel.aggregate gain countDistinct and median
status: open
depends_on: []
owner:
fence: []
---

## Acceptance criteria

- [ ] countDistinct(column) and median(column) parse in both packs and match DuckDB's results
- [ ] The perSpace rel.sql in nb-s08-thermal-zones-eui becomes rel.aggregate

Source: node review of 2026-09-29.
