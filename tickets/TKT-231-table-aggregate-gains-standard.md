---
id: TKT-231
title: table.aggregate gains standard deviation; the expression language gains sqrt and log
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/**]
workflow: [W3]
related: [TKT-133]
created: 2026-10-11
---

## Acceptance criteria

- [ ] table.aggregate accepts stddev(column) (sample) and matches DuckDB's stddev_samp
- [ ] Expressions in table.derive and table.filter accept sqrt(x), ln(x) and log10(x); a negative argument gives null, not NaN
- [ ] viz-element-size-outliers computes its median with the median aggregate of TKT-133 and its z-score with stddev, without table.window + filter + join

Found building viz-element-size-outliers (docs/plans/viz-demos.md). TKT-133 already asks for median and countDistinct; this ticket adds what it leaves out (stddev, sqrt, log). Today the graph computes a median with table.window, a filter and a join. Fence is in the deps/bim-open-flow repository; a commit there carries the same Ticket trailer.
