---
id: TKT-86
title: Move the app helpers the notebook deep-imports into a client library
status: done
depends_on: [TKT-80]
owner:
fence: [bimopenflow/web/packages/client/**, bimopenflow/web/packages/app/src/**, bim-open-notebook:bimopenflow/web/packages/bim-open-notebook/src/**]
---

## Acceptance criteria

- [x] No file under packages/bim-open-notebook imports from @bimopenflow/app/src
- [x] The /api/ask event reader and AskEvent exist once, used by duckdbDemo.ts and the notebook
- [x] The 3D feed choice (planFeed in notebook, feedModel/feedData in paneArea.ts) exists once

From docs/plans/notebook.md, Debt: deep imports from @bimopenflow/app, the /api/ask stream reader, the 3D feed order. Blocked while app/src files are in claimed fences (TKT-11, 12, 26).

Note (TKT-94, 2026-09-28): the graph helpers are no longer deep-imported; the notebook takes `nodeTitle` and the editor from `@bimopenflow/graph`. What remains here: the pane helpers (`paneContext`, `paneChoice`, `hostStatus`, `topbar`'s host banner, the 3D feed helpers) and the `/api/ask` reader. The `app/src` files those live in are no longer in TKT-11, 12, or 26's pending chunks, so this is unblocked.

Note (2026-10-03): done in a1ca414 and b68ab9f. The helpers moved to a new package, `@bimopenflow/client` (packages/client), below app and the notebook: `api-client` is generated, `state` stays free of panes and the DOM, and `panes` does not depend on `state`. Its main entry holds the pane helpers (`paneChoice`, `paneContext`, `completeTable`, `liveViewRecipe`, `modelRef`, `modelCatalog`, `view3dFeed`); `@bimopenflow/client/host` holds `hostStatus`, `mountHostBanner`, `hostMessage`, and the `/api/ask` reader and transport, and reaches no pane or viewer code. One reader and one `AskEvent` serve the notebook, the Ask panel, and the DuckDB page; `view3dDataKind` and `modelUrlFor` serve both `paneArea.ts` and the notebook's `planFeed`. `test/layering.test.ts` in the notebook forbids `@bimopenflow/app`. Not done: `AskEvent` is still hand-written, not generated from `contracts/contracts.json`; `liveViewRecipe` still reads `../../panes/src/viewRecipe` because panes does not export `parseViewRecipe`; TKT-115 and TKT-47 fences still name `app/src/paneChoice.ts`, now `packages/client/src/paneChoice.ts`.
