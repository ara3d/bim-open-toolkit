---
id: TKT-57
title: Evaluated graphs as text: one printer for structure and results, golden files for every sample graph, and an MCP tool
status: open
depends_on: []
owner:
fence: [src/flow/BimOpenFlow.GraphText/**, tests/flow/BimOpenFlow.GraphText.Tests/**, BimOpenToolkit.sln, docs/graph-text.md]
---

## Acceptance criteria

- [ ] A library BimOpenFlow.GraphText prints a graph document plus its evaluation snapshot as deterministic text: one line per node in the ANF form name = kind@version(port: node.port, param: "value"); with the node's result as a comment block beneath it (status and cause; tables as row and column counts, column names, first rows, content hash; 3D instance tables as a scene digest of visible, hidden, isolated, coloured and grey counts, legend bins with counts, sections, camera, bounds; charts as their categories, series, and values; verdict tables as counts per rule and verdict)
- [ ] Golden mode is byte-stable across runs and machines: stable ordering, rounded numbers, no timings, no absolute paths; a debug mode may add timings
- [ ] Every graph under samples/*-analyses and samples/analyses that evaluates without private data has a golden file under tests/flow/BimOpenFlow.GraphText.Tests/golden/, compared by a test; one documented command re-approves after an intended change; graphs needing the private Snowdon model are skipped with a named reason
- [ ] An MCP tool describeAnalysis and GET /api/analyses/{id}/text return the text for the open or named analysis (last chunk; its fence is widened when TKT-26 and TKT-12, which own src/mcp/BimOpenMcp.Flow and src/flow/BimOpenFlow.Host.Api, are done or agree)
- [ ] docs/graph-text.md gives the grammar, one annotated example, what the scene digest does not check (the renderer itself, which the pixel smokes in gates/ keep covering), and how to re-approve goldens

Owner's request, 2026-09-27: validate built graphs without parsing screenshots, with a text form that also serves MCP clients. Builds on the 2026-09-19 session 'Node graph textual representation', which chose the ANF one-binding-per-line syntax and a printer-first debug format with evaluation state as trailing comments; nothing of it was built. Reading text back into graph edits is deferred. One implementation, in C# beside the evaluator; the web fetches it. Validates TKT-56 (graphs over any BOS model) and feeds TKT-51 grading.

## Notes

- 2026-10-03: claim released; the session that held it (parallel-wave-builder-graphtext) had stopped. Checked against the code that day. Done: the `BimOpenFlow.GraphText` library (83d37ee) and `GET /api/analyses/{id}/text` (130c910). Left: golden files for every sample graph that needs no private data, with a test and a re-approve command; the `describeAnalysis` MCP tool; `docs/graph-text.md`. Start from `tests/flow/BimOpenFlow.GraphText.Tests/Fixtures.cs`.
