---
id: TKT-195
title: A row-count-only read of a .bos, so ModelCatalog.GetInfo does not load Parameters to count rows
status: open
depends_on: []
owner:
fence: []
workflow: [W2]
related: [TKT-183]
created: 2026-10-10
kind: idea
---

From the BOS middle-layer wave review (docs/plans/bos-middle-layer.md, Review findings), 2026-10-10. GetInfo reads four tables (and their references) only to count rows; Parquet footers hold row counts. Schependomlaan: 337 ms against 373 ms for a full read.
