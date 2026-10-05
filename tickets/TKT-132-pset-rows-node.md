---
id: TKT-132
title: pset.rows: turn a wide table keyed by entity into the long rows sink.writePsets writes
status: open
depends_on: []
owner:
fence: []
workflow: [kept]
---

## Acceptance criteria

- [ ] Input: a table with an entity id column and value columns; params: entity column, pset name, columns (default all others); output entityId, psetName, paramName, valueType, paramValue
- [ ] valueType is inferred from the column type; a null produces no row, so write-back never writes a fabricated value
- [ ] An optional second input of Field/Value/ValueType rows is appended to every entity's set (run id, scenario name)
- [ ] The elementRows, summaries, and provenance rel.sql nodes in nrc-rollup, nrc-enrich-run, nrc-element-psets, and nb-s05 are rebuilt from table nodes plus pset.rows and write byte-identical IFC

Source: node review of 2026-09-29. The summaries query (CASE m.Rollup inside a GROUP BY plus two UNIONs) is the hardest SQL in the samples to read.
