---
id: TKT-153
title: SampleFlows golden tests fail in a fresh clone: 12 NRC graphs report Unknown source 'duplex-base'
status: open
depends_on: []
owner:
fence: [tests/studio/BimOpenFlow.SampleFlows.Tests/**, samples/nrc-analyses/**]
kind: defect
---

## Acceptance criteria

- [ ] In a fresh clone (no data/ folder), dotnet test tests/studio/BimOpenFlow.SampleFlows.Tests -c Release passes, or each test that needs data the clone lacks is skipped with a message naming it
- [ ] The toolkit's CI step for the solution's tests no longer needs continue-on-error to hide these failures

Found 2026-10-04 by the agent fixing TKT-152: in fresh clones (linked and cloned alike) 24 SampleFlows golden tests fail; 12 NRC graphs fail with "Unknown source 'duplex-base'". The owner's checkout passes, so the tests depend on something a fresh clone lacks (likely a seeded store or data/ file). The CI workflow's solution test step runs with continue-on-error, which hides this. The 62 further failures from CRLF golden files were fixed in 5ef7004 (.gitattributes path).
