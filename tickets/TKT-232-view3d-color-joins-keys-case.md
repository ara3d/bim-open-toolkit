---
id: TKT-232
title: view3d.color joins keys case-insensitively and view3d.instances names its key GlobalId
status: open
depends_on: []
owner:
fence: [src/flow/BimOpenFlow.Nodes.Geometry/**]
workflow: [W3]
created: 2026-10-11
---

## Acceptance criteria

- [ ] view3d.color matches a table key to an instance id ignoring case, and the output says how many rows matched
- [ ] view3d.instances names its key column GlobalId, as DuckDB tables do; saved graphs that use globalId still load
- [ ] A graph that colours instances by a DuckDB table needs no table.join to rename or recase the key

Found building the visualization demos (docs/plans/viz-demos.md). view3d.color joins case-sensitively and view3d.instances names its key globalId while DuckDB tables use GlobalId, so every colouring graph needs an extra table.join. Fix both ends so the key just works.
