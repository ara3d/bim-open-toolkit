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

**Revised decision:** V2-PLAN.md gains a "Concurrent work" section, a "Toolset" section, a recorded baseline, and wave 0 supervisor paths for the tooling files. The platonic-ts MCP server (sibling checkout `../platonic-ts`) is registered for this repository over the viewer workspace through `tools/platonic-mcp.mts` and `.mcp.json`. The platonic-ts strictness retrofit and check gate are scheduled as the first wave 0 supervisor chunk. Fence-enforcing hooks are not installed; that decision is recorded as unresolved because project hooks apply to every session in this checkout, including the concurrent loader work.

**Reason and evidence:** three other interactive sessions were active in this checkout during the review; commit `851a91e` (prepared BFAST models) landed during it and `viewer/packages/loaders` still carried uncommitted files. The MCP smoke test over `viewer/` listed 33 tools and resolved `InstancedGroup` to 82 type-checked uses in 17 files. The workspace test baseline at `851a91e` plus the dirty loader files was 290 passed, 1 skipped, 0 failed. The retrofit dry run over 147 viewer TypeScript files counted 2 `any`, 181 `as`, 217 `!`, 0 directives, 0 lint disables and 167 undocumented exports.

**User basis:** user request on 2026-09-07 to prepare V2 execution with the parallel-wave and platonic-coder skills and the platonic-ts toolset, aware of concurrent BFAST loader work.

**Affected requirements:** none. F22, F24 and F25 remain postponed.

## Decision record: 2026-09-07 — BFAST is the default model format for V2

**Affected requirement:** F02 model loading (P0) and the F27 demos and fixtures; no acceptance criterion removed.

**Previous decision:** BOS is the primary prepared-model format; BFAST is an added ingestion path (loader session, `viewer/packages/visualization/docs/bfast-loading.md`).

**Revised decision:** BFAST is the default model format across V2: demos, fixture server, saved-scene references and the beginner path load BFAST, and BOS is loaded through conversion to BFAST. Network transfer of the larger file is a separate later optimization.

**Reason and evidence:** supervisor measurement in [V2-STATUS.md](V2-STATUS.md): end-to-end CPU load of Snowdon through the alpha path is 1.9 to 2.0 times faster with BFAST (median 1981 ms with tables, 1890 ms geometry only, versus 3797 ms for BOS, five alternating fresh processes each); parse plus conversion alone is 3.5 times faster and V2 removes the shared per-instance binding step that dilutes it. The file is 11 to 12 times larger; transfer was not measured.

**User basis:** user instruction 2026-09-07: "Switch to BFAST for now across the board. We will tackle network latency later by optimizing it."

**Affected contracts and checks:** V2-PLAN.md `formats` package row and Track F deliverables; Track F must re-measure BFAST versus BOS on the columnar path and record transfer size. The alpha package is unchanged by this decision.

## Decision record: 2026-09-08 — model contract revision M1 accepted

**Affected requirement:** F01, F07, F08, F17, F26 contracts in the `model` package; no acceptance criterion removed.

**Previous decision:** the P0 sketch in V2-PLAN.md ("The one extension mechanism"), with `run(session, input)` typed per command.

**Revised decision:** revision M1 as documented in `viewer/packages/model/docs/CONTRACTS-M1.md` (commit `641624b`) is the contract for waves 1 to 3. Departures from P0: `Session` is its own module; `Command.run` takes `unknown` and validates with the command's own schema, with the `command()` constructor giving authors a typed input; `OptionalSchema` marks optional properties explicitly; `resolveStyles` takes the scene's object keys; edit targets and saved-view members are keys, not sets; undo is a generic history over whole immutable states. Follow-ups for wave 1: export `Vec2` (Track S request); a bound on history length; group and instance indices stay the render package's concern.

**Reason and evidence:** 198 tests in 18 files, zero escape hatches, a 40-line `Session` fixture proves the contract implementable, README examples run as tests; the supervisor re-ran typecheck, lint and tests. The erased command input is what lets a registry hold commands of different input types and lets MCP descriptors be generated exactly.

