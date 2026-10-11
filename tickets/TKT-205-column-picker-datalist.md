---
id: TKT-205
title: The column picker shows one entry when the field already holds a column name
status: done
depends_on: []
owner:
fence: [deps/bim-open-flow/bimopenflow/web/packages/graph/src/{suggestInput, suggestText, columnSelect}.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/test/**]
workflow: [W2]
related: [TKT-23]
created: 2026-10-11
closed: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] A column parameter with `ColumnsOfInput` suggestions opens a list of every upstream column on focus, each with its type, whatever text the field already holds
- [ ] For a comma-separated column parameter (`groupBy`, `columns`), the list toggles columns in and out of the value; the text stays editable
- [ ] The native datalist path in `suggestInput.ts` is used only for parameters that have no better control
- [ ] A test in the graph package shows the list with every column when the value already names one of them

Source: the owner's question of 2026-10-11 on the public Schependomlaan storeys page: the Group By pull-down showed only "Category". The host and the static API both return every column of the joined table; the browser filters a `<datalist>` by the text already in the box, so a field that holds "Category" shows one entry. The option-row control in `canvasControls.ts` is the precedent.
