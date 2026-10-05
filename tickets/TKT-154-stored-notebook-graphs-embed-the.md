---
id: TKT-154
title: Stored notebook graphs embed the checkout's absolute path, so graph hashes differ between checkouts
status: open
depends_on: []
owner:
fence: [bim-open-notebook:samples/notebooks/**, bim-open-notebook:bimopenflow/web/packages/bim-open-notebook/**]
workflow: [W3]
kind: defect
---

## Acceptance criteria

- [ ] The graph hash of p01-schependomlaan and p03-duplex-doors embeds is the same when the repository is cloned to two different folders

Found in phase 6 (repository split). The notebooks' stored graphs name the data files by absolute path (the checkout's deps/bim-open-data/samples/public), so the hash that identifies the graph, and with it the run record, depends on where the repository sits. Seen in the p01 and p03 embeds. A path placeholder resolved by the host at evaluation time, as the write script's --placeholder option does for generation, would keep the stored graph identical.
