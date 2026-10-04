---
id: TKT-159
title: Static notebook site: ship the node catalog so graph cells draw their wires
status: done
depends_on: [TKT-80]
owner:
fence: [bim-open-notebook: bimopenflow/web/packages/bim-open-notebook/{vite.pages.config.ts, vite/samples.ts, src/page/notebookView.ts, src/page/entry.ts, src/page/sitePaths.ts, test/notebookView.test.ts, test/site.test.ts}]
created: 2026-10-04
closed: 2026-10-04
---

## Acceptance criteria

- [ ] The static build (npm run build:pages) writes notebooks/node-catalog.json beside the samples, a NodeCatalog ({nodes: NodeDescriptor[]}) that covers every node kind the public notebooks' graphs use
- [ ] In hostless mode EmbedContext.catalog resolves from that file, so a graph cell on https://ara3d.github.io/bim-open-notebook/ draws ports and the wires its document carries (p01 has 1 graph embed with edges; nrc-test-kit had 26 edges and drew none)
- [ ] A notebookView test covers the hostless catalog; gates/pages-smoke.mjs still passes

Cause, found 2026-10-04: the stored graph documents carry their edges, but notebookView.ts passes catalog: undefined when hostless, and the editor draws portless nodes without a catalog (graph.ts), so the wires have no anchors. The site already ships catalog.json, but that is the landing-page list of notebooks, not the node catalog. Source for the file: the generic host's catalog (deps/bim-open-flow docs, or the writer saves it from the host it ran against); the public notebooks were written against the generic host, so its catalog must cover their kinds. Coordinate with the session '3D views in BIM notebook', which is editing the same files for the recorded 3D embed (TKT next).
