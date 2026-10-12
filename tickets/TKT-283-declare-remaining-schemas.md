---
id: TKT-283
title: Declare output schemas for the nodes the schema pass still reports as unknown: view.table, chart.*, view.colormap, view3d.*, spatial.*, rel.*
status: open
depends_on: []
owner:
fence: []
workflow: [W2]
related: [TKT-208, TKT-209, TKT-241]
created: 2026-10-12
---

## Acceptance criteria

- [ ] view.table, chart.bar, chart.line and view.colormap declare Inferred schemas (most pass their input through) and spatial.* declare theirs
- [ ] rel.* nodes declare Inferred Relation schemas through the relation layer's SchemaInference, so the 198 Relation outputs in the sample graphs are known
- [ ] view3d.* declare schemas once TKT-241 settles their column casing
- [ ] The toolkit's inferred-schema-unknown.ratchet (323 at 2026-10-12) drops by the outputs these declare, and the Relation outputs join the ratchet
- [ ] `check.rule` and `check.union` (bim-open-flow `Nodes.Compliance`) declare their verdict schemas from `IssueColumns`, and leave `NotCovered` in the toolkit's `DeclaredSchemaTests.cs`; skipped in wave B because another session held their files

From the declared-schemas wave C1 golden test over 86 sample graphs: 245 Table outputs match their recorded columns; 323 are unknown, 309 of them outputs of nodes that declare no schema (chart.bar 120, view.table 104, view3d.* about 190, spatial.intersects 62, view.colormap 28, rel.materialize 26) and 14 downstream of table.pivot (Dynamic, honest); 198 Relation outputs are unknown because rel.* declare no SchemaSpec. Also: an invalid document or a cycle gives an empty schema list with no reason; give it one.
