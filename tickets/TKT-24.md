---
id: TKT-24
title: Animate the active path: selecting a node lights its upstream wires, and evaluation shows flow
status: done
depends_on: []
owner: small-job-builder
fence: [bimopenflow/web/packages/app/**]
---

## Acceptance criteria

- [ ] Selecting a node animates every wire on the path that feeds it, upstream to the sources, distinct from unselected wires; deselecting stops it
- [ ] While the host evaluates, the wires whose downstream node is computing show a directional flow animation, and settle when the node reaches Ok or an error state
- [ ] Both honour prefers-reduced-motion the way selectionBorder.ts already does, falling back to a static highlight
- [ ] A test asserts the set of animated wires for a seeded graph and a selection; gates/web-smoke.mjs passes

Owner's finding of 2026-09-26: there was no animation on the nodes to show the current flow; on selecting a node it should be clear which path feeds it. Serves W2 and W3 and the 'fun' aim. The pulse in bimopenflow/web/packages/app/src/selectionBorder.ts and the awake window in canvasEditor.ts are the hooks; wire drawing lives in canvasParts.ts.

## Result (2026-09-26, commit bbec892)

Selecting a node animates the wires on the path that feeds it (travelling dots along the bezier, a static highlight under prefers-reduced-motion), computed by the pure upstreamEdges function with tests for chain, diamond, cycle, and sibling branches; 248 app tests and the smoke gate pass. Flow during evaluation is not built: no host state means "computing now" (NodeStatus is Ok, Unready, EffectPending, Unavailable, Error only), so it needs an Evaluating signal first, filed as TKT-33. The pre-existing "contributing" highlight that follows the 3D preview's primary node was left as a separate concern.
