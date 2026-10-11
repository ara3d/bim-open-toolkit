---
id: TKT-202
title: duck.table and duck.tables take a source input, and the source wire carries a Database value instead of a path string
status: done
depends_on: []
owner:
fence: [deps/ara3d-dataflow/src/Ara3D.DataFlowEngine.Abstractions/**, deps/bim-open-flow/src/flow/BimOpenFlow.Nodes.DuckDb/**, deps/bim-open-flow/src/flow/BimOpenFlow.Host.Api/RunInputs.cs]
workflow: [W2]
related: [TKT-138]
created: 2026-10-11
closed: 2026-10-11
---

## Acceptance criteria

- [ ] `ValueKind.Database` and `PortType.Database` exist in ara3d-dataflow with a `DatabaseValue(string Path, string Hash)` record: identity is the file's content hash, so caching and run replay see a changed file; the format spec and README name the new kind
- [ ] `duck.source` emits a Database value, not Text; `duck.query`, `duck.table` and `duck.tables` accept an optional `source` input of that type and use it when wired, falling back to their `path` parameter when not; wiring both is a warning naming the one used
- [ ] The run record pins a Database value by its hash the same way it pins a FilePath parameter (`RunInputs.cs`)
- [ ] A pane shows a Database value as its table list (the same rows `duck.tables` produces)
- [ ] The `tables in the file at path` suggestion of `duck.table` resolves from the wired source when one is connected
- [ ] `docs/nodes.md` and the catalog regenerate; one sample graph with two `duck.table` nodes on one path uses one `duck.source`
- [ ] Pins move in bim-open-flow's and the toolkit's `deps.json`

Source: the owner's design discussion of 2026-10-11 on the Schependomlaan storeys graph, whose two `duck.table` nodes repeat one path. The `source` wire today is the path as Text, which is the scalar wire TKT-138 rejected. A Database value is a resource handle: few, named, hashed and pinned, which is a different thing from a scalar. PROJECT.md principle 5 needs a line admitting resources beside tables; propose the wording in the commit message and leave the brief to the owner.
