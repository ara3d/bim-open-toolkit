# Visualization V2 plan

Date: 2026-09-07. Status: proposed, not started; pre-flight review completed 2026-09-07 (see the decision record in [README.md](README.md)). Supersedes the alpha delivery approach in [PLAN.md](../../../viewer/packages/visualization/docs/PLAN.md) for future waves. The [product brief](PRODUCT-BRIEF.md) remains the requirements baseline and its F01–F27 IDs are used below.

## Why a new plan

The alpha proved the data-first approach but stopped short in four ways that get more expensive with every feature added on top:

1. Every host hand-wires viewer, controls, render binding, selection, picking, resize and disposal. There is no default composition, so beginners and every adapter repeat about 130 lines.
2. Feature state (clipping, environment, replacement, layouts, overlays) lives in runtime objects outside the saved-scene schema. Persistence, MCP and UI adapters each have to be taught about each feature by hand.
3. Instance bindings copy per-instance transforms and colors out of the GPU buffers into 456,598 frozen JavaScript objects for Snowdon.
4. Demos exercise one feature each. There are no end-to-end workflow demonstrations and only one synthetic fixture, so most acceptance cases in brief section 6 cannot be shown without private data.

V2 is a rewrite organized around one extension mechanism, so that adding a feature means adding one module and nothing else changes.

## Design goals, in priority order

1. **Correct and honest.** Facts carry coverage, units, evidence and missing reasons. No demo fabricates BIM meaning.
2. **Extension by addition.** A new feature, format, workflow or UI adapter is a new file or package. Registries replace edits to central files.
3. **Parallel by construction.** Package boundaries are ownership boundaries. Any track can test against synthetic data without Snowdon, a browser or another track's output.
4. **Beginner path of three lines.** Create a viewer, open a model, run a command.
5. **Reasonable performance, measured.** Columnar instance tables, bulk updates, frame-time measurement from the first wave.

## Architecture

### Packages

All packages live under `viewer/packages/` and publish as `@bim-open-toolkit/<name>`. Dependencies point inward only: a package may depend on packages listed above it, never below.

| Package | Owns | Depends on |
|---|---|---|
| `model` | Pure data contracts and operations: identity, coordinates, object sets, style rules and precedence, edit layers and history, view state, document slices and versioning, schema combinators, `Result` and `Diagnostic`, facts vocabulary (observation, coverage, evidence, missing reason), columnar `Table`, mesh data POD, command, event and feature contracts. | nothing |
| `synthetic` | Seeded generators for buildings, networks, schedules, revisions, facts with gaps, stress scenes and mesh primitives. | `model` |
| `formats` | BFAST (default prepared format), BOS, GLB, GLTF, OBJ, STL adapters producing one normalized `LoadedModel` with a columnar representation table; resource resolver; format diagnostics. | `model`, `@ara3d/viewer-loaders` |
| `render` | Instance table bound to viewer-core groups, representation registry and replacement, picking, clipping, environment, overlay primitives, capture, frame timing. | `model`, `@ara3d/viewer-core`, three |
| `interact` | Camera state math, orbit, first-person, overhead, configurable bindings, touch, interruptible camera animation. | `model`, `@ara3d/viewer-controls` |
| `features` | One `Feature` module per capability, each owning its commands, state slice, schema and optional render hook. | `model`, `render`, `interact` |
| `workflows` | Result adapters and recipes for the ten brief section 6 workflows. Pure: input tables in, typed results plus rules, sets, overlays and views out. | `model` |
| `viewer` | Default composition: `createViewer`, command bus, feature host, persistence of slices, multi-view. | `model`, `formats`, `render`, `interact`, `features` |
| `ui-gratify` | Gratify shell, panels, theme tokens, big-text, keyboard map, bound to viewer commands and subscriptions. | `viewer`, gratify |
| `ui-react` | React bindings (`useViewer`, `useSelection`, `useSlice`) and the review application. | `viewer`, react |
| `mcp` | Node bridge exposing viewer commands as MCP tools over a WebSocket to a browser session; client walkthrough. | `viewer` (types only), MCP SDK |
| `testing` | Fixture builders, fake clocks, headless scene helpers, browser runner, benchmark protocol. | `model`, `synthetic`, `render` |
| `demos` | Gallery host, feature demos, workflow demos, fixture server, browser specs. | everything |

