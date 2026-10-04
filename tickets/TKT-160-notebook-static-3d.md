---
id: TKT-160
title: Static notebook site: 3D embeds draw from a recorded model and snapshot, with a still as fallback
status: open
depends_on: [TKT-80]
owner:
fence: [bim-open-notebook: bimopenflow/web/packages/bim-open-notebook/{src/document/format.ts, src/document/io.ts, src/document/paths.ts, src/embeds/contract.ts, src/page/view3dEmbed.ts, src/page/files.ts, src/page/site.ts, src/page/sitePaths.ts, vite.config.ts, vite.pages.config.ts, vite/samples.ts, scripts/write-sample-notebooks.ts, test/view3dEmbed.test.ts}, samples/notebooks/]
created: 2026-10-04
---

## Acceptance criteria

- [ ] A View3dEmbed can record model (a .bos path relative to the notebook) and snapshot (every row of the node's output); the static build copies the public models under notebooks/models/ and a hostless page draws such an embed in the 3D pane with no host
- [ ] The three public notebooks (p01, p02, p03) record model and snapshot for their view3d embed, so https://ara3d.github.io/bim-open-notebook/ shows three live 3D views
- [ ] An embed with a still but no recorded feed shows the still; one with neither keeps the 'needs a running host' line

Why: the static copy showed 'The 3D view loads the model from a running host, so this copy shows only its description' for every 3D embed, because the embed stored only a node reference and the renderer resolved it against a host. Status 2026-10-04: in progress in the session '3D views in BIM notebook' (uncommitted in ~/git/bim-open-notebook: recordedFeed in view3dEmbed.ts, model and snapshot fields, models/ in the pages build, a base URL for relative paths). This ticket records the work and its acceptance; whoever finishes it closes it. The private Snowdon notebooks keep a still only.
