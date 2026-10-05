---
id: TKT-149
title: Stop copying the toolkit's alias config files into bim-open-notebook
status: open
depends_on: []
owner:
fence: [bim-open-notebook:bimopenflow/web/viewer.config.ts, bim-open-notebook:bimopenflow/web/flow.config.ts, bim-open-notebook:bimopenflow/web/deps.tsconfig.json, deps.config.ts]
workflow: [process]
---

## Acceptance criteria

- [ ] bim-open-notebook holds no copy of viewer.config.ts, flow.config.ts or deps.tsconfig.json from the toolkit
- [ ] bim-open-flow and bim-open-viewer export a consumer alias module, or publish npm packages (proposal 8.5), and both repositories use it

Planned debt of docs/plans/repository-split-phase-6.md: the notebook repository carries copies of three files from bimopenflow/web/, so a change to either must be made twice.