The existing `visualization` package stays untouched until the parity gate in wave 4, then is removed.

### The one extension mechanism

Every capability is a `Feature`:

```ts
type Feature<S> = {
  readonly id: string;
  readonly dependsOn: readonly string[];
  readonly slice: StateSlice<S>;            // schema, version, migrate, default
  readonly commands: readonly Command[];     // typed name, input schema, run(session, input)
  install?(session: Session): Disposable;   // optional render or interaction hook
};
```

- **Commands** are the only way state changes. UI buttons, React handlers, MCP tools, keyboard bindings and demo scripts all dispatch the same commands. MCP tool descriptors are generated from command schemas.
- **State slices** are plain data. The scene document is the composition of every installed feature's slice, each versioned and migrated independently. Persistence never learns about a feature.
- **Events** are published after each command commit with the changed slice IDs. Subscribers (render, UI) react to changed slices only.
- **Schema combinators** in `model/schema.ts` replace the four hand-written validators in the alpha and are reused by slices, commands, workflow inputs and MCP.

### Data layout for scale

- `LoadedModel` holds `ModelData` (object records) and a `RepresentationTable`: typed arrays for `objectIndex`, `groupIndex`, `instanceIndex`, plus optional `colorFactor` and `localTransform` columns only when they differ from the group buffers.
- `InstanceTable` in `render` maps object keys to representation rows through an index array. No per-instance JavaScript objects.
- Bulk updates take a `Table` of changed columns, not arrays of records, and write directly to group buffers with change detection.

### Coordinates

`CoordinateContext` records units, up axis and a registration state (`local`, `project`, `geographic` with anchor, or `unknown`). Every loaded model, layout and overlay declares which frame it reports in. This is required before F22 maps and any measurement.

## Synthetic data catalog

Every generator is deterministic from a seed and returns `ModelData` plus mesh groups plus fact tables, with deliberate gaps and conflicts so exception handling is always demonstrable.

| Generator | Produces | Used by |
|---|---|---|
| `building` | Storeys, rooms, walls, slabs, doors, windows with categories, names, storey links, door widths and fire ratings (known, missing, conflicting). | Door schedule, fire-rating review, HUD level navigation, layouts, sections |
| `services` | Pipe runs, valves, equipment with topology, some connections deliberately unverified. | Valve isolation trace |
| `revisions` | Two snapshots of one building: renamed, moved, deleted, added and ambiguous objects with correspondence proposals. | Revision comparison, two-view |
| `schedule` | Delivery, acceptance and installation events per object with dates and gaps. | Delivery timeline, animation |
| `quantities` | Roof faces, finish surfaces, measurements with conflicting values and unassigned finishes. | Takeoff |
| `costs` | Rate sets, currencies, scenario policies, unpriced scopes. | Pricing alternatives |
| `carbon` | Material factors with lifecycle scope and unit mismatches. | Material carbon |
| `assets` | Equipment with maintenance history and points of interest. | Asset handover |
| `clearances` | Equipment envelopes and penetrations with candidate overlaps. | Access coordination |
| `city` | Several buildings with declared geographic anchors. | Portfolio, maps |
| `stress` | N instances across M meshes up to a triangle budget, realistic material mix. | Benchmarks, ten-thousand-object gates |
| `field` | Sampled scalar field on a grid. | Heat maps, voxels |

## Workflow demonstrations

Each workflow demo uses the synthetic fixture by default and switches to Snowdon-backed data where a projection exists. Each is a recipe composed only of public commands, includes its input contract, states whether it is synthetic, source-backed or mixed, and ends with a saved view and a captured image.

