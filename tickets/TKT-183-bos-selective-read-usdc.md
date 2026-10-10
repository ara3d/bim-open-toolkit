---
id: TKT-183
title: Read only the BOS tables a caller needs, and write .usdc for large models
status: open
depends_on: []
owner:
fence: []
workflow: [W3]
created: 2026-10-10
kind: idea
---

Found in the BOS formats wave (docs/plans/bos-formats.md, Architecture notes). ReadBimDataFromParquetZip reads every table; the GLB export never uses Parameters. At Snowdon's size (about 450,000 instances) a table list would save most of the read. Schependomlaan writes 42.7 MB of .usda against 4.7 MB as .usdc, so Snowdon needs .usdc, by usd-core conversion or a native writer.
