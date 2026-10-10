---
id: TKT-182
title: One column convention for issue and selection tables across checks, IDS, SQL, BCF and the viewer
status: open
depends_on: []
owner:
fence: []
workflow: [W3]
related: [TKT-171]
created: 2026-10-10
kind: question
---

Found in the BOS formats wave (docs/plans/bos-formats.md, Architecture notes). BCF reads GlobalId, Title, Description, Status, Priority. The flow's verdict tables use camelCase (checkTitle, verdict in BimOpenFlow.Nodes.Compliance/VerdictSchema.cs), Ara3D.Ids uses PascalCase, the DuckDB views PascalCase. Which names and casing, and where is the constants class that both repositories can see?
