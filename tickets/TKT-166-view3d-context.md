---
id: TKT-166
title: 3D context: the 3D lab and 3d.html open on a public building, each recipe is a sample graph, and the page says who it is for
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/studio-web/showcase.html, bimopenflow/web/packages/studio-web/src/showcase.*, bimopenflow/web/packages/studio-web/3d.html, samples/view3d-analyses/**, docs/bim-flow-3d.md, docs/DEMOS.md, site/**]
workflow: [W3]
created: 2026-10-05
---

## Acceptance criteria

- [ ] C:/Program Files/Git/showcase.html loads a public model (Schependomlaan or the DigitalHub union) by default instead of the Snowdon fixture, and still accepts a local BOS or BFAST
- [ ] Every recipe on /showcase.html is also a committed graph in samples/view3d-analyses that opens in 3d.html, so the page and the editor show the same thing
- [ ] The page names its audience (a BIM coordinator reviewing a model) and links to the analysis context for the data behind a colouring

Serves W3 (the answer in every form). The second of the five demo contexts in docs/proposals/demo-contexts.md. Today the lab's seven recipes are view steps hard-coded in showcase.ts over the Snowdon Vite fixture, and samples/view3d-analyses holds eight different graphs over the Duplex IFC; the two surfaces do not agree. Related: TKT-16 (one colour domain and legend), TKT-28 (3D pane in the DuckDB studio), TKT-164 (camera adapter).
