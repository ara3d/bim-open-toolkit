---
id: TKT-150
title: Serve one copy of the building paragraphs of NOTICE.md
status: open
depends_on: []
owner:
fence: [bim-open-notebook:NOTICE.md, bim-open-notebook:bimopenflow/web/packages/bim-open-notebook/test/notice.test.ts]
workflow: [process]
---

## Acceptance criteria

- [ ] The building paragraphs of the notebook's NOTICE.md and bim-open-data's samples/public/NOTICE.md come from one file, not two

Planned debt of docs/plans/repository-split-phase-6.md: the paragraphs are copied from bim-open-data/samples/public/NOTICE.md, and a test (chunk 6.8) fails on drift. Serving one NOTICE removes the copy and the test.
