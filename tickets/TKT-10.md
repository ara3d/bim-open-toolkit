---
id: TKT-10
title: Node state badges that name the upstream cause, and a Run-to-see-results hint
status: claimed
depends_on: []
owner: small-job-builder
fence: [bimopenflow/web/packages/app/**, bimopenflow/web/packages/state/**, bimopenflow/web/packages/panes/**]
---

## Acceptance criteria

- [ ] Every node on the canvas shows its evaluation state (Ok, Unready, EffectPending, Unavailable, Error) and the badge updates from the SSE evaluation stream without a reload
- [ ] An Error or Unready badge names the upstream node responsible, in the badge's tooltip or inline
- [ ] An EffectPending node reads 'Run to see results'; an unset required parameter reads as needs-setup, not as an error
- [ ] A browser test covers the three states over a seeded graph

Serves W2 and W3. The most repeated UX ask across docs/ARCHITECTURE.md ('Failure is a state'), docs/proposals/live-param-suggestions.md section 5, docs/platoflow/README.md item 6, and NOTES.md sandbox UI wave. Autosave and the SSE stream it needs are built.
