---
id: TKT-90
title: One document checker and one turn builder for notebooks and outlines
status: open
depends_on: [TKT-80]
owner:
fence: [bim-open-notebook:bimopenflow/web/packages/bim-open-notebook/**]
workflow: [process]
---

## Acceptance criteria

- [ ] outlineErrors and parseNotebook share the path-tagged checking combinators
- [ ] stale and earlier are set by document/edits.ts, not stitched on by the sample script

From docs/plans/notebook.md, Debt: the outline checker; stale and earlier added outside edits.ts.
