---
id: TKT-204
title: Graph inputs: promote a source to a graph input so swapping the model is one gesture
status: done
depends_on: []
owner:
fence: []
workflow: [W1, W2]
related: [TKT-138, TKT-73]
created: 2026-10-11
closed: 2026-10-11
---

## Acceptance criteria

- [ ] A graph document can declare graph inputs: a name, a parameter kind, a default; a bindable parameter or a source node's path can be bound to a graph input
- [ ] One gesture on a source promotes it to a graph input; the sources rail shows graph inputs first, marked as such
- [ ] MCP `evaluate` and `createRun` accept values for graph inputs; a run record names each graph input and its pinned value
- [ ] Swapping the model of a sample graph (Schependomlaan to another public sample) is one `setParam` on the graph input, and every reader re-evaluates
- [ ] The notebook's snapshot records the graph input values, so a published page says which model a result came from

Source: the owner's design discussion of 2026-10-11. The payoff of one source per graph is "run this on my building" as one change, which serves workflow 1 (the user points Claude at their own file) and workflow 2 (Claude re-runs a saved graph).
