---
id: TKT-207
title: Nodes declare their output schemas: Column, ColumnType and Schema move into the engine, and NodeSpec carries a static, inferred or dynamic schema per table output
status: done
depends_on: []
owner:
fence: []
workflow: [W2]
related: [TKT-203, TKT-206]
created: 2026-10-11
closed: 2026-10-11
---

## Acceptance criteria

- [x] `Column`, `ColumnType` and `Schema` move from `BimOpenFlow.Relations` into `Ara3D.DataFlowEngine.Abstractions` (ara3d-dataflow), unchanged in shape, and the relation layer uses them from there; `ColumnType` keeps its closed vocabulary
- [x] `NodeSpec` gains `Schemas: IReadOnlyList<SchemaSpec>`, one per Table or Relation output, where `SchemaSpec` is `Static(Schema)`, `Inferred` (the node implements `ISchemaNode.Infer(inputSchemas, parameters, ISchemaCatalog)` and returns a `SchemaResult`), or `Dynamic` (the shape depends on the data, as `table.pivot` and `table.transpose` do; stated, not guessed, per PROJECT.md principle 3)
- [x] The format spec and the engine README describe the member; `contracts.json`, the generated TypeScript and C# contracts, the catalog, `docs/nodes.md` (a Columns table per static output) and MCP `getNodeCatalog` carry it; an old client that does not know the member keeps working
- [x] A static schema may name a `ColumnKind` from TKT-206 instead of spelling a type; the docs generator prints the kind's meaning beside the column

Source: `docs/plans/declared-schemas.md`. Land this with TKT-203's contract change, in its own commits, since both touch `NodeSpec`, `contracts.json` and the catalog.
