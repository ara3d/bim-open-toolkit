---
id: TKT-289
title: Enforce the layout process: close gates for sample and card-size tickets, positions only from the layout tool, card-size changes own the relayout and the pin
status: claimed
depends_on: []
owner: session 3777d13d
session: 3777d13d-6750-4d06-989e-0517bca2a2c7
fence: [tickets/close-gates.toml, scripts/check-pin.mjs, AGENTS.md, samples/**/*.json, bimopenflow/web/packages/studio-web/test/**, deps.json, deps/bim-open-flow/bimopenflow/web/packages/graph/scripts/**, deps/bim-open-flow/bimopenflow/web/packages/graph/src/layoutCheck.ts, deps/bim-open-flow/bimopenflow/web/packages/graph/test/**, deps/bim-open-flow/samples/**/*.json]
workflow: [process]
related: [TKT-286]
confidence: high
created: 2026-10-12
claimed: 2026-10-12
---

## Acceptance criteria

- [ ] ticket.py close refuses while an acceptance box is unchecked (unless --waive records why) and runs the close gates a ticket's fence touches (platonic-coder bdf9ebb)
- [ ] tickets/close-gates.toml gates a ticket touching samples, the graph package, or the node catalog on the toolkit's and bim-open-flow's sample tests, and a ticket touching deps/bim-open-flow on the pin matching the pushed checkout
- [ ] A test fails when a sample's stored position differs from autoLayout's, in both repositories; every sample is at the tool's positions
- [ ] AGENTS.md says positions come from relayout-samples and that a card-size change owns the relayout and the pin bump

Owner's request 2026-10-12 after TKT-286: gate closing on the sample tests with the output quoted, make ticket.py close refuse while boxes are unchecked, stop placing cards by hand, and give card-size changes their follow-through.
