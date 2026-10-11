---
id: TKT-176
title: BimGeometryBuilder truncates vertices toward zero instead of rounding
status: done
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.BimOpenSchema.ObjectModel/**, deps/bim-open-data/tests/data/Ara3D.BimOpenSchema.Tests/**]
workflow: [W3]
created: 2026-10-10
closed: 2026-10-11
kind: defect
---

## Acceptance criteria

- [x] Each stored vertex coordinate is within 0.05 mm of its source (round to nearest, not truncate); the volume of a 5 cm radius tube changes by at most 0.4 % at any tessellation and by about 0.001 % at 4,096 segments; meshes with non-finite vertices are left empty and counted; coordinates beyond ±214.7 km are clamped and counted (restated 2026-10-11 after review: the old 0.01 % held only at 4,096 segments)

Found in the BOS formats wave (docs/plans/bos-formats.md, Architecture notes). (int)(v * 1e4) truncates toward zero; the Fragments reader measured a 0.26 % volume loss on a 5 cm tube. Every BOS writer goes through this builder, so the sample .bos files change when it is fixed; regenerate them and their recorded counts.

Done 2026-10-11 (bim-open-data): `5ad98c3`, `e5c3d88`, `427577c`, `7bf79ac`; samples regenerated in `9fde349`.
