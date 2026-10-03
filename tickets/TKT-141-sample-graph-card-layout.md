---
id: TKT-141
title: Sample graph cards overlap and their text overflows in the graph editor's layout tests
status: done
depends_on: []
owner:
fence: [bimopenflow/web/packages/graph/**, samples/**/*.json]
kind: defect
---

## Acceptance criteria

- [x] npm test -w @bimopenflow/graph --prefix bimopenflow/web passes, including test/sampleOverlap.test.ts and the four test/textOverflow.test.ts cases
- [x] node gates/web-smoke.mjs passes

Found 2026-10-03 as the baseline before the repository split (docs/plans/repository-split.md). sampleOverlap reports two overlapping card pairs; textOverflow reports one to three overflowing texts per card style (classic, banner, chip, bar). Likely cause, unconfirmed: the branding change to Instrument Sans and Public Sans (a28a3a1, f0064be, 2026-10-03) widened text, so card sizes and positions stored in the sample graphs no longer fit. Check whether the tests measure with the new fonts and whether the samples' stored card positions need regenerating.

2026-10-03 cause: not the fonts. federation-match.json and shared-color-legend.json (added by TKT-30 and the view3d work) were committed with hand-set positions that overlap; fixed with `npm run relayout-samples -w @bimopenflow/graph`. The text overflows in federation-match.json were the same cards, laid out too close, and went away with the relayout. The classic-style sample test also took 4.4 s warm, so it timed out at the 5 s default under load; testTimeout is now 30 s. web-smoke fails only on the known app/test/duckdbAskLog.test.ts hook timeout, which passes alone. Notebooks embedding these two graphs may need bim-open-notebook's sync-embed-layouts.ts; .NET tests reading these samples (SampleFlows.Tests, Snowdon federation tests) need a run.
