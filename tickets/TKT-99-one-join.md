---
id: TKT-99
title: Should table.join and rel.join share one design: same parameters, every match on duplicate keys, default left?
status: open
depends_on: []
owner:
fence: []
kind: question
---

Proposal: `docs/proposals/one-join.md`. The flow review found three join nodes with different parameters, defaults, and results; the same question gives different row counts in the two packs when the right table has duplicate keys.

Decisions needed:

1. **Duplicate right keys:** every match, as SQL does (recommended), or first match wins, as `table.join` does today. Every match can change the answers of `table.join` samples whose right table has duplicate keys.
2. **Default kind:** `left` for both (recommended; keeps unmatched rows visible), or `inner` for both. Only one sample relies on `rel.join`'s `inner` default.
3. **`table.join` ports:** rename `a`, `b` to `left`, `right` and rewrite the port names when a saved graph loads (recommended), or keep `a`, `b` and align only the parameters.
4. **Build it now,** or after the editor UX wave (TKT-94 to TKT-98), which touches the same editor files for the shared-column pre-fill.

Answering 1 to 3 as recommended lets the six chunks in the proposal start.

## Also in scope (node review, 2026-09-29)

- **Several key columns.** Joins with two or four conditions go to SQL today: the federation confirmations join (four keys) and the Parameters joins on EntityIndex plus a property name. Accept a comma-separated key list in both packs.
- **A `cross` kind**, to attach a one-row table such as run metadata (`nrc-q6-analysis-run`).
