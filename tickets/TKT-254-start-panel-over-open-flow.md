---
id: TKT-254
title: The root URL opens the alphabetically first flow and the Start panel at once, and the panel leads with templates the profile cannot run
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/bimopenflow/web/packages/app/src/**, deps/bim-open-flow/bimopenflow/web/packages/app/test/**, bimopenflow/web/packages/studio-web/src/**]
workflow: [W2]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] Opening the root URL with a non-empty store shows either the first flow or the Start panel, never both; which one is a documented choice
- [ ] The Start panel lists the flows this host profile seeded before the templates it cannot run, and the not-seeded templates are collapsed under one heading
- [ ] The flow the root URL opens is a documented choice (the last opened, or a named default), not the alphabetically first id

Seen 2026-10-11 on the bim profile: http://localhost:5300/ opened bfast-buffers (the first id alphabetically, which was red) and at the same time opened the Start from a flow panel over the canvas, whose first group, Tables, is five templates all greyed as not seeded in this host profile. A visitor's first impression is a red graph behind a list of things they cannot open.
