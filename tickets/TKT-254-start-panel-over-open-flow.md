---
id: TKT-254
title: The root URL opens the alphabetically first flow and the Start panel at once, and the panel leads with templates the profile cannot run
status: done
depends_on: []
owner: builder-TKT-254
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [deps/bim-open-flow/bimopenflow/web/packages/app/src/**, deps/bim-open-flow/bimopenflow/web/packages/app/test/**, bimopenflow/web/packages/studio-web/src/**]
workflow: [W2]
created: 2026-10-11
claimed: 2026-10-11
closed: 2026-10-11
kind: defect
---

## Acceptance criteria

- [x] Opening the root URL with a non-empty store shows either the first flow or the Start panel, never both; which one is a documented choice
- [x] The Start panel lists the flows this host profile seeded before the templates it cannot run, and the not-seeded templates are collapsed under one heading
- [x] The flow the root URL opens is a documented choice (the last opened, or a named default), not the alphabetically first id

Seen 2026-10-11 on the bim profile: http://localhost:5300/ opened bfast-buffers (the first id alphabetically, which was red) and at the same time opened the Start from a flow panel over the canvas, whose first group, Tables, is five templates all greyed as not seeded in this host profile. A visitor's first impression is a red graph behind a list of things they cannot open.

## Resolution

bim-open-flow 43001e4. The choice, documented in `chooseInitialAnalysis` (app/src/analysisParam.ts) and the boot comment in app.ts: the flow `?analysis=` names; else the flow last opened on this origin (localStorage key `bof-app-last-flow`, app/src/lastFlow.ts, kept by the editor pages through `rememberFlow`); else the Start panel over a blank flow. Never both, never `ids[0]`. The panel lists the seeded groups after the Blank card and puts the unseeded templates in one collapsed `<details>`, "Not in this host profile (N)". Tests: app/test/appBoot.test.ts, startPage.test.ts, templates.test.ts, analysisParam.test.ts.
