---
id: TKT-209
title: The static schema pass over a graph: served by the host and MCP, shown on wire peek, and warnings for absent columns before any run
status: done
depends_on: [TKT-208]
owner:
fence: []
workflow: [W2, W5]
related: [TKT-11]
created: 2026-10-11
closed: 2026-10-12
---

## Acceptance criteria

- [x] `GraphSchemas.Infer(document, registry, catalog)` in the host returns, for every Table and Relation port in a graph, a `SchemaResult` (schema, or the first upstream error), without evaluating any node; a Database or file source is opened only to read its header or table list
- [x] The analysis API serves it (a schemas route beside the results route), the editor session recomputes it on every edit, MCP `getAnalysis` includes it, and the static site falls back to recorded columns when there is no host
- [x] Hovering a port (TKT-11's peek) shows the inferred columns and types before any data exists; an output whose schema is `Dynamic` says so
- [x] A node whose parameter names a column absent from the inferred input schema shows a warning naming the column and the nearest match, before any run (PROJECT.md principle 6); a type mismatch (a sum over Text) is a warning too
- [x] The `bim-flow` skill guide drops the paragraphs that list columns by hand and points at the catalog instead; a benchmark question is answered by Claude from `getNodeCatalog` and `getAnalysis` without an exploratory `evaluate`, and the transcript is committed

Source: `docs/plans/declared-schemas.md`. The pass is the static type check of a graph: the owner's observation that one can see a graph's structure without running it.
