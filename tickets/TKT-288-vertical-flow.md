---
id: TKT-288
title: Top-to-bottom flow for graphs that read better vertically, with sockets on the top and bottom edges
status: open
depends_on: []
owner:
fence: []
workflow: [W2]
related: [TKT-286]
created: 2026-10-12
kind: idea
---

Owner, 2026-10-12: sometimes vertical graphs are better than horizontal. Today sockets sit on the left and right card edges and wires leave horizontally, so the old autoLayout's vertical choice bent every wire back on itself; TKT-286 removed it. A vertical mode needs input sockets on the top edge, outputs on the bottom, and vertical-tangent wires, then the same layered layout with axes swapped. Open: chosen per graph (stored in the document) or by the viewport's shape, and how param sockets (one per row, on the left) fit.
