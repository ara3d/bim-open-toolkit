---
id: TKT-48
title: NRC analytics contract: a metric dictionary, summary sets under their own names, and totals computed by a graph
status: open
depends_on: []
owner:
fence: [samples/nrc/*, samples/nrc-analyses/nrc-rollup.json, samples/nrc-analyses/nrc-element-psets.json, samples/nrc-analyses/nrc-enrich-run.json, samples/nrc-analyses/nrc-property-values.json, samples/nrc-analyses/README.md, src/data/Ara3D.BimOpenSchema.DuckDb/BosDuckDbViews.cs, src/mcp/BimOpenMcp.Ifc/**, .claude/skills/ifc-ask/**, tests/flow/BimOpenFlow.NrcWorkflows.Tests/RollupGraphTests.cs, tests/flow/BimOpenFlow.NrcWorkflows.Tests/FigureGraphTests.cs, tests/flow/BimOpenFlow.NrcWorkflows.Tests/ModelGraphTests.cs, tests/flow/BimOpenFlow.NrcWorkflows.Tests/CsvGraphTests.cs, tests/flow/BimOpenFlow.NrcWorkflows.Tests/Fixture.cs, tests/flow/BimOpenFlow.NrcWorkflows.Tests/NrcPaths.cs, tests/flow/BimOpenFlow.NrcWorkflows.Tests/README.md, tests/mcp/BimOpenMcp.Ifc.Tests/**, scripts/demo-ifc-mcp.mjs, docs/nrc-walkthrough.md]
---

## Acceptance criteria

- [ ] samples/nrc/nrc-metrics.csv is the one metric dictionary; graphs nrc-element-psets and nrc-rollup derive every property-set row from it, the element CSV, nrc-run.csv, and the model's StoreyOfElement view; nrc-enrich-run writes them into samples/nrc/duplex-base.ifc
- [ ] Element-level rows equal today's psets_to_write.csv element rows; storey and building totals match nrc_analytics_storeys.csv to the decimal, but are written as Pset_NRCStoreySummary and Pset_NRCBuildingSummary with Total/Mean property names
- [ ] The regenerated samples/nrc/duplex-enriched.ifc has no Pset_NRC element set on any IfcBuildingStorey or IfcBuilding; a test sums OperationalCarbon_kgCO2e_per_year over every entity carrying it with no class filter and gets 37196.2; a test asserts the committed file equals a fresh Run's output byte for byte
- [ ] The IFC MCP server exposes the dictionary as a MetricCatalog view and the ifc-ask skill resolves metrics through it; StoreyOfElement is defined once, in BosDuckDbViews

P1 of Proposal: docs/proposals/nrc-deliverables.md. Serves W6 and W2. Fixes the storage defect in nrc-ifc-llm paper/poc-gap-report.md 2.10 (three of four unattended misses). Synthetic data only; NRC has sent nothing.
