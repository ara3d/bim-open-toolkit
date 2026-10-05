---
id: TKT-129
title: bim.property: add one property-set value as a typed column, null when the element does not carry it
status: open
depends_on: []
owner:
fence: []
workflow: [W2]
---

## Acceptance criteria

- [ ] Inputs: the entities and parameters tables from bos.load; params: pset, name, type (Number, Integer, Text, Boolean), as
- [ ] A missing value is null, never 0 or empty text; a value that does not parse as the type is null, with a warning giving the count
- [ ] The six ocRows/ecRows/baseOcRows/... rel.sql nodes in the nb-s09-ids-check graphs are replaced, answers unchanged

Source: node review of 2026-09-29. Six copies of the same 400-character LEFT JOIN over Parameters. Relates to the bos.parameters idea in docs/proposals/core-node-sets.md Set 3.
