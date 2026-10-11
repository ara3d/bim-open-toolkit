---
id: TKT-183
title: Read only the BOS tables a caller needs, and write .usdc for large models
status: done
depends_on: []
owner:
fence: []
workflow: [W3]
created: 2026-10-10
closed: 2026-10-11
kind: idea
---

Found in the BOS formats wave (docs/plans/bos-formats.md, Architecture notes). ReadBimDataFromParquetZip reads every table; the GLB export never uses Parameters. At Snowdon's size (about 450,000 instances) a table list would save most of the read. Schependomlaan writes 42.7 MB of .usda against 4.7 MB as .usdc, so Snowdon needs .usdc, by usd-core conversion or a native writer.

Selective read done 2026-10-11: bim-open-data `6f80664`, `eb3e1a5` (transitive closure), `ebfa619`; bim-open-flow `3af0b4f`; toolkit `caa178f`, `55573c4`. The .usdc half is split to TKT-196; a row-count-only read is TKT-195.
