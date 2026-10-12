---
id: TKT-239
title: A table with a list column cannot be hashed, so any table node over it fails with 'Table column type List`1 is not hashable'
status: open
depends_on: []
owner:
fence: [deps/ara3d-dataflow/src/Ara3D.DataFlowEngine/ValueHash.cs]
workflow: [W2]
related: [TKT-134]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] ValueHash hashes a list column (element type and values, in order) or the reader turns it into a declared Text form, decided and documented in the format spec
- [ ] duck.table over the Snowdon door table (nominal_width_evidence) evaluates Ok

ValueHash.cs throws ArgumentException for a column whose .NET type is List<T>. The bim-flow schema guide says table.* nodes cannot take list columns, so this is known but undocumented in the engine spec, and it blocks reading whole tables from the Snowdon export. Found in declared-schemas wave A.
