---
id: TKT-141
title: Sample graph cards overlap and their text overflows in the graph editor's layout tests
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/graph/**, samples/**/*.json]
kind: defect
---

## Acceptance criteria

- [ ] npm test -w @bimopenflow/graph --prefix bimopenflow/web passes, including test/sampleOverlap.test.ts and the four test/textOverflow.test.ts cases
- [ ] node gates/web-smoke.mjs passes

Found 2026-10-03 as the baseline before the repository split (docs/plans/repository-split.md). sampleOverlap reports two overlapping card pairs; textOverflow reports one to three overflowing texts per card style (classic, banner, chip, bar). Likely cause, unconfirmed: the branding change to Instrument Sans and Public Sans (a28a3a1, f0064be, 2026-10-03) widened text, so card sizes and positions stored in the sample graphs no longer fit. Check whether the tests measure with the new fonts and whether the samples' stored card positions need regenerating.
