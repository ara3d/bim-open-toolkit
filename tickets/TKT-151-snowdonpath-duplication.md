---
id: TKT-151
title: Remove the duplicate snowdonPath() in nrc-web
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/nrc-web/scripts/snowdon.ts, src/**/BimSampleSeeding.cs]
---

## Acceptance criteria

- [ ] One definition of where the Snowdon model is looked for serves both nrc-web and BimSampleSeeding.SnowdonPath

Existing debt carried over by docs/plans/repository-split-phase-6.md: snowdonPath() in nrc-web repeats BimSampleSeeding.SnowdonPath in C#.
