---
id: TKT-83
title: Graph text counts relation rows, and flows whose inputs a profile lacks are not seeded
status: open
depends_on: [TKT-57]
owner:
fence: [src/flow/BimOpenFlow.Host/**, src/flow/BimOpenFlow.Host.Api/**, tests/flow/BimOpenFlow.Host.Tests/**, tests/flow/BimOpenFlow.Host.Api.Tests/**]
---

## Acceptance criteria

- [ ] GET /api/analyses/{id}/text prints a relation's row count and first rows, as the result peek does
- [ ] federation-match is not seeded when its {FEDERATION_*} placeholders do not resolve, and the host log names why
