---
id: TKT-258
title: The golden test has no golden for the 14 viz and 6 checking graphs the bim profile seeds, and SampleSourceFiles omits both folders
status: open
depends_on: []
owner:
fence: [tests/studio/BimOpenFlow.SampleFlows.Tests/SampleSourceFiles.cs, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-*.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/check-*.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/bcf-*.txt, docs/sample-flows-test.md]
workflow: [W2]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] SampleSourceFiles.Dirs lists samples/viz-analyses and samples/checking-analyses, so their golden text prints {SAMPLES}, not a machine path
- [ ] A golden exists under golden/bim/ for each of the 20 graphs and GoldenTests passes for every seeded id in both profiles
- [ ] docs/sample-flows-test.md says which folders the test covers

Found by the 2026-10-11 sample graph review. BimSampleSeeding.Seed has seeded samples/viz-analyses since e9d322e0 and samples/checking-analyses since 064cf1c0; SampleFlowsFixture.Cases enumerates every seeded id and GoldenTests.MatchesGoldenFile fails on a missing file, yet golden/bim/ holds no viz-*, check-* or bcf-* text (last approved in c23ffc31, before 064cf1c0). SampleSourceFiles.Dirs also lacks both folders, so an approval today would print rewritten machine paths. Do this first; the folder passes that follow re-approve their own goldens.
