---
id: TKT-50
title: IDS for NRC analytics: a synthetic NRC IDS, an Ara3D.Ids evaluator over BOS, a check.ids node, and an ifc_ids_check MCP tool
status: open
depends_on: [TKT-48]
owner:
fence: [src/data/Ara3D.Ids/**, tests/data/Ara3D.Ids.Tests/**, samples/nrc/ids/**, docs/proposals/ids-reuse.md, BimOpenToolkit.sln]
workflow: [kept]
---

## Acceptance criteria

- [x] samples/nrc/ids/nrc-analytics.ids is generated from nrc-metrics.csv by `node scripts/nrc-ids.mjs` (a3d0a843; output byte-identical to the 2026-09-27 hand-written file); the script's header lists the two metrics it turns into specifications (IDS-OC, IDS-EC) and checks its fourteen IFC classes against nrc_analytics_long.csv; `IdsFilesTests` (8cc366e3) fails when the file is stale or differs from bim-open-data's fixture copy. samples/nrc/ids/dc-w1.ids expresses rule DC-W1, written by hand
- [x] check.ids emits the standard verdict table; an unsupported facet yields InfoNotAvailable with a warning, never a pass (the node is `ids.check`, prefix = pack, like `bos.*` and `view3d.*`)
- [x] Pass and fail counts match IfcOpenShell ifctester on the same file (recorded parity transcript); the roof fails; dc-w1.ids gives 8 pass and 6 fail

P3 of Proposal: docs/proposals/nrc-deliverables.md. Run no-new-wheels over Xbim.InformationSpecifications and ifctester first. NRC has sent no IDS, so this one is written from the metric dictionary.


## Staging, 2026-09-27

First half now (claimed by hand; ticket.py refuses because the second half depends on TKT-48): the reuse check (docs/proposals/ids-reuse.md) and the Ara3D.Ids library over BOS tables, with the IDS files under samples/nrc/ids/. The check.ids node and the ifc_ids_check MCP tool follow once TKT-48 releases src/mcp/BimOpenMcp.Ifc; the fence widens then.

## Notes

- 2026-10-03: claim released; the session that held it (parallel-wave-builder-ids) had stopped. Checked against the code that day. Done: the reuse check only (84534e0, `docs/proposals/ids-reuse.md`: parse with Xbim.InformationSpecifications, evaluate over BOS). An uncommitted skeleton sits in `src/data/Ara3D.Ids/` (project file and five files, 206 lines: BOS wrappers and verdict types; no evaluator, no tests, not in the solution). Left: commit or discard that skeleton, then the facet evaluator, both `.ids` files, parity tests against ifctester, and after TKT-48 the `check.ids` node and the `ifc_ids_check` MCP tool.

- 2026-10-11: the evaluator, the node, and the samples landed (session bcfc489d). bim-open-data `1a5f7c7`: `Ara3D.Ids` builds for net8.0, `IdsModel` from a `.bos` or the two text tables, `IdsEvaluator` over entity, property and attribute facets with requirement and specification cardinalities, `IdsTables` with the IssueColumns names, 25 tests, parity transcript in `tests/data/Ara3D.Ids.Tests/README.md` (DC-W1 8/6, IDS-OC and IDS-EC 0/218 on the unenriched Duplex, the same as ifctester 0.8.5). Toolkit: `src/flow/BimOpenFlow.Nodes.Ids` (`ids.check`, `ids.specifications`), `samples/checking-analyses` (`check-ids-*`), `samples/nrc/ids`. On the enriched Duplex IDS-EC fails one element, the roof. Left: the `ifc_ids_check` MCP tool in bim-open-data's `BimOpenMcp.Ifc`, generating nrc-analytics.ids from nrc-metrics.csv, and the facets BOS cannot answer yet (classification, material, part-of, document; `IncludeSubtypes`; unit conversion of IDS values to the model's units).
- 2026-10-11, second wave: `ifc_ids_check` and `ifc_ids_specifications` MCP tools in bim-open-data `6f6adef` (109 MCP tests); IDS values converted to SI from the descriptor's unit, the attribute name, or the facet's dataType (`bda9b91`); IncludeSubtypes is not part of IDS 1.0, so entity facets match exactly (`62379c7`). The `.claude/skills/ifc-ask/SKILL.md` guide tells Claude how to use the tools.
