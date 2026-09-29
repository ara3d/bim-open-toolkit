---
id: TKT-102
title: The studio store picks up changed sample flows instead of keeping a stale copy
status: claimed
depends_on: []
owner: claude-tkt102
fence: [src/flow/BimOpenFlow.Host/SampleSeeding.cs, src/flow/BimOpenFlow.Host/SampleSeedRecord.cs, src/flow/BimOpenFlow.Host/BimSampleSeeding.cs, src/flow/BimOpenFlow.Host/HostRunner.cs, tests/flow/BimOpenFlow.Host.Tests/SampleSeedingRefreshTests.cs, tests/flow/BimOpenFlow.Host.Tests/SampleSeedingPlaceholderTests.cs, tests/flow/BimOpenFlow.Host.Tests/NrcSeedingTests.cs, tests/flow/BimOpenFlow.BimWorkflows.Tests/BimSampleSeedingTests.cs, tests/flow/BimOpenFlow.TableWorkflows.Tests/SampleSeedingTests.cs, tests/flow/BimOpenFlow.SampleFlows.Tests/SampleFlowsFixture.cs, scripts/seed-store.mjs, scripts/seed-store.test.mjs, scripts/prepare-bim-flow-duckdb.mjs, docs/bim-flow-duckdb.md, tickets/TKT-102-stale-seeded-samples.md]
---

## Acceptance criteria

- [ ] After a sample flow changes in samples/, restarting the studio shows the new version unless the user edited their copy
- [ ] A copy the user edited is never overwritten silently

Found 2026-09-28: the bim store held an old bim-level-summary (elements, byLevel, levels; no chart) while samples/bim-analyses/bim-level-summary.json has a chart and a note. `scripts/start-bim-flow.mjs` seeding never re-copies a flow that already exists, so every sample fixed in TKT-93 may be stale in existing stores.
