---
id: TKT-138
title: A file path lives once per graph: a named graph source that nodes refer to
status: open
depends_on: [TKT-5]
owner:
fence: []
workflow: [W1]
---

## Acceptance criteria

- [ ] A graph document can declare named sources (name to path); a FilePath or ModelRef parameter can refer to one instead of holding a path
- [ ] One gesture on a node's path field promotes it to a graph source, and other nodes with the same path are offered the link
- [ ] The canvas shows the source once, with its users marked; changing it re-evaluates every user
- [ ] The 8 sample graphs with a repeated path (bim-door-rooms, bim-duct-rooms, bim-nearest-door, bim-room-containment, nrc-q7-absence, bfast-buffers, shared-color-legend, nb-s10-snowdon-storey-doors) use one source each

Source: owner request of 2026-09-29 and the devil's-advocate answer that day. The file is parsed once already (BimModel caches by content hash), so this is about one location for the path, not speed. A path on a wire was rejected: it is a scalar wire, which PROJECT.md principle 5 and Scope rule out. The named 'source' of rel.* nodes is the precedent. Settle it together with the open question on how a Run freezes a registry source.
