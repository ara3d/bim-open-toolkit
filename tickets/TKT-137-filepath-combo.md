---
id: TKT-137
title: FilePath parameters offer the files under the model roots in a combo box, plus a browse button
status: open
depends_on: []
owner:
fence: []
workflow: [W1]
---

## Acceptance criteria

- [ ] A new suggestion kind lists files under the host's model roots filtered by extension; bos.load, bim.*, duck.source, csv.read and the other file readers declare it
- [ ] The node's path field shows the suggestions; a typed path that is not listed is still accepted, with a warning if it does not exist
- [ ] A '...' button opens a host-served folder browser limited to the model roots; picking a file sets the parameter through setParam
- [ ] MCP getNodeCatalog reports the suggestion kind, and the suggestions endpoint answers for it

Source: owner request of 2026-09-29. A browser file input cannot give the host a path, so browsing goes through the host. Reuse the model catalog behind listModels.
