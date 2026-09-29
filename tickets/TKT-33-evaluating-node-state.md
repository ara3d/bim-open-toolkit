---
id: TKT-33
title: An Evaluating node state from the host, so wires show flow while a node computes
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/contracts/**, bimopenflow/web/packages/state/**, bimopenflow/web/packages/app/src/canvasParts.ts, bimopenflow/web/packages/app/src/viewModel.ts, bimopenflow/web/packages/app/test/**, src/flow/BimOpenFlow.Host.Api/**, src/flow/BimOpenFlow.Host/**]
---

## Acceptance criteria

- [ ] The host's evaluation stream reports when a node's evaluation starts and when it ends, as a per-node in-flight flag or an Evaluating status in the contracts, with the node's terminal status following
- [ ] The state package's sync applies it and CanvasNode exposes it; the wire flow animation from TKT-24 runs on the wires into a computing node and settles on Ok or an error state
- [ ] A test drives a start then an end event and asserts the flowing set before and after

TKT-24 built the selection path animation and found no signal for 'computing now'. Serves W2 and W3 (the owner asked to see the current flow). Coordinate with TKT-26, whose plan also touches contracts and the host stream.
