---
id: TKT-72
title: What is the repository-wide rule for nullable scalar columns?
status: open
depends_on: []
owner:
fence: []
kind: question
---

`docs/proposals/spatial-node-set.md:201`. `spatial.polygon` and `BimRoomsNode` write `object?[]` columns typed `long` and `bool` with nulls, and the typed-array readers in the Geometry pack and the SDK cannot take nulls.

Options: nullable typed arrays (`long?[]`); a validity mask beside each typed array; or no nulls, with a sentinel value per type.

No default in the source.

Raised by reviews/2026-09-27-status.md
