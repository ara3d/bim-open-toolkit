---
id: TKT-83
title: Graph text counts relation rows, and flows whose inputs a profile lacks are not seeded
status: done
depends_on: [TKT-57]
owner:
fence: [src/flow/BimOpenFlow.Host/**, src/flow/BimOpenFlow.Host.Api/**, tests/flow/BimOpenFlow.Host.Tests/**, tests/flow/BimOpenFlow.Host.Api.Tests/**]
---

## Acceptance criteria

- [x] GET /api/analyses/{id}/text prints a relation's row count and first rows, as the result peek does
- [x] federation-match is not seeded when its {FEDERATION_*} placeholders do not resolve, and the host log names why

Closed 2026-09-28: done in c8aeb34 (text endpoint prints a relation's row count and rows through GraphText.IRelationReader) and caedbc3 (seeding skips a graph with an unresolved {PLACEHOLDER} and logs the placeholder by name).
