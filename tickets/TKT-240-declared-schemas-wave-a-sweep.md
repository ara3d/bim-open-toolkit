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

Collected from the A1 to A4 reports in docs/plans/declared-schemas.md (build log). The git-ignored site/app/site.js in bim-open-flow still names camelCase verdict columns until the site is rebuilt.
