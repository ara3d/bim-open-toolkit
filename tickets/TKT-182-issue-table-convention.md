---
id: TKT-182
title: One column convention for issue and selection tables across checks, IDS, SQL, BCF and the viewer
status: done
depends_on: []
owner:
fence: []
workflow: [W3]
related: [TKT-171, TKT-206]
created: 2026-10-10
closed: 2026-10-11
kind: question
---

Found in the BOS formats wave (docs/plans/bos-formats.md, Architecture notes). BCF reads GlobalId, Title, Description, Status, Priority. The flow's verdict tables use camelCase (checkTitle, verdict in BimOpenFlow.Nodes.Compliance/VerdictSchema.cs), Ara3D.Ids uses PascalCase, the DuckDB views PascalCase. Which names and casing, and where is the constants class that both repositories can see?

## Decision (owner, 2026-10-11)

Accepted as recommended below: PascalCase, and one `IssueColumns` constants class in `Ara3D.BimOpenSchema.ObjectModel` (bim-open-data) that the flow's `VerdictSchema.cs` and `VerdictTables.cs`, `Ara3D.Ids`, and the BCF writer all read. The flow's verdict columns become `Verdict`, `CheckId`, `CheckTitle`, `Citation`; issue and selection tables carry `GlobalId` plus optional `EntityIndex`, `Title`, `Description`, `Status`, `Priority`. TKT-206 (the column vocabulary) carries out the change, including the compliance tests, golden outputs, and saved graphs that name the old camelCase columns.

## Recommendation (supervisor, 2026-10-10), accepted above

- **Casing: PascalCase.** It is what the BOS tables, the DuckDB views (`EntityText.GlobalId`), `Ara3D.Ids.IdsVerdict` and the BCF reader already use. Only the flow's verdict tables are camelCase.
- **Columns.**
  - Every issue or selection table: `GlobalId` (required), plus optional `EntityIndex`, `Title` (the grouping), `Description`, `Status` and `Priority`.
  - Verdict tables add `CheckId`, `Verdict` and `Citation`, which `IdsVerdict` already has.
- **Where the constants live:** one `IssueColumns` class in `Ara3D.BimOpenSchema.ObjectModel` (bim-open-data). bim-open-flow already depends on bim-open-data, so `BimOpenFlow.Nodes.Compliance/VerdictSchema.cs` and `BimOpenFlow.Reports/VerdictTables.cs` would refer to it instead of declaring their own strings. Once TKT-174 lands, the BCF writer references ObjectModel too.
- **Cost:**
  - The flow's verdict column names change from `verdict`/`checkTitle` to `Verdict`/`CheckTitle`. That changes the compliance node tests, any committed golden output, and saved graphs that name those columns in SQL or parameters.
  - SQL over DuckDB is case-insensitive for identifiers, so queries keep working. C# lookups by name may not.

Note 2026-10-11: TKT-206 (the column vocabulary) applies this recommendation and extends it to every BIM column; see `docs/plans/declared-schemas.md`. The owner's decision here unblocks TKT-206.
