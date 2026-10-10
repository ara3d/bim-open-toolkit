---
id: TKT-181
title: Writer nodes for GLB, USD and BCF that wait for Run, and a reader node for .frag
status: open
depends_on: []
owner:
fence: [src/flow/BimOpenFlow.Nodes.*/**, tests/**, docs/nodes.md, docs/nodes.catalog.json]
workflow: [W3]
related: [TKT-170, TKT-171, TKT-172, TKT-173]
created: 2026-10-10
---

## Acceptance criteria

- [ ] Each writer is pending until Run (principle 2), then writes the file and names it in the run record with its content hash (principle 4)
- [ ] A sample graph ends in a .glb, a .usda and a .bcf from the Duplex; the catalog and docs/nodes.md are regenerated

Found in the BOS formats wave (docs/plans/bos-formats.md, Architecture notes). The formats are library calls and MCP tools but not nodes. The libraries take IBimData, IDataTable, Stream or TextWriter and return summaries; add a shared export result (path, bytes, hash) so the MCP tools and the nodes do not each copy the read-BOS and output-folder steps.
