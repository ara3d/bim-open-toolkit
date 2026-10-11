---
id: TKT-229
title: bim.paramCoverage must not count empty or placeholder values as filled
status: open
depends_on: []
owner:
fence: [src/flow/BimOpenFlow.Nodes.BimAnalysis/BimParamCoverageNode.cs, tests/flow/BimOpenFlow.Nodes.BimAnalysis.Tests/**]
workflow: [W3]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] A parameter whose value is an empty or whitespace string is counted as empty
- [ ] A value equal to the parameter's own name (SerialNumber = 'SerialNumber', 211 Duplex elements) is counted as a placeholder, not filled; the output shows the placeholder count as its own column
- [ ] A test covers a filled, an empty, a placeholder, and a missing value

Found building viz-parameter-completeness (docs/plans/viz-demos.md). bim.paramCoverage counts a parameter as filled when a row exists, so empty strings and placeholder values equal to the parameter's name count as filled and the coverage chart overstates completeness.
