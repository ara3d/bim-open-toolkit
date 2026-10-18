---
id: TKT-334
title: Reading a BCF and writing it again keeps its comments and model file
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Bcf/**, deps/bim-open-data/tests/data/Ara3D.BimOpenSchema.IO.Bcf.Tests/**, src/flow/BimOpenFlow.Nodes.Bcf/**]
workflow: [W3]
related: [TKT-320, TKT-171]
created: 2026-10-18
kind: idea
---

From the 2026-10-18 review of TKT-320 chunk A1: BcfReader.ToTable carries only a comment count, so handing a colleague's BCF back after adding verdicts drops their comments. bcf.read's comments output exists; what is missing is the path from it back into bcf.write (or a BcfTopicRecord to BcfIssue call). Done would mean a round trip over a hand-written BCF 2.1 file with three comments keeps every comment with its author and date and the header's model file.
