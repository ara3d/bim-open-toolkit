---
id: TKT-156
title: Static graph embeds draw no wires without a host's node catalog
status: open
depends_on: []
owner:
fence: [bim-open-notebook:bimopenflow/web/packages/bim-open-notebook/**]
kind: idea
---

Found in phase 6. On the published site there is no host, so the graph embeds in the notebooks cannot look up port names and draw no wires between nodes. The notebook file could carry the slice of the catalog its graphs use, or the embed could infer wires from the stored connections alone.