1. Room and door schedule with fire-rating review and exceptions.
2. Revision comparison in two linked views with uncertain matches shown as unresolved.
3. Roof and finish takeoff with supported and unsupported subtotals.
4. Pricing alternatives across scenarios with unpriced scope visible.
5. Delivery and installation timeline with distinct delivered, accepted and installed states.
6. Valve isolation trace with affected sets and unverified connections.
7. Penetration and equipment access coordination with sections and envelopes.
8. Asset handover with points of interest and notes.
9. Material carbon heat map with scenario comparison.
10. Portfolio drill-through across the city fixture.
11. Assistant-driven door review through real MCP transport (F23 required demo).

## Agent model and roles

| Role | Model | Use |
|---|---|---|
| Supervisor | this session | Contracts, manifests, lockfile, integration, gates, plan and status |
| Track lead | Opus | Design and implementation of a package or feature family, its tests and demo |
| Mechanical worker | Sonnet | Long simple tasks: porting the 23 alpha demos onto the new host, migrating tests, writing generator fixtures from a spec, generating API docs, license notice audits, bulk renames, running and reporting browser and benchmark suites |
| Reviewer | Opus | Fresh-eyes review of a track against fences and acceptance before integration |

Track leads may spawn sub-agents inside their own fence. Rules for nested agents: pass the parallel-wave and platonic-coder skill paths and the track brief verbatim; assign sub-fences within the parent fence; the parent holds the commit turn on behalf of its sub-agents; the parent checks host concurrency before spawning and reports the count in its checkpoint. Sonnet sub-agents get a written spec and an exact acceptance check; they do not make design decisions.

Every brief includes: F-ID and stage, acceptance cases from the brief, contract revision, exact writable paths, test command, stop-and-reassess condition, and the next handoff.

## Concurrent work in this checkout

At the 2026-09-07 pre-flight review three other interactive sessions were active in this checkout. One is adding prepared BFAST model loading: commit `851a91e` landed during the review and `viewer/packages/loaders` still held uncommitted files (`bfast-writer.ts`, `bim-data.ts`, `bos-to-bfast.ts`, `scripts/`) plus an edit to `viewer/packages/visualization/src/loading.ts`. Rules that follow:

- `viewer/packages/{core,controls,loaders,visualization}/**` are read-only for every V2 track and for the supervisor until the wave 4 cutover. V2 packages consume `@ara3d/viewer-core`, `@ara3d/viewer-controls` and `@ara3d/viewer-loaders` through their published exports at a commit recorded in `V2-STATUS.md`. Track F re-verifies against the loaders package at its HEAD before each checkpoint and reports any export change as a finding.
- BFAST is the default model format across V2 (user decision 2026-09-07, after the measurement in `V2-STATUS.md`): demos, the fixture server, saved-scene references and the beginner path load BFAST; BOS is loaded by converting to BFAST first. Network transfer of the larger file is a later optimization, not a reason to hold the default. The BFAST `RenderModel` in the loaders package (typed-array mesh slices and 64-byte instance records, all views on the file) is the closest existing input to the V2 `RepresentationTable`; Track F builds on it, not on the alpha `InstanceBinding` objects.
- The supervisor edits `viewer/package.json` and the lockfile only to add V2 workspaces and their dev dependencies. Before every such edit run `git status --porcelain`; if another session has changed either file, re-run `npm install` and re-verify before committing.
- Every commit is staged by explicit pathspec. Any modified or untracked file outside the active wave's fences is another session's work: leave it alone, never stage it, and note it in the checkpoint.
- `npm test` at the workspace root includes the alpha packages, whose inputs can change under other sessions. V2 gates run per V2 package; combined runs record alpha results as informational until wave 4.
- Ports 5173 and 5174 may be held by another session. Check before starting a server and record the owner in `V2-STATUS.md`.

## Toolset

