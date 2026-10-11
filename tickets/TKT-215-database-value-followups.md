---
id: TKT-215
title: Database values: production runs pin duck.source through its path, the web gives a Database wire no row count, graph text prints it as 'Database', and the Ask guides do not say what duck.source emits
status: open
depends_on: []
owner:
fence: []
workflow: [W2]
related: [TKT-202, TKT-203]
created: 2026-10-11
---

## Acceptance criteria

- [ ] `EvalEndpoints.cs` and `FlowEvalTools.cs` call the snapshot overload of `RunInputs.Derive`, so a run pins a Database output by its hash from the value, not only through the `path` parameter (the hash is the same today; the value is the one place once TKT-203 makes `path` bindable)
- [ ] `portResults.countTargets` and `defaultShown.kindRank` in the web graph package treat a Database port as a row source, so its wire shows a row-count badge (the table count) like a Table wire
- [ ] `GraphText.ValueText` prints a Database value as a digest with its path and the first characters of its hash
- [ ] `.claude/skills/bim-flow/*.md` (also the Ask box's system prompt) say that `duck.source` emits a Database value that `duck.query`, `duck.table` and `duck.tables` take on their `source` input
- [ ] bim-open-flow's `.gitignore` pattern `*.duckdb` no longer matches the `BimOpenFlow.Nodes.DuckDb` directory on a case-insensitive filesystem (anchor it to files), so a new file there needs no `git add -f`

Source: TKT-202's report, 2026-10-11 (ara3d-dataflow `1ea61cd`, bim-open-flow `d14c02a`).
