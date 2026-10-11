---
id: TKT-214
title: The public static site has no file routes, so the FilePath control's browse button reports an error there
status: open
depends_on: []
owner:
fence: []
workflow: [W1]
related: [TKT-137]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] `site-web/src/staticApi.ts` answers `GET /api/files` and `GET /api/files/stat` from the recorded sample data (the files the sample graphs name), so the browse button lists them and a path that is not recorded gets the warning badge, not an error
- [ ] The notebook repository's `samples/notebooks/node-catalog.json` is regenerated from the current catalog (it still predates the `FilesUnderRoots` suggestion kind and the `Database` port type)

Source: TKT-137's report, 2026-10-11 (bim-open-flow `21a94ed`, `ea7332f`).
