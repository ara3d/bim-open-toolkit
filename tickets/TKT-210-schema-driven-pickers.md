---
id: TKT-210
title: Pickers and proposals from declared schemas: columns before data, join keys, numeric chart values, an aggregate builder
status: done
depends_on: [TKT-209]
owner:
fence: []
workflow: [W2]
related: [TKT-205, TKT-23, TKT-203]
created: 2026-10-11
closed: 2026-10-12
---

## Acceptance criteria

- [x] `ColumnsOfInput` suggestions resolve from the inferred schema (TKT-209) first and from recorded columns second, so a freshly wired node offers its columns before any run; each entry shows the type and, for a registered kind, the meaning
- [x] `table.join` proposes its keys: the columns both sides share that carry the `Key` role (EntityIndex, GlobalId) come first
- [x] `chart.*` value-column pickers list only numeric columns; the label picker lists `Label` and `Category` columns first; `view3d.*` selector pickers list `Key` columns
- [x] `table.aggregate`'s aggregate editor builds `func(column) as name` from pickers (function, column, name) instead of one free-text field, and offers only functions the column's type allows
- [x] A Text parameter that the catalog marks as a comma-separated list (the flag from TKT-203) uses the multi-pick control; `isMultiColumn` in `suggestText.ts` stops guessing from the name

Source: `docs/plans/declared-schemas.md`. This is the "no blank text" criterion for the generic nodes; TKT-205 built the control, TKT-23 lists the controls still wanted.
