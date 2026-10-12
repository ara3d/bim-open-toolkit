---
id: TKT-206
title: A column vocabulary: one registry of column kinds with type, unit, meaning and role, shared by the packs, the views and the writers
status: done
depends_on: [TKT-182]
owner:
fence: []
workflow: [W2]
related: [TKT-182]
created: 2026-10-11
closed: 2026-10-11
---

## Acceptance criteria

- [ ] A `ColumnKind` registry in `Ara3D.BimOpenSchema.ObjectModel` (bim-open-data): for each kind a name, a scalar type (Boolean, Integer, Number, Text, Date, Timestamp), an optional unit, a one-line meaning, and a role (`Key`, `Label`, `Category`, `Measure`, `Reference`); the first set covers every name in the toolkit's `BimColumns.cs`, the BOS DuckDB views (`EntityText`, `ParameterText`, `RelationText`, `StoreyOfEntity`, `StoreyOfElement`), and TKT-182's issue and verdict columns
- [ ] `BimColumns.cs` (this repository), `VerdictSchema.cs` and `VerdictTables.cs` (bim-open-flow) and the BCF writer (bim-open-data) read their names from the registry instead of declaring their own strings; TKT-182's casing decision (PascalCase) is applied
- [ ] The registry is exported as JSON by one command and committed as `docs/columns.json`, with `docs/columns.md` generated beside it, so the editor, the static site and Claude's skill guides read one list
- [ ] A test fails when a node pack produces a column whose name matches a registered kind with a different type

Source: `docs/plans/declared-schemas.md`. A column kind is the "property" of the owner's class analogy: a table type is a class, its columns are properties with a name and a type, and the meaning lives in one place.