- **Skills.** `platonic-coder@platonic` and `parallel-wave@platonic`, both 0.2.0 at marketplace commit `5d8db0b`, installed at user scope and invoked as `platonic-coder:platonic-coder` and `parallel-wave:parallel-wave`. Briefs pass the resolved paths `C:/Users/cdigg/.claude/plugins/cache/platonic/<name>/0.2.0/skills/<name>/SKILL.md`. No copy may exist under `~/.claude/skills` or `.claude/skills`; a copy shadows the plugin.
- **platonic-ts MCP server.** The sibling checkout `../platonic-ts` provides a 33-tool MCP server over a TypeScript code index. It is registered in `.mcp.json` through `tools/platonic-mcp.mts` over `viewer/`, and connects at session start, so a session started before the registration must be restarted. Index scope is `viewer/packages/*/src` and `viewer/packages/*/test`. Every brief says: use `outline`, `symbol`, `usages`, `callers` and `blast_radius` instead of reading whole files or grepping; use `replace_symbol`, `insert_symbol` and `rename_symbol` for edits addressed by declaration name; use `diagnostics` before running the compiler. Smoke test on 2026-09-07: `usages InstancedGroup` returned 82 type-checked uses in 17 files.
- **Strictness retrofit and check gate.** Wave 0 supervisor chunk 1 runs `platonic init viewer --profile standard --yes` from `../platonic-ts`, which writes `viewer/tsconfig.json` (strict plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`; `include` set to `packages/*/src` and `packages/*/test`), `viewer/eslint.config.js` (files scoped to the V2 packages so the alpha and loaders are not linted), `viewer/ratchet.json` (baseline at the current counts) and the `typecheck`, `lint` and `check` scripts with `eslint` and `typescript-eslint` dev dependencies (keep `typescript` at `^5.9.2`). A wrapper `tools/platonic-check.mts` runs the platonic-ts gate steps typecheck, lint, ratchet and tests over `viewer/`. Rules: V2 code adds no escape hatches, so counts only fall; the alpha `npm test`, `demo:check` and `npm run build` must be unchanged after the retrofit, verified before it is committed.
- **Fences.** The supervisor writes `.claude/wave.json` for each wave as the machine-readable copy of the wave table (format: platonic-ts `WaveManifest` with `name`, `supervisor`, `scratch` and `tracks[id].paths`). Whether the platonic-ts hooks enforce it is unresolved decision 5. Without hooks, fences are enforced at the commit turn by inspecting the index against the manifest.
- **Upstream note.** The platonic-ts entry points hardcode their own repository as the target, so this repository uses wrappers under `tools/`. A `--repo <dir>` option upstream would remove them; record it as a platonic-ts backlog item, not V2 work.

## Waves

Capacity: check the actual concurrent agent limit at the start of each wave and keep a ready queue so a finished slot is refilled immediately. Tracks below are ordered by readiness; run as many as the limit allows. Earlier sessions in this repository measured one coordinator plus three workers; other interactive sessions in the same checkout share the machine's CPU, memory, browser and port capacity, so record them in `V2-STATUS.md` at each wave start.

### Wave 0: contracts and skeleton (supervisor plus two Opus leads)

Acceptance: all packages exist with manifests, typecheck and an empty passing test; `model` contracts are reviewed and labelled revision M1; `synthetic` generator API is agreed; baseline gates recorded.

| Track | Writes only | Ready when | Checks |
|---|---|---|---|
| Supervisor | `viewer/package.json`, lockfile, `viewer/packages/*/package.json` for V2 packages only, `viewer/tsconfig.json`, `viewer/eslint.config.js`, `viewer/ratchet.json`, `tools/**`, `.mcp.json`, `.claude/wave.json`, `docs/plans/visualization/V2-STATUS.md` | now | workspace build; alpha `npm test`, `demo:check` and `npm run build` unchanged after the retrofit |
| M (Opus) | `viewer/packages/model/**` | skeleton | `npm test -w @bim-open-toolkit/model` |
| S (Opus) | `viewer/packages/synthetic/**` | model types stubbed | `npm test -w @bim-open-toolkit/synthetic` |

Supervisor chunk order: (1) strictness retrofit, `tools/platonic-check.mts` and the V2 package skeletons in one commit, because the lint gate needs files to lint; verified against the alpha suites first; (2) `.claude/wave.json`, `V2-STATUS.md` and the track briefs for M and S.

Track M delivers: identity, coordinates, sets, style rules with precedence, edits and history, schema combinators, `Result`, facts vocabulary, `Table`, mesh POD, `Feature`, `Command`, `StateSlice` and `Event` contracts. Track S delivers the seeded PRNG, mesh primitives, `building` and `stress` generators; other generators follow in wave 1.

### Wave 1: independent foundations (six tracks)

Ready when revision M1 is acknowledged.

| Track | Writes only | Delivers | Sonnet sub-tasks |
|---|---|---|---|
| F (Opus) | `viewer/packages/formats/**` | Six format adapters producing `LoadedModel` with columnar representations, BFAST first and default (decision 2026-09-07), BOS through conversion to BFAST, resolver, negative fixtures; BFAST versus BOS re-measured on the columnar path | Port alpha loader tests; fixture files |
| R (Opus) | `viewer/packages/render/**` | Instance table, bulk column updates, representation registry, picking, clipping, environment, overlay primitives with click actions, capture, frame timing | Port alpha render tests |
| I (Opus) | `viewer/packages/interact/**` | Camera math, orbit, first-person, overhead, bindings, touch, interruptible animation | Port controls tests |
| S2 (Opus) | `viewer/packages/synthetic/**` | Remaining generators: services, revisions, schedule, quantities, costs, carbon, assets, clearances, city, field | Fixture JSON snapshots and expected-result tables |
| W (Opus) | `viewer/packages/workflows/**` | Ten pure adapters and recipes against synthetic tables; door schedule also against the Snowdon projection format | Expected-row tables written by hand from the spec, not from the implementation |
| T (Opus) | `viewer/packages/testing/**` | Fixture builders, fake clock, headless scene helper, browser runner, benchmark and frame-time protocol | Browser runner scaffolding |

### Wave 2: composition and features (five tracks)

Ready when R, I and F have verified checkpoints.

| Track | Writes only | Delivers |
|---|---|---|
| V (Opus) | `viewer/packages/viewer/**` | `createViewer`, command bus, feature host, slice persistence with migration, multi-view, disposal |
| FA (Opus) | `viewer/packages/features/src/{appearance,sets,edits,replacement}*` | Appearance rules, legends, sets, edit layers, undo, replacement as features |
| FB (Opus) | `viewer/packages/features/src/{clipping,layouts,environment,navigation-aids,hud}*` | Sections, box, manipulators, explode and grid, environment, aids, HUD with FPS and GPU timing |
| FC (Opus) | `viewer/packages/features/src/{annotations,overlays,animation,comparison,storage,capture}*` | Notes, analytical overlays, timeline, linked views, storage adapter, screenshots and thumbnails |
| D (Opus, Sonnet sub-agents) | `viewer/packages/demos/**` | Gallery host on `createViewer`; Sonnet ports the 23 alpha feature demos; fixture server; browser specs |

The `features` package manifest, index and test config are supervisor-owned; FA, FB and FC own only their listed source and test files.

### Wave 3: adapters and workflow demos (up to eight tracks)

Ready when V and at least FA are verified.

| Track | Writes only | Delivers |
|---|---|---|
| G (Opus) | `viewer/packages/ui-gratify/**` | Shell, toolbar, sidebar, legend, status, light and dark theme, big-text, keyboard map; touch validation on synthetic data |
| X (Opus) | `viewer/packages/ui-react/**` | Bindings and the review application with virtualized table, details, color rules, saved views, comparison |
| C (Opus) | `viewer/packages/mcp/**` | Node bridge, generated tools, WebSocket session, client walkthrough and setup docs |
| WD1 to WD4 (Opus each, Sonnet sub-agents) | `viewer/packages/demos/src/workflows/<name>/**` | Workflow demos 1 to 11, about three per track; each ends with a saved view and a captured image |
| P (Sonnet) | `viewer/packages/testing/reports/**` | Run benchmark and frame-time protocols on stress and Snowdon; report per brief section 8 |

### Wave 4: qualification, parity and cutover (supervisor plus reviewers)

- Combined checks against stable inputs: workspace build, all package tests, demo typecheck, browser smoke, Snowdon opt-in, benchmark reports.
- Parity gate: every alpha demo behavior has a V2 equivalent or a recorded deferral decision.
- Remove `viewer/packages/visualization`; archive its docs under `docs/plans/visualization/history/`.
- Generated API reference, quick start, format table, extension guide.

## Acceptance matrix

| Milestone | Brief IDs | Observable proof |
|---|---|---|
| Wave 0 | F01, F27 foundations | Contracts reviewed; synthetic building renders in a headless scene test |
| Wave 1 | F02, F03, F04, F06, F10, F11 basics, F18 primitives, F26 adapters | Package tests; formats gallery on synthetic and fixture files; frame timing reported |
| Wave 2 | F05, F07, F08, F09 composition, F12 to F17, F19 to F21 | Every feature has a slice round-trip test, a command test and a demo; a saved scene restores all installed slices |
| Wave 3 | F09 shell, F23, F26 recipes, React app, docs | Eleven workflow demos; MCP walkthrough over real transport; Gratify shell with themes and big-text |
| Wave 4 | Section 8 performance, section 10 completion criteria | Reports with device, browser and method; parity gate; old package removed |

F22 maps, F24 tracing and F25 mesh-derived voxels stay postponed. The `city` generator and `CoordinateContext` keep the door open for F22; the `field` generator supports a bounds-only voxel preview if capacity remains.

## Gates and resources

- Baseline recorded 2026-09-07 at commit `851a91e` with the concurrent loader files uncommitted: `npm test` in `viewer/` passed 290 tests and skipped 1 across core, controls, loaders and visualization, with no failures. The retrofit dry run over 147 viewer TypeScript files counted 2 `any`, 181 `as` casts, 217 non-null assertions, 0 compiler directives, 0 lint disables and 167 undocumented exports.
- Every tool, check and process rule is scored in [TOOLING-LEDGER.md](TOOLING-LEDGER.md) (cost, defects caught, friction) and reviewed at each wave end; a hindrance is turned off. Track checkpoints carry a "Tooling" section that feeds it.
- Per package: `npm test -w @bim-open-toolkit/<name>`; typecheck through the workspace build; `node ../platonic-ts/node_modules/tsx/dist/cli.mjs tools/platonic-check.mts` for the strictness gate once wave 0 chunk 1 lands.
- Demos: `demo:check`, `demo:build`, browser smoke on software WebGL for function, hardware runs for performance.
- Snowdon: opt-in integration test and HTTP smoke, unchanged from the alpha; one browser lane owned by the supervisor until measured capacity allows more.
- Benchmark protocol: as brief section 8, plus frame-time percentiles over a recorded camera path, HUD disabled, per viewport count.
- Ports: 5173 gallery, 5174 MCP bridge, one headless browser per track requested through the supervisor.

## Unresolved decisions

1. Gratify consumption for publication: pinned submodule build artifacts or an upstream release. Decide before wave 3.
2. MCP transport: a WebSocket bridge from a Node process to the browser session is the default; confirm the client used for the walkthrough.
3. Whether `interact` replaces `@ara3d/viewer-controls` or wraps it. Track I decides in its first chunk and records the reason.
4. Package count: thirteen is deliberate for ownership; merge later only if a boundary proves to have no independent consumer.
5. Fence enforcement by hooks. The platonic-ts PreToolUse and pre-commit hooks refuse edits outside `.claude/wave.json` fences, `git add .` and `commit -a`, and commits that mix owners. Project hooks apply to every session in this checkout, including the concurrent loader work, and the hook code in `../platonic-ts` was itself mid-change on 2026-09-07. Recommendation: do not install them for wave 0; enforce fences at the commit turn instead; revisit at the start of wave 1 when the concurrent sessions and the hook code are stable, and if installed give the concurrent work its own track entry in the manifest.

## Maintaining this plan

Append dated decisions to [README.md](README.md). Rolling status goes to `V2-STATUS.md`, not here. Run `node docs/plans/visualization/check-baselines.mjs` after edits.
