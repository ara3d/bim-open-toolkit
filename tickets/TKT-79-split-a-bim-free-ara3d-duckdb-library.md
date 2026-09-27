---
id: TKT-79
title: Split a BIM-free Ara3D.DuckDb library out of Ara3D.BimOpenSchema.DuckDb?
status: open
depends_on: []
owner:
fence: []
kind: question
---

`docs/proposals/core-node-sets.md:364`. The generic query and write-table helpers live under a BOS name, against the structure document's rule that the engine is BIM-free.

Options: split them out; or leave them.

No default in the source.

Raised by reviews/2026-09-27-status.md
