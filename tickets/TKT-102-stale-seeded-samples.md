---
id: TKT-102
title: The studio store picks up changed sample flows instead of keeping a stale copy
status: done
depends_on: []
owner: claude-tkt102
fence: [src/flow/BimOpenFlow.Host/SampleSeeding.cs, src/flow/BimOpenFlow.Host/SampleSeedRecord.cs, src/flow/BimOpenFlow.Host/BimSampleSeeding.cs, src/flow/BimOpenFlow.Host/HostRunner.cs, tests/flow/BimOpenFlow.Host.Tests/SampleSeedingRefreshTests.cs, tests/flow/BimOpenFlow.Host.Tests/SampleSeedingPlaceholderTests.cs, tests/flow/BimOpenFlow.Host.Tests/NrcSeedingTests.cs, tests/flow/BimOpenFlow.BimWorkflows.Tests/BimSampleSeedingTests.cs, tests/flow/BimOpenFlow.TableWorkflows.Tests/SampleSeedingTests.cs, tests/flow/BimOpenFlow.SampleFlows.Tests/SampleFlowsFixture.cs, scripts/seed-store.mjs, scripts/seed-store.test.mjs, scripts/prepare-bim-flow-duckdb.mjs, docs/bim-flow-duckdb.md, tickets/TKT-102-stale-seeded-samples.md]
---

## Acceptance criteria

- [x] After a sample flow changes in samples/, restarting the studio shows the new version unless the user edited their copy
- [x] A copy the user edited is never overwritten silently

Found 2026-09-28: the bim store held an old bim-level-summary (elements, byLevel, levels; no chart) while samples/bim-analyses/bim-level-summary.json has a chart and a note. `scripts/start-bim-flow.mjs` seeding never re-copies a flow that already exists, so every sample fixed in TKT-93 may be stale in existing stores.

Done 2026-09-28 in 5764f5b (host, `SampleSeeding.Seed` and `SampleSeedRecord`) and 5b3ca01 (`duckdb:prepare`, `scripts/seed-store.mjs`). The store's `.samples.json` records each seeded graph's hash after placeholder substitution; an untouched copy is refreshed (old copy archived under `versions/`), an edited one is kept and named in the log. Stores from before the record: copies without saved versions are refreshed, copies with versions are kept, analyses in `.trash` stay deleted. Left over: the seeding rules exist twice (C# and `seed-store.mjs`) until the DuckDB workflows are seeded by the host; the studio shows no note for a kept copy, only the host log does.
