---
id: TKT-135
title: table.concat takes more than two inputs and an optional label column naming each row's source
status: open
depends_on: []
owner:
fence: []
---

## Acceptance criteria

- [ ] Up to four inputs (a..d); a 'label' param adds a column whose value per input comes from 'labels' (comma-separated)
- [ ] rel.concat exists with the same parameters
- [ ] baseTagged, enrichedTagged, and answer in nb-s09-ids-check-base-vs-enriched collapse into one node; the UNION ALL rel.sql nodes (allRows, rows, rollupRows, nrc-rollup answer, monthly-spend-sql) use rel.concat plus rel.sort

Source: node review of 2026-09-29. The variadic concat is also listed in docs/CANDIDATE-WORK.md under expression and table gaps.
