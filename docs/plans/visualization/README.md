# Visualization planning sources and decisions

## Sources

- [PRODUCT-BRIEF.md](PRODUCT-BRIEF.md) is an exact copy of the September 7, 2026 user-supplied product description. It preserves all F01–F27 stages, user benefits, priority meanings, dependencies, performance targets and acceptance criteria.
- [PLAN-82d7f41.md](history/PLAN-82d7f41.md) is the earliest committed visualization foundation plan: contracts, ownership, staged implementation, deferrals and benchmark protocol.
- [PLAN-2acaeb7.md](history/PLAN-2acaeb7.md) preserves the committed plan before the integration rewrite, including the next independent-gallery wave.
- [PLAN-6539fe9.md](history/PLAN-6539fe9.md) preserves the rewritten plan exactly, so the repair itself does not discard its status or decisions.
- [baseline-hashes.json](baseline-hashes.json) records SHA-256 hashes of these exact bytes. Historical Markdown is intentionally unedited, including old paths and statements that no longer describe current behavior.

Original local source: `C:/Users/cdigg/.codex/visualizations/2026/09/07/01a07a35-f9eb-7d03-9255-8c609ea0a6f7/bim-open-toolkit-visualization-product-description.md`. The repository copy removes dependence on that machine-specific path for future planning. Model files and private projection data have not been copied.

Current navigation: [durable plan](../../../viewer/packages/visualization/docs/PLAN.md), [execution status](../../../viewer/packages/visualization/docs/STATUS.md), [verification evidence](../../../viewer/packages/visualization/docs/FINDINGS.md), [proposed skill guidance](PARALLEL-WAVE-IMPROVEMENTS.md).

## Decision record: 2026-09-07 — restore durable planning context

**Observed change:** commit `6539fe9` replaced the accumulated visualization plan with a current implementation/status document. The replacement retained useful contracts and results, but lost original planning rationale/history and lacked a link to the full product brief. It also left a table called “Active track” beside a later statement that the tracks were complete.

**Cause:** the coordinator treated a durable plan as a replaceable rolling status summary. The user requested ongoing plan updates, speed, parallel development and explicit postponement of expensive features; those instructions did not authorize deleting the original context. There is no evidence that automatic context compaction edited the file. The file replacement was an assistant action.

**Repair:** preserve the intact source and three exact committed plan snapshots; reconstruct the durable plan around original intent, feature priorities, milestones, dependencies, acceptance and outstanding work; move execution status to its own document; add repository planning-preservation instructions. The reconstruction is labeled as such. Uncommitted intermediate wave notes are not claimed to have been recovered from Git.

**Scope interpretation retained:** prioritize useful composable alpha increments and postpone expensive specialist work as the user authorized. Original P0 requirements that remain incomplete still block a claim of complete V1 release acceptance. P1/P2 deferral does not delete those capabilities from the product brief.

**Prevention:** future changes append a decision or revise an explicitly current status field; material plan replacements retain their predecessor and working source links. Review removed text against feature IDs and acceptance. `AGENTS.md` provides persistent project guidance, while Git snapshots provide recovery; guidance alone is not a mechanical guarantee against a future bad edit.

Run `node docs/plans/visualization/check-baselines.mjs` to detect changed baseline bytes or missing original feature priorities. This check is required by the project guidance after planning edits and was run during this repair. It is not wired into CI and cannot detect semantic loss elsewhere in the plan; review the diff as well.

## Future decisions

Append a dated record with: affected original F-ID/stage and requirement; previous decision; revised decision; reason and evidence; user instruction or other authority; affected contracts/checks; retained work and next readiness condition. Do not rewrite earlier decisions to make them appear to have anticipated later results.

## Decision record: 2026-09-07 — V2 rewrite plan

**Previous decision:** continue the alpha through incremental waves on the existing `visualization` package (PLAN.md).

**Revised decision:** plan a rewrite, [V2-PLAN.md](V2-PLAN.md), organized around one extension mechanism (feature modules with commands, versioned state slices and events), columnar instance tables, a synthetic data catalog and eleven workflow demonstrations. The alpha package stays untouched until a parity gate, then is removed.

**Reason:** the alpha lacks a default composition, keeps feature state outside the saved schema, copies per-instance data into JavaScript objects, and cannot show most section 6 workflows without private data. Each of these costs grows with every added feature.

**User basis:** user request on 2026-09-07 for a new plan prioritizing maintainability, usability and ease of extension, with many real-world workflow demonstrations, more synthetic examples, maximal parallelism, Opus agents for coding, Sonnet agents for long mechanical tasks, and nested agent spawning.

**Affected requirements:** none removed. F22, F24 and F25 remain postponed. All other P0 stages are scheduled in waves 0 to 4.

## Decision record: 2026-09-07 — V2 pre-flight: concurrent work, toolset and baseline

**Previous decision:** [V2-PLAN.md](V2-PLAN.md) as proposed, not started; tooling limited to the platonic-coder and parallel-wave skills.

**Revised decision:** V2-PLAN.md gains a "Concurrent work" section, a "Toolset" section, a recorded baseline, and wave 0 supervisor paths for the tooling files. The platonic-ts MCP server (sibling checkout `../platonic-ts`) is registered for this repository over the viewer workspace through `tools/platonic-mcp.ts` and `.mcp.json`. The platonic-ts strictness retrofit and check gate are scheduled as the first wave 0 supervisor chunk. Fence-enforcing hooks are not installed; that decision is recorded as unresolved because project hooks apply to every session in this checkout, including the concurrent loader work.

**Reason and evidence:** three other interactive sessions were active in this checkout during the review; commit `851a91e` (prepared BFAST models) landed during it and `viewer/packages/loaders` still carried uncommitted files. The MCP smoke test over `viewer/` listed 33 tools and resolved `InstancedGroup` to 82 type-checked uses in 17 files. The workspace test baseline at `851a91e` plus the dirty loader files was 290 passed, 1 skipped, 0 failed. The retrofit dry run over 147 viewer TypeScript files counted 2 `any`, 181 `as`, 217 `!`, 0 directives, 0 lint disables and 167 undocumented exports.

**User basis:** user request on 2026-09-07 to prepare V2 execution with the parallel-wave and platonic-coder skills and the platonic-ts toolset, aware of concurrent BFAST loader work.

**Affected requirements:** none. F22, F24 and F25 remain postponed.
