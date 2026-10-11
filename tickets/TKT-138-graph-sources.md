---
id: TKT-138
title: A file path lives once per graph: source nodes sit in a sources rail and parameters refer to them by chip
status: done
depends_on: [TKT-203]
owner:
fence: []
workflow: [W1, W2]
related: [TKT-202, TKT-204, TKT-73]
closed: 2026-10-11
---

## Acceptance criteria

- [ ] A source node (`duck.source`, and the model source TKT-202 and TKT-203 make possible for `bos.load` and `bim.*`) is drawn in a sources rail along the left of the canvas, not among the other nodes; the document is unchanged, a source is an ordinary node
- [ ] A bindable parameter wired to a source shows a chip with the source's name in place of a drawn wire; hovering the chip highlights every node that uses the source; a toggle draws the wires
- [ ] Dropping a `.duckdb`, `.bos` or `.ifc` file on the canvas creates a source; typing a path that matches an existing source offers the link
- [ ] One gesture on a node's inline path promotes it to a source and offers the link to every other node holding the same path
- [ ] The 8 sample graphs with a repeated path (bim-door-rooms, bim-duct-rooms, bim-nearest-door, bim-room-containment, nrc-q7-absence, bfast-buffers, shared-color-legend, nb-s10-snowdon-storey-doors) use one source each

## History

2026-09-29: the owner asked for one location per path, and the devil's-advocate answer that day proposed a graph-level declaration (name to path) and rejected a path on a wire as a scalar wire (PROJECT.md principle 5).

2026-10-11: revised after the owner's design discussion. A source stays a node, so MCP, graph text, undo and the Ask box keep one edit path (principle 1); the editor gives source nodes a rail and chip rendering instead of a second document concept. The objection to a wire falls away once the wire carries a Database or Model resource (TKT-202) rather than a string: resources are few, named, hashed and pinned. The file is parsed once already (BimModel caches by content hash), so this is about one location for the path and about swapping the model (TKT-204), not speed.
