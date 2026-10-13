---
id: TKT-287
title: Wires route around cards instead of passing behind them
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/bimopenflow/web/packages/graph/src/canvasParts.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/src/wireRoute.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/src/layoutCheck.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/test/**]
workflow: [W2]
related: [TKT-286]
created: 2026-10-12
---

## Acceptance criteria

- [ ] A wire whose direct curve meets a card that is not one of its ends is drawn through waypoints that keep it clear, at draw time, so a hand-placed graph is clear too
- [ ] layoutCheck checks the routed path, and nrc-enrich-run leaves the WIRES_BEHIND_CARDS list in bimopenflow/web/packages/studio-web/test/sampleLayout.test.ts

Found 2026-10-12 under TKT-286. Each wire is one horizontal-tangent cubic between its sockets (gratify wireAt), so autoLayout can only keep it clear by moving cards. A graph where one source feeds several steps across layers (nrc-enrich-run: metrics and run each feed four) cannot be cleared that way without a layout three times taller. The layered layout already computes a lane per skipped layer; routing through the lane points, or a simple obstacle router at draw time, would clear these and any graph a person arranges by hand.

2026-10-12, later: a graph input's `$name` reference is now a wire from the input's card in the rail (bim-open-flow be20f77), and layoutCheck leaves wires from rail cards out (ac694ac), since the editor places those cards. The router this ticket asks for should take them in: in check-ids-door-width the wire from `$geometry` crosses two cards.
