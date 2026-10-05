---
id: TKT-17
title: Agent edits arrive selected, undoable, and as a reviewable diff
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/graph/**, bimopenflow/web/packages/app/**, bimopenflow/web/packages/state/**, src/studio/BimOpenFlow.Ask/**]
workflow: [W2]
---

## Acceptance criteria

- [ ] A graph the Ask box or an MCP client changes appears in the open editor without a reload, with the changed nodes selected
- [ ] One undo step reverts the whole agent edit batch
- [ ] The editor shows what the agent added, removed, or reparameterised as a list the person can accept or reject

Serves W2. docs/graph-module-layering.md 'Why', docs/proposals/bimopenflow-ux-proposal.md section 4 item 11 (ghost nodes, topology diff, P2), and docs/platoflow/platoflow-agent-concepts.md section 0 (edits arrive selected, undoable, animated into view). Today an Ask-built graph opens in the editor, but one built from Claude Code over MCP needs a reload, and neither arrives selected or reverts in one undo step.

Note (TKT-94, 2026-09-28): the canvas lives in `bimopenflow/web/packages/graph` now (ghost nodes, selection of an agent's edit, and a topology diff are canvas work there); `app` keeps the chrome that reviews the diff.
