---
id: TKT-298
title: The display nodes declare their output schemas, and the unknown-schema ratchet goes back down
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/src/flow/BimOpenFlow.Nodes.Viz/**, deps/bim-open-flow/src/flow/BimOpenFlow.Nodes.Tables/**, tests/studio/BimOpenFlow.SampleFlows.Tests/inferred-schema-unknown.ratchet, deps.json]
workflow: [W2]
related: [TKT-297]
confidence: medium
created: 2026-10-13
---

## Acceptance criteria

- [ ] view.table, chart.bar (table and legend), rel.materialize, and spatial.intersects declare the schema of their Table outputs (pass-through of the input where that is what they do), so InferredSchemaTests lists them as matched
- [ ] inferred-schema-unknown.ratchet is lowered to the new count, at or below the 323 it held before TKT-297

On 2026-10-13 the SampleFlows ratchet test (UnknownTableOutputsAreListedAndRatcheted) failed in CI at 362 unknown Table outputs against a ratchet of 323: TKT-297's five viz-analyses graphs added view.table and chart.bar outputs, and 339 of the 362 are 'a node declares no schema', almost all on those display nodes. The ratchet was raised to 362 in TKT-290 so CI could go green after the Platonic restore fix; the test's own message says to declare the schema rather than raise, which is this ticket.
