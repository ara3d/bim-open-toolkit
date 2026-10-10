---
id: TKT-176
title: BimGeometryBuilder truncates vertices toward zero instead of rounding
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.BimOpenSchema.ObjectModel/**, deps/bim-open-data/tests/data/Ara3D.BimOpenSchema.Tests/**]
workflow: [W3]
created: 2026-10-10
kind: defect
---

## Acceptance criteria

- [ ] BuildModel rounds each coordinate to the nearest 0.1 mm, and a test shows a 5 cm tube keeps its volume within 0.01 %

Found in the BOS formats wave (docs/plans/bos-formats.md, Architecture notes). (int)(v * 1e4) truncates toward zero; the Fragments reader measured a 0.26 % volume loss on a 5 cm tube. Every BOS writer goes through this builder, so the sample .bos files change when it is fixed; regenerate them and their recorded counts.
