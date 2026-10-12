---
id: TKT-265
title: An {ARTIFACTS} placeholder for writer targets, so sample graphs stop climbing out of {SAMPLES}/../../artifacts
status: done
depends_on: [TKT-262, TKT-263, TKT-264]
owner: builder-TKT-265
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [deps/bim-open-flow/src/flow/BimOpenFlow.Host/SampleSeeding.cs, deps/bim-open-flow/tests/**/SampleSeeding*, src/studio/BimOpenFlow.Studio/BimSampleSeeding.cs, src/studio/BimOpenFlow.Studio/NrcSamples.cs, samples/nrc-analyses/nrc-enrich-run.json, samples/nrc-analyses/nrc-dc-w1-verdicts.json, samples/checking-analyses/bcf-from-ids-failures.json, samples/checking-analyses/bcf-from-sql.json, samples/*/README.md]
workflow: [W3]
created: 2026-10-11
claimed: 2026-10-12
closed: 2026-10-12
---

## Acceptance criteria

- [x] The seeder rewrites a literal {ARTIFACTS} to the repository's artifacts folder for every seeding source, and scripts/seed-store.mjs does the same
- [x] nrc-enrich-run.targetPath, nrc-dc-w1-verdicts.report and both bcf.write nodes use {ARTIFACTS}/...; the READMEs say so; goldens unchanged in meaning

From the 2026-10-11 review: three toolkit graphs write to {SAMPLES}/../../artifacts/..., an idiom a reader has to decode and that breaks if a folder moves. Runs after the nrc and checking passes so the fences do not collide.
