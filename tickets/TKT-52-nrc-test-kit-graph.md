---
id: TKT-52
title: NRC test kit as a graph: bring any IFC and CSV, get a match report, colours, and storey totals
status: open
depends_on: []
owner:
fence: [samples/nrc-analyses/nrc-join-analytics.json, samples/nrc/test-kit/**, tests/flow/BimOpenFlow.NrcWorkflows.Tests/JoinAnalyticsTests.cs]
---

## Acceptance criteria

- [ ] Graph nrc-join-analytics joins a CSV to a model on a key column (default GlobalId), reports CSV rows with no element and physical elements with no row, colours by a numeric and a text column, and gives per-storey totals and means
- [ ] Run on IFC-Test-Kit/analytics_dataset_with_levels.csv (268 rows) against duplex-base.ifc; the match report's counts are asserted in a test and explained in samples/nrc/test-kit/README.md

P5 of Proposal: docs/proposals/nrc-deliverables.md, test kit steps 1 to 5. Step 6 (large_test_model.ifc) moved to the performance ticket.
