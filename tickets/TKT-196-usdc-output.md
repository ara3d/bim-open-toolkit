---
id: TKT-196
title: Write .usdc for large models (split from TKT-183)
status: open
depends_on: []
owner:
fence: []
workflow: [W3]
related: [TKT-173, TKT-183]
created: 2026-10-10
kind: idea
---

Split from TKT-183, whose selective-read half is done. Schependomlaan writes 56.8 MB of .usda (7.2 MB as .usdc via usd-core); Snowdon would be several GB of text. Options: usd-core conversion in tools/bos-to-usd (the Web USD viewer session already drives usd-core from usd-web-viewer/tools/convert_models.py), or a native crate writer.
