---
id: TKT-119
title: Regenerate the sample notebooks so their embedded graphs use the relaid-out positions
status: done
depends_on: []
owner: wave-w5
fence: [samples/notebooks/**]
---

## Acceptance criteria

- [x] samples/notebooks/*.notebook.json embed graphs with no overlapping nodes: done in 6cd915b by copying the graph files' positions (bim-open-notebook scripts/sync-embed-layouts.ts), not by regenerating; samples.test.ts keeps them in step
- [x] s10-snowdon's reply text no longer says levels are split into named blocks

Left by TKT-110 (2026-09-28): the sample graphs were relaid out in 4acf943, but the notebooks embed copies with the old positions. Regenerate with write-sample-notebooks.ts against a running host. s10-snowdon's text also says levels are split into named blocks, which TKT-35 found wrong: repeated storey names are one storey per discipline file.

Resolved (2026-09-28, wave-w5): the reply text is the outline's, so the sentence was edited in outlines/s10-snowdon.outline.json and the notebook together (no host run: Snowdon needs the private model, and the positions were already synced in 6cd915b). samples.test.ts, which checks embedded graphs for overlaps, passes.
