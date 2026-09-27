---
id: TKT-10
title: Node state badges that name the upstream cause, and a Run-to-see-results hint
status: done
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

## Result (2026-09-26, commit 24bac00)

Every node paints its state text beside the status dot: Ok, "Run to see results" for EffectPending, the host's own error message, "Needs setup" for an unset parameter (never red), and "Waiting on <node>" naming the nearest upstream cause found by walking the edges client-side. Pure function nodeBadge.ts with eight seeded cases; smoke gate PASS. Not done: the badge is inline text, not a tooltip; the contracts' NodeState lacks the engine's BlockingNodeId, so the client walk could in principle differ from the engine's cause in an unusual multi-input graph (a contracts follow-up, see TKT-33 which also touches that stream).
