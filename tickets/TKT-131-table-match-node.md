---
id: TKT-131
title: table.match: match two tables by key and report matched, only-in-a, and only-in-b rows with counts
status: open
depends_on: [TKT-99]
owner:
fence: []
workflow: [W2]
---

## Acceptance criteria

- [ ] Outputs matched, onlyA, onlyB, and a one-row summary (Matched, OnlyInA, OnlyInB)
- [ ] Duplicate keys follow the rule TKT-99 settles, and are warned about
- [ ] nb-s07-own-data-join and nrc-join-analytics replace their join, anti-joins, and count-subquery rel.sql with it, answers unchanged

Source: node review of 2026-09-29. Reporting what did not match is PROJECT.md principle 3 (honest absence); today it takes four nodes and a SQL string.
