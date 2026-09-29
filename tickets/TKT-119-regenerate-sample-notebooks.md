---
id: TKT-119
title: Regenerate the sample notebooks so their embedded graphs use the relaid-out positions
status: open
depends_on: []
owner:
fence: [samples/notebooks/**]
---

## Acceptance criteria

- [ ] samples/notebooks/*.notebook.json embed graphs with no overlapping nodes (npm run test:layout in packages/graph lists none from notebooks)

Left by TKT-110 (2026-09-28): the sample graphs were relaid out in 4acf943, but the notebooks embed copies with the old positions. Regenerate with write-sample-notebooks.ts against a running host. s10-snowdon's text also says levels are split into named blocks, which TKT-35 found wrong: repeated storey names are one storey per discipline file.
