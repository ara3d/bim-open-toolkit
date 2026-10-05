---
id: TKT-88
title: Charts in the notebook take part in selection and redraw their whole table
status: open
depends_on: [TKT-80]
owner:
fence: [bimopenflow/web/packages/panes/src/chartPane.ts, bim-open-notebook:bimopenflow/web/packages/bim-open-notebook/src/**]
workflow: [W3]
---

## Acceptance criteria

- [ ] Clicking a bar selects its rows in the other embeds, and a selection highlights bars
- [ ] A chart whose table grew redraws every bar after Re-evaluate

From docs/plans/notebook.md, Debt: charts outside shared selection; a chart re-read keeps only the snapshot's row count. panes/** is TKT-16's fence.
