---
id: TKT-291
title: Duplex golden hashes reproduce on another machine
status: open
depends_on: []
owner:
fence: [tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-parameter-completeness.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-room-areas.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/bcf-from-ids-failures.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/bcf-from-sql.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/check-ids-carbon-psets.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/check-ids-door-width.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/bos-to-relations.txt, deps/bim-open-flow/src/flow/BimOpenFlow.Host/SamplePreparation.cs, deps/bim-open-flow/tests/**, src/studio/BimOpenFlow.Studio/NrcPreparation.cs, deps/bim-open-data/src/**]
workflow: [W1]
related: [TKT-153]
confidence: high
created: 2026-10-12
kind: defect
---

## Acceptance criteria

- [ ] The Duplex entities table hash in the seven goldens (today sha 96afba73d5cb, table 4721 rows x 6 cols) is the one a fresh rebuild of samples/nrc/duplex-enriched.bos and the .duckdb files produces, with the cause of the difference named in the ticket notes (stale owner file, or a converter whose output differs per machine, fixed in bim-open-data)
- [ ] SamplePreparation.Job.IsCurrent no longer trusts file times alone: a changed converter (bim-open-data assembly version or content hash) or a changed source IFC rebuilds the derived files, with a test

Reported 2026-10-12 by the Studio 2.5 colleague: seven SampleFlows goldens fail on their machine with the same table shape and a different hash. TKT-153 notes the likely cause: duplex-enriched.bos is git-ignored, built once by NrcPreparation, and IsCurrent compares only file times, so the goldens were approved against whatever the owner's machine held. Changes in deps/bim-open-flow or deps/bim-open-data are committed and pushed there; the supervisor moves the pins in deps.json afterwards.
