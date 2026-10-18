---
id: TKT-330
title: The 3D pane loads no model for a graph whose model path is the $model graph input: modelPathFor returns the placeholder, not the input's default
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/bimopenflow/web/packages/client/src/modelRef.ts, deps/bim-open-flow/bimopenflow/web/packages/client/test/**, deps.json]
workflow: [W3]
related: [TKT-320, TKT-260]
created: 2026-10-18
kind: defect
---

## Acceptance criteria

- [ ] Opening color-by-category or nrc-color-operational-carbon in the studio (both declare a model input whose value.path holds $model) loads the Duplex into the 3D pane
- [ ] modelPathFor resolves a $name placeholder to the graph input's current value or default, and a client test covers it

Seen 2026-10-18 in the live studio while checking TKT-320: the pane status stays at 'Choose a model or view recipe.' and the app re-fetches /api/models on every feed because resolveModelId cannot match the literal text $model. Graphs with a literal path (viz-door-accessibility) load. TKT-260 introduced the $model convention for samples; modelPathFor in client/src/modelRef.ts reads the raw value.path text.
