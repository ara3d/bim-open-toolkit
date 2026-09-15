# PlatoFlow proof of concept: design record

PlatoFlow (also called Studio Graph) was a browser-based dataflow editor for building
models, built between 2026-08-09 and 2026-08-20 as a throwaway prototype. Its code lived in
`platoflow/` at the repository root until 2026-09-15, when the folder was deleted. The
production replacement is BimOpenFlow (`bimopenflow/` and the `src/BimOpenFlow.*` projects).
The code is still in git history at commit `0690029` and earlier.

This folder keeps the parts of the prototype that outlived it: the design documents that
govern the rewrite, and the findings the prototype was built to produce.

| File | What it is |
| --- | --- |
| [NOTES.md](NOTES.md) | Findings from every wave of the prototype: contract changes, perf numbers, design friction, viewer and editor gotchas. The prototype's real deliverable. |
| [POC-README.md](POC-README.md) | The prototype's own README: what it did, how the two processes talked, how to extend it. Run instructions no longer apply. |
| [CONTRACTS.md](CONTRACTS.md) | Wire value types, host HTTP API, and write-fence tables the prototype's tracks worked against. |
| [platoflow-ifc-design.md](platoflow-ifc-design.md) | The PlatoFlow × IFC design the prototype tested. |
| [platoflow-graph-semantics.md](platoflow-graph-semantics.md) | Analysis, graph, and run vocabulary. |
| [platoflow-v1-nodes.md](platoflow-v1-nodes.md) | Workflow brainstorm (56 workflows across 9 personas) and the V1 node vocabulary. |
| [platoflow-design-principles.md](platoflow-design-principles.md) | P0 agent velocity, P1 one headless core, and the rest. |
| [platoflow-agent-concepts.md](platoflow-agent-concepts.md) | How AI agents build and drive graphs. |
| [platoflow-compliance-design.md](platoflow-compliance-design.md) | Rule checking and compliance reporting design. |
| [PROVENANCE.md](PROVENANCE.md) | Where the prototype's source, data, and dependencies came from. |

## Features not yet carried into BimOpenFlow

Compared on 2026-09-15 against the production node registry and the BimOpenFlow web app.
The node-level parity map in `tests/BimOpenFlow.PocParity.Tests/PocCoverageTests.cs` covers
node kinds; this list adds the editor and runtime behaviours that map cannot express.

Node kinds the prototype had that BimOpenFlow now covers: CSV source, two-table join, set
algebra (at table level), generated SQL from a question, bar chart, bounding boxes, level
explode, byte-exact property set write-back, and agent-driven graph editing over MCP.

Still missing, in rough order of value:

1. **Checklist selection node** (`select.checklist`). Live check boxes drawn on the node
   card, one per Type or Level actually present in the model, with counts. The stored
   parameter is the *excluded* set so new upstream values default to ticked. Each toggle is
   one undo step. Matching is exact against the model's category text; a comma in a value
   cannot round-trip. See "Wave 11" in NOTES.md.
2. **Subgraphs with promoted ports** (`graph.sub`). Shipped in the prototype (W3 T16 in
   NOTES.md); deferred past V1 in the UX proposal. Neither the graph spec nor the state
   package mentions subgraphs today.
3. **Several models in one graph.** The disciplines demo loaded architecture, HVAC, and
   structure as three Load Model nodes. The prototype's viewer cached every parsed model and
   activated the one behind the selected node. BimOpenFlow's viewer pane closes all models
   before loading a new one. Unfixed in the prototype: grid row highlight resolved entity
   indexes against the first model, so values should carry their model id to the highlight
   path. See "W13 follow-up" in NOTES.md.
4. **Guided tour.** A walkthrough under the Help menu that drove the editor step by step.
5. **Node-as-inspector layout.** Parameter rows, a help expando, status footer, and Run
   button all on the card, with one pure `nodeLayout(info, helpOpen, status)` function shared
   by rendering and hit testing. Parameter edits opened a floating popover that closed on
   pan, zoom, or selection change. BimOpenFlow keeps a separate parameters pane. See "Wave
   3" in NOTES.md for why a popover over the canvas beat a side panel.
6. **Status message vocabulary.** Wave 9 (W9-A in NOTES.md) settled setup-flavoured
   imperatives ("choose a type", "enter a query") and the split between needs-setup,
   waiting on an upstream node, and upstream error. Worth checking against the BimOpenFlow
   status contract.
7. **End-to-end headless smoke.** `tools/intgate-smoke.mjs` drove a private headless Chrome
   through SQL, write-back, MCP intents, and Ask AI in one run of about 13 assertions. The
   `gates/` folder has host and web smokes but nothing that exercises the host-touching
   features end to end.

Smaller items: per-instance node resize with a widget registry, a range slider embedded on
the colormap node, multi-select with copy, paste, duplicate, and align, and the measured
limit that recoloring costs about 7 µs per instance with merged geometry, so per-instance
colour buffers are needed before it scales past roughly 20,000 instances.
