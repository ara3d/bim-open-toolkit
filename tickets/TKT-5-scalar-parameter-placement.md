---
id: TKT-5
title: Scalar parameters: inline on the canvas, in the params pane, or both?
status: done
depends_on: []
owner:
fence: []
kind: question
---

docs/proposals/bimopenflow-ux-proposal.md section 4 item 10 routes thresholds and other scalars to a params pane and a control strip on templates; NOTES.md 'Data-node-sets wave' records the user asking for inline controls on the canvas, which is what the web app built; the pane keeps Json, Expression, and ModelRef. Both exist, and a new node author does not know which to design for.

Default: inline on the canvas for scalars, the pane for long values, and a one-gesture promotion of a node parameter to a graph parameter (the template control strip). Decides the panes work in PROJECT.md workflow 3 and the template gallery.

## Decision (owner, 2026-09-26)

Scalar parameters live in the graph, on the node, always. The properties panel is removed: it is a second place to look and a second editing path, and it complicates the editor. What the panel held for long values (JSON, expressions, model references) moves onto the node or into an editor opened from the node. The removal is TKT-22.