**User basis:** plan approved 2026-09-07; contract review is a supervisor responsibility under that plan.

**Affected contracts and checks:** every wave 1 brief names M1 at `641624b`; the P0 snippet in V2-PLAN.md is annotated, not rewritten.

## Decision record: 2026-09-08 — `interact` replaces `@ara3d/viewer-controls`

**Affected requirement:** F04 navigation, F05 views and projection; unresolved decision 3 in V2-PLAN.md.

**Previous decision:** open; Track I to decide in its first chunk.

**Revised decision:** the `interact` package replaces the alpha controls package with its own implementation (`viewer/packages/interact/docs/DECISION-controls.md`, commit `9545032`). The alpha's verified behaviours were carried over as tests against the new API.

**Reason and evidence:** the wrappable surface is about 325 lines and hardcodes +Y up, while V2 views declare their up axis and BIM data is Z-up; it has no projection, first-person, overhead, bindings or animation, so most of F04 is new either way; wrapping would pull `three` and mutable class state into what must be a pure reducer; and it would put a V2 package behind an alpha package no V2 track may change and that is removed at the wave 4 cutover. Result: 11 modules, 202 tests, no browser, no `three`, no DOM, one impure DOM adapter module.

**User basis:** plan approved 2026-09-07 delegated this decision to Track I.

**Affected contracts and checks:** `@ara3d/viewer-controls` removed from the interact manifest; nothing imports it.

## Decision record: 2026-09-08 — new gallery and demo set on Gratify

**Affected requirements:** F09 default UI (shell, themes, big-text), F27 demos and gallery, section 6 workflows, section 9 demonstrations. No acceptance criterion removed.

**Previous decision:** V2-PLAN.md wave 2 Track D ports the 23 alpha demos onto a gallery host on `createViewer`; wave 3 Tracks WD1 to WD4 add eleven workflow demos; Track G builds the Gratify shell in wave 3.

**Revised decision:** [GALLERY-PLAN.md](GALLERY-PLAN.md). A new gallery and twenty-one demos are built from scratch in `viewer/packages/demos` with a new look and feel (light chrome, dark viewport, serif display type, one warm accent); the alpha gallery stays untouched on port 5173. Gratify draws every in-canvas widget and the sidebar property inspector; the DOM shell owns navigation, fixture choice, theme and an accessibility mirror. `createViewer` (Track V) and the Gratify layer (Track UG) are pulled forward and built alongside; feature modules are owned by the demo track that demonstrates them (D1 to D4). Per-chunk gates are typecheck and package tests only; lint and the combined gate run at integration; performance is measured, not asserted. The alpha demos are not ported; the wave 4 parity gate checks each alpha behaviour against the new demos instead.

**Reason and evidence:** two surveys on 2026-09-08. Gratify 0.2.0 is a Canvas2D model-view-update framework with six built-in parts and no published widgets, text input, scrolling or clip primitive, and its `mount()` leaks listeners; the alpha's headless-runtime pattern avoids the leak and the pointer-capture problem, so the layer is built on that. The `demos` package holds only the fixture server, and `viewer`, `features` and `ui-gratify` are empty, so nothing is lost by starting the gallery fresh, and porting 23 alpha demos would carry the alpha's hand-wired host into V2.

**User basis:** user request 2026-09-08 for a brand-new demo set and gallery leveraging Gratify for in-canvas widgets or a sidebar inspector, a new look and feel with the old gallery kept, speed over gates, and improving touched code.

**Affected contracts and checks:** new contract revision G1 (demo registration, Gratify layer, viewer composition) in GALLERY-PLAN.md section 4, landed as code at the wave's chunk 0. Model contract M1 unchanged. Track C (MCP) and the E2E slice track are unchanged; GAL's first chunk supersedes the slice if it has not landed.
