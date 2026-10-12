---
id: TKT-256
title: Below about 900 px the editor's right column is clipped: the Ask box, the Answer line, and the pane tabs are cut off
status: done
depends_on: []
owner: builder-TKT-256
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [bimopenflow/web/packages/studio-web/src/**, deps/bim-open-flow/bimopenflow/web/packages/app/src/**]
workflow: [W2]
created: 2026-10-11
claimed: 2026-10-11
closed: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] At a 650 px wide viewport the Ask box, the Answer line, and the Table and Chart tabs are fully visible, by wrapping or by collapsing the right column behind a toggle
- [ ] No horizontal page scroll at 650 px

Seen 2026-10-11 in the desktop app's browser pane (652 px wide): the right column is cut at the pane edge, so the Ask box shows as 'Ask C', the Answer line as 'Answer: v' and 'Unavailal', and the Inspector tab is off screen. The pane is how the owner demos the editor beside a Claude session, so this width matters.
