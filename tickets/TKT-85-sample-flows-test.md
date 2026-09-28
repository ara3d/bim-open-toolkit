---
id: TKT-85
title: One headless test over every sample flow in every profile: evaluation, lint, golden text, expected answers
status: done
depends_on: []
owner:
fence: [tests/flow/BimOpenFlow.SampleFlows.Tests/**, BimOpenToolkit.sln, gates/all.mjs, docs/sample-flows-test.md]
---

## Acceptance criteria

- [x] dotnet test tests/flow/BimOpenFlow.SampleFlows.Tests loads every samples/*/*.json into every profile the host would seed it into, through the host's own seeding and composition, and evaluates it
- [x] Every node is Ok, except an explicit allow-list with a reason per entry (schema-error fails on purpose; effect sinks stay EffectPending)
- [x] Lint fails on: a node with no edges in a graph of more than one node, a sort, filter, or limit whose output equals its input, an empty final table, an unresolved {PLACEHOLDER}; each lint has an allow-list with reasons
- [x] Each flow's graph text is compared with a golden file; one documented command re-approves
- [x] NRC flows' answers are compared with the expected answers the NRC tests already use
- [x] gates/all.mjs runs it

Owner, 2026-09-27: 'we need a tool for testing the flows that works as a standalone test. You shouldn't have to open them in the graph to find all errors.' The flow review found errors only the host's seeding showed (bfast file lock under parallel evaluation, unresolved federation placeholders). Covers TKT-57's golden-file criterion in its own project, since TKT-57's fence is claimed.

Closed 2026-09-28: done in b2203a3 (SampleFlows.Tests: both profiles, Ok status, four lints, golden text, NRC answers, gates/all.mjs), 0a9fdb4 (the six findings it reported), 9cfb24d (golden files checked out with LF). 401 tests pass. The unresolved-placeholder lint has no allow-list: host seeding already skips such graphs, so an entry could never match.
