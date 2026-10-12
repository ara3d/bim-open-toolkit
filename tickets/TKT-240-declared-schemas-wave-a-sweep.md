---
id: TKT-240
title: Declared-schemas wave A sweep: small debts left by A1 to A4
status: open
depends_on: []
owner:
fence: []
workflow: [W2]
related: [TKT-206, TKT-207]
created: 2026-10-11
---

## Acceptance criteria

- [ ] A test ties Ara3D.Ids IdsVerdict's property names to IssueColumns
- [ ] check.rollup's output columns (passCount, failCount, needsReviewCount, infoNotAvailableCount, worst) are PascalCase, or the reason they stay camelCase is written in the Compliance README
- [ ] MarkdownEmitter's Columns table has a direct test
- [ ] FlowDocumentTools.cs in bim-open-flow has one line ending style
- [ ] Projection parsing documents that aliases cannot contain spaces and that a column named with ' as ' is split, or handles quoted names
- [ ] B2's reader gaps: `json.read` with `flatten=true` infers a known schema; SQLite column types map from the declared type affinity instead of Unknown; TIME infers the Text the run emits; `sql.query` with a gap in its optional ports (t3 wired, t2 not) either runs or fails at inference too; a SQLite query with duplicate column names infers the names the run produces
- [ ] `CachedCatalog` (bim-open-flow `Relations.DuckDb`) evicts by age instead of dropping every entry at 512, and caches glob paths
- [ ] `bim.paramTable`'s inference reads the model through `BimModel.Get`, which hashes the whole file on every call; it caches by path, length and write time as `CachedCatalog` does
- [ ] `SqlQueryNode.WithAlias` uses `Nodes.Support/SqlAlias.WithT` instead of its own copy
- [ ] `check.rollup`'s count columns and `bcf.write`'s path and sha256 columns name a kind or say why not
- [ ] `table.drop` with every named column missing keeps a Date column's type in its inferred schema, as the run does
- [ ] `table.fillNulls`'s constant checks are one function shared by the rule and the run
- [ ] `table.window` and `table.splitColumn` reject at inference exactly the operand types DuckDB rejects at run
- [ ] The editor's card badge colours a warning; `portResults` refreshes on a schemas-only update; `stepList` passes the warning count to `nodeBadge`
- [ ] Column uses: view3d selectors and chart.bar labels filter as well as order; `table.setOp`, spatial keys, `chart.line` x and `view3d.color`'s value column declare a use; one aggregate edit is one undo step; the static site sends the allowed aggregate functions

Collected from the A1 to A4 reports in docs/plans/declared-schemas.md (build log). The git-ignored site/app/site.js in bim-open-flow still names camelCase verdict columns until the site is rebuilt.
