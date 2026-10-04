# Repository split

Status: building

Proposal: [repository-layout.md](../proposals/repository-layout.md). The owner approved the direction on 2026-10-03 and asked that the split be completed before any one product is polished, with every step reversible.

## Goal

Split the toolkit into the repositories of the proposal, so that each one builds on its own and the toolkit consumes them, with no repository checked out twice at different commits:

| Repository | Takes | Phase |
|---|---|---|
| `ara3d/bim-open-viewer` | `viz/` | 2 |
| `ara3d/bim-open-data` | `src/data`, `tests/data`, `BimOpenMcp.Ifc`, `apps/`, `tools/Ara3D.IfcTypeGen`, the building-model tools | 4 |
| `ara3d/bim-open-flow` | the generic part of `src/flow` and `tests/flow`, the editor's web packages, `BimOpenFlow.Ask`, `BimOpenMcp.Flow` | 5 |
| `ara3d/bim-open-notebook` | `bimopenflow/web/packages/bim-open-notebook` and its design | 6 |
| `ara3d/bim-open-toolkit` | what remains: the studio host and pages, the BIM node packs, the samples, the gates, the NRC work | 7 |

## How a repository finds its dependencies

Each repository lists its dependencies in `deps.json` and reads them only from its git-ignored `deps/` folder. `node deps.mjs` fills that folder. The same script is copied into every repository, and the workspace checks that the copies are identical (proposal, question Q4).

```json
{
  "gratify": { "url": "https://github.com/ara3d/gratify", "commit": "a2d1723be6039836bf72cd7865b2fad147083092" }
}
```

For each entry, `deps.mjs` does the first of these that applies:

1. `deps/<name>` already exists: it is left alone, and its commit is compared with the pin.
2. The repository's parent folder is a **deps root**, and `../<name>` exists: `deps/<name>` becomes a link to it (a directory junction on Windows, a symlink elsewhere).
3. Otherwise: the repository is cloned into `deps/<name>`, and a local `main` branch is created at the pinned commit.

A **deps root** is a folder holding a `.deps-root` marker file. The script writes the marker into every `deps/` folder it creates. The workspace repository will commit one at its own root.

The script then repeats this for each dependency's own `deps.json`, so a dependency's dependencies land flat in the same `deps/` folder as siblings. Rule 2 then links them. The result is one copy of each repository per checkout. When the repository's parent is a deps root, the dependencies of dependencies are also linked into its own `deps/`, so `deps/` holds the whole closure in both modes and the build names each repository only as `deps/<name>` (TKT-152). When two pins disagree, the first one wins and the script prints both.

Why a marker, rather than any sibling folder: `~/git/gratify` on the owner's machine is a separate clone at another commit (`f8764ca`, against the toolkit's `a2d1723`). Linking any sibling it found would build against the wrong Gratify without saying so.

`node deps.mjs --check` prints each dependency's mode (linked or cloned), its commit, and whether that matches the pin. Later, the workspace's commit-and-pin command writes the pins.

## Phases

Each phase is its own commit or commits. Each ends with the checks below and lists how to back it out.

**Checks.**
- The full .NET solution builds, and the tests that CI runs pass.
- `node gates/web-smoke.mjs` passes.
- The notebook package's tests and typecheck pass.
- `viz` typecheck passes.
- The studio and 3D pages load in the browser.

**Baseline**, taken on 2026-10-03 before phase 1: see Build log.

0. **Clear the ground.** Done 2026-10-03 (`df2e7e9`, `77a92da`, `bee955d`). The 14 stale ticket claims were released or closed, the IDS skeleton was committed, the meshing data was ignored, and the Parakeet timestamp churn was stashed.
1. **`deps/` on Gratify, inside the toolkit.** Add `deps.mjs`, `deps.json`, and the ignore rule. Point the 10 web configuration files and `viz/package.json` at `deps/gratify` instead of `submodules/gratify`. Remove the Gratify submodule. Make CI run `node deps.mjs`. Run the checks with `deps/gratify` cloned, and again with it linked to a checkout outside the repository, to prove the link case under Vite, tsc, vitest, and npm.
   - Back out: revert the phase's commits, then `git submodule update --init submodules/gratify`.
2. **The viewer.**
   - On `bim-open-viewer`: replace the nested Gratify submodule with `deps.json` and `deps/gratify`, then merge `extraction` into `main`.
   - In the toolkit: delete `viz/`, add `bim-open-viewer` to `deps.json`, and repoint the editor's configuration, 7 scripts, `launch.json`, the gates, and the current documents at `deps/bim-open-viewer`.
   - Back out: revert the toolkit commits. `viz/` returns with its history.
3. **Seams inside the toolkit.**
   - The graph host takes node packs from whoever composes it.
   - The editor takes panes the same way.
   - The BIM composition moves into `BimOpenFlow.Studio`.
   - The layering test is updated.
   - Back out: revert.
4. **`bim-open-data`.** Done 2026-10-03 (toolkit `9b20d0a`, `2e5acdd`, `1977283`; bim-open-data `f7b7496` to `c6916da`). Extract with history, then consume it through `deps/`. Back out: revert the toolkit commits and delete `deps/bim-open-data`. The folders return with their history.
5. **`bim-open-flow`.** Chunks 5c and 5e done 2026-10-03 (toolkit `c6d9250` to `88a611c`; bim-open-flow `204324b` to `f482e4a`); 5d, the public building, is open. As phase 4.
6. **`bim-open-notebook`.** Done 2026-10-04 (toolkit `ffdc3eb`, the repin commit; bim-open-notebook `d5799aa` to `a94ff34`; details in `repository-split-phase-6.md`). As phase 4, after TKT-86. The README has screenshots.
7. **The toolkit as the entry point.** Create the workspace repository, tag the first combination that passes every check, and move `nrc-ifc-llm` to the tag.

## Build log

- 2026-10-03: phase 0 done.
- 2026-10-03, baseline before phase 1:
  - `node gates/web-smoke.mjs` fails in `@bimopenflow/graph` only: `sampleOverlap.test.ts` and four `textOverflow.test.ts` cases. These are sample graph cards overlapping, and text overflowing its card. They are unrelated to the split and filed as TKT-141.
  - Every other step passes: the notebook package (300 tests), the notebook typecheck, and the `viz` typecheck.
- 2026-10-03, phase 1:
  - `deps.mjs` was tested on scratch repositories. Standalone, it clones flat into `deps/`, and nested dependencies link to the shared copy. In a marked workspace, it links everything. A second run changes nothing.
  - The toolkit's web checks give exactly the baseline result in two setups: `deps/gratify` cloned, and `deps/gratify` linked (a Windows junction) to a checkout outside the repository.
  - With the link, the editor's Vite dev server (port 5351) served all 33 Gratify source files from the outside path with `200 OK`, and the page logged no errors. Vite allows files reached through imports even when their real path is outside `server.fs.allow`; only direct requests for other outside files would be refused.
  - Found: `viz` reads Gratify's built output (`dist/`), so a fresh clone needs `npm run build:gratify --prefix viz` (part of `npm run build --prefix viz`) before the `viz` typecheck. The old submodule hid this, because its `dist/` had been built once by hand.
- 2026-10-03, phase 2: `ara3d/bim-open-viewer` `main` is at `35ce03b`: the history, the `@bim-open-viewer/*` names, and Gratify through `deps/`. Its build and typecheck pass; 2,161 V2 tests pass; one cold-start browser test timed out in the full run and passes alone. In the toolkit, `viz/` is removed, `deps.json` pins the viewer, and the viewer's own `deps/gratify` links to the toolkit's, so one Gratify serves both. The editor's alias file is now `bimopenflow/web/viewer.config.ts`. Checks: web smoke at the baseline (TKT-141 only); all seven editor packages typecheck; the notebook passes 300 of 300; the layering tests pass 8 of 8; `/3d.html` on the dev server loads 123 viewer modules from `deps/bim-open-viewer` with no failed module. The ignored local data from `viz/` (206 MB of BFAST fixtures, 1.7 MB of artifacts) was copied into `deps/bim-open-viewer/`; the rest of the old folder is kept outside the repository until the split is accepted.
- 2026-10-03, after phase 2: the full solution builds in Release with no errors. `dotnet test` (the CI filter) passes 47 of 50 test projects; the three failures predate the split and are TKT-143.
- 2026-10-03, phase 4 (`bim-open-data`):
  - Baseline, taken just before: Release build clean; the CI test filter ran 53 projects with 3 failing: the meshing crash catalog and Parakeet (TKT-143), and `BimOpenFlow.Studio.Tests` (one Ask handler test, which passed on the next two runs).
  - Toolkit `9b20d0a`: `bim-open-schema`, `ara3d-sdk`, and `parakeet` became `deps.json` entries at the commits the submodules pointed at. A new MSBuild property, `DepsRoot`, in `Directory.Build.props` states `deps.mjs`'s rule (siblings when the parent folder holds `.deps-root`, else `deps/`); every reference into a dependency goes through it, and bim-open-data's props state it the same way. Without it, MSBuild would reach `ara3d-sdk` by two paths (the toolkit's `deps/ara3d-sdk` and `deps/bim-open-data/deps/ara3d-sdk`, a junction) and treat them as two projects. The Parakeet tests and console app left the solution. Checks: 51 of 52 projects; the meshing catalog failed as before, and `BimOpenMcp.Ifc.Tests` failed once on a temp-folder name collision between parallel test assemblies and passed 64 of 64 alone.
  - `ara3d/bim-open-data`: `git filter-repo` over a fresh clone of the toolkit kept 72 commits touching the moved paths, including their earlier homes (`src/Ara3D.*`, `tests/Ara3D.*`, `src/mcp/Ara3D.Ifc.Mcp`); merged into the repository's two existing commits as `f7b7496`, no force-push. On top: `deps.json`, `deps.mjs` (identical to the toolkit's), props and targets, `BimOpenData.sln`, `tests/BimOpenData.TestSupport`, the three Duplex fixtures under `samples/nrc`, CI, and the README (`fef17e6`, `740654a`); then the tests that read `data/` were tagged `RequiresTestData`, two IFC MCP fixtures stopped failing in TearDown when their model is absent, and the crash catalog skips when none of its models is present (`c6916da`). `Ara3D.Ids` stays out of the solution: it does not compile yet (TKT-50).
  - Fresh clone of `bim-open-data` into an empty folder, `node deps.mjs` (cloned all three from GitHub), Release build: 0 errors. Tests with the CI filter: 10 projects, 0 failures (DoorClearance has only data tests). With the toolkit's `data/` copied in: 11 projects, 0 failures; the newly tagged tests pass with data (8 of 8, 22 of 22). A clone under the session's long scratch path failed checkout on a 260-character path; a short path works.
  - Toolkit `2e5acdd`: the moved folders are gone; `deps.json` pins `bim-open-data` at `c6916da` and drops `parakeet`, which bim-open-data's pin brings in. `node deps.mjs` links `deps/bim-open-data/deps/{bim-open-schema,ara3d-sdk,parakeet}` to the toolkit's copies. The solution lists the 20 data libraries and `BimOpenMcp.Ifc` from `deps\bim-open-data`; their tests, the Browser, and the tools run in bim-open-data's solution instead. The layering test maps `$(DepsRoot)bim-open-data/src/<group>` to its group. Preflight checked five submodules, four of them gone (Gratify since phase 1); it now checks the one submodule and every `deps.json` entry.
  - Checks after: Release build 0 errors; CI filter 41 of 41 projects (52 less the 11 that moved); layering 8 of 8; `BimOpenFlow.NrcWorkflows.Tests` 70 of 70; `node gates/host-smoke.mjs` passes; `scripts/build-mcp.mjs --check` finds both servers, and `BimOpenMcp.Ifc` built from its new path answers `tools/list`. A full `build-mcp.mjs` rebuild could not overwrite the flow server's dlls while running sessions held them.
  - TKT-143 closed: seeding was fixed by `e603d29`, the crash catalog in bim-open-data, Parakeet by leaving the solutions.
  - Debt from this phase:
    - The `ifc-ask` skill exists in both repositories (`.claude/skills/ifc-ask`); the toolkit's agents still read the toolkit's copy.
    - `tests/BimOpenToolkit.TestSupport` and bim-open-data's `tests/BimOpenData.TestSupport` are copies (MiniIfc, RepoPaths), differing in the solution name.
    - `samples/nrc/duplex-base.ifc`, `duplex-enriched.ifc`, and `nrc-metrics.csv` are copied into bim-open-data as test fixtures; the toolkit's are the source.
    - The central NuGet versions are stated in both repositories' `Directory.Build.props`; a drift between them would restore two versions of one package.
    - The toolkit's `data/` and bim-open-data's `data/` are separate fetched copies; the toolkit's `data/get-test-data.ps1` calls bim-open-data's.
- 2026-10-03, phase 3, chunks 3b and 3c (the editor takes panes):
  - `0de55bd`: new package `@bimopenflow/pane-3d` holds the 3D pane and everything that imported `@bim-open-viewer/*` from `panes`, plus `buildLiveViewRecipe` from `client` (it validates with the viewer's schema parser), and exports `view3dPane`. `client` gains `paneRegistry.ts` (`PaneRegistration`, `paneRegistry`, `panesFor`, `genericPanes`, `feedTable`) and `shownNode.ts`; the kind conventions became `PANE_OFFERS`, and `choosePanes(desc)` returns what it did, so the notebook's reply code did not change. A registration has `kind`, `label`, `offer` (tab position or none), `create`, `feed`, and optional `fillHeight`, `keep` (keep the pane across nodes), and `preview` (a result from the document alone). The originals stayed until the notebook switched (`8a6bae1`).
  - `244682a`: `LegendEntry` moved to `panes/src/legend.ts`, so the chart pane needs no viewer type.
  - `f53ee52`: `paneArea.ts` reads the registry; `AppOptions` and `bootEditor` take `panes` (default `genericPanes`) and `templates` (default none). `app` is a library (`@bimopenflow/app`, and `@bimopenflow/app/entry` for entry pages) with a generic `index.html` on port 5304. New package `@bimopenflow/studio-web` serves the toolkit's pages on 5300 and 5308 as before (`studio.html`, `3d.html`, `showcase.html`, `duckdb.html`, an `index.html`), with the Snowdon fixture and `templates.generated.ts`. `launch.json`, `start-bim-flow.mjs`, `bim-flow-processes.mjs`, `build-flow-templates.mjs`, and the web smoke follow.
  - `6c6b891`: the copies left in `panes` and `client` are gone; `client/test/genericPackages.test.ts` fails if `contracts`, `api-client`, `state`, `graph`, `viz`, `client`, `panes`, or `app` depends on or imports `@bim-open-viewer/*` or `@bimopenflow/pane-3d`.
  - Checks: web smoke passes (panes 96, pane-3d 80, client 73, graph 287, app 199, studio-web 17); notebook 302 and its typecheck. In Edge headless with no host, `/studio.html`, `/3d.html`, `/duckdb.html`, and the generic editor load with no module error; the generic page loads 148 modules, none from the viewer (246 before).
  - Left for 3e and phase 5:
    - The C# layering rule for the web packages (3e) can call or mirror `genericPackages.test.ts`.
    - `graph`'s Vite and vitest configs and its `tsconfig` still apply `viewerAlias` (outside this chunk's fence); nothing in `graph` imports the viewer.
    - The classic chrome's default heading links to the Snowdon 3D demo, and `analysisParam.ts` defaults to `snowdon-toolkit`: toolkit words inside the generic editor.
    - `completeTable`, `view3dDataKind`, and `modelUrlFor` stay in `client` because the notebook uses them; they hold 3D wording but no viewer import.
    - `app` still lists `three` as a dependency, which nothing in it imports.
    - `Ara3D.IfcTypeGen` references `Ara3D.Parakeet.Tests` for the EXPRESS file helpers; the 7 Parakeet failures are not yet filed in `ara3d/parakeet`.
    - `deps/gratify` on this machine is at `bcf5f59`, against the pin `a2d1723`; `node deps.mjs --check` reports it. Not changed by this phase.
  - README.md was not edited (the front-page rewrite owns it). The path changes it needs: line 146, `./data/get-test-data.ps1` still works (it now calls `deps/bim-open-data/data/get-test-data.ps1`; run `node deps.mjs` first); the layout table rows `src/data/` and `apps/` move to a row for `deps/bim-open-data` (BOS, IFC, the IFC MCP server, the BOS Browser, the type generator, from `ara3d/bim-open-data`); the `src/mcp/` row holds only `BimOpenMcp.Flow`, with `BimOpenMcp.Ifc` at `deps/bim-open-data/src/mcp/BimOpenMcp.Ifc`; `submodules/bim-open-schema` becomes `deps/bim-open-schema` and `submodules/ara3d-sdk` becomes `deps/ara3d-sdk`, both filled by `node deps.mjs`.

## Next, in order

What remains, as of 2026-10-03. Each item says why it is in this place.

1. **Owner: switch on GitHub Pages and sign in `gh` (TKT-142).** Every repository now has a Pages workflow, but no page is live until Pages is switched on (Settings, Pages, Source: GitHub Actions). One click per repository; nothing else is blocked on it except seeing the pages.
2. **Fix the red checks that predate the split: TKT-141 (graph card layout, fails the web smoke) and TKT-143 (three .NET test projects).** The split's own checks compare against the baseline. A green baseline makes every later phase's verdict a plain pass or fail.
3. **Phase 3: cut the seams inside the toolkit.**
   - The host takes node packs from whoever composes it; today `HostComposition.cs` names `Nodes.Bos` and `Nodes.BimAnalysis`.
   - The editor takes panes the same way; the 3D pane imports `@bim-open-viewer/*` in `panes/`.
   - The notebook takes embeds the same way.
   - The BIM composition moves into `BimOpenFlow.Studio`.

   Phases 4 and 5 cannot extract cleanly until this lands.
4. **Phase 4: `bim-open-data`.** `src/data` has no references upward, so it lifts out with its tests, the IFC MCP server, the BOS Browser, and the type generator. The repository's README is in place (written 2026-10-03); the code follows it.
5. **Phase 5: `bim-open-flow`.** It takes the generic projects of `src/flow`, the editor's web packages, `BimOpenFlow.Ask`, and `BimOpenMcp.Flow`, plus a small public building as DuckDB tables, so its landing page can run graphs over a building without the toolkit. Decide first whether `ara3d-dataflow` folds in (proposal Q6; the reviewer said keep it separate).
6. **Phase 6: `bim-open-notebook`'s code.** Done 2026-10-04; see `repository-split-phase-6.md`. The code builds the page in the repository's own CI.
7. **Phase 7: the toolkit as the entry point.** Create the workspace repository with flat siblings and a `.deps-root` marker, tag the first combination that passes every check, and move `nrc-ifc-llm` to the tag. Its documents name paths under `bim-open-toolkit/viz/` that phase 2 removed.
8. **Live runs that close nearly-finished tickets:** TKT-45 (one Ask box run that builds a graph through the Claude CLI) and TKT-80 (one multi-turn notebook run, plus the web smoke). Then the notebook defects TKT-139 (3D legend) and TKT-140 (underscores).

**Demos per repository**, which the owner asked for on 2026-10-03, and where each stands:

| Repository | Demo | State |
|---|---|---|
| `bim-open-viewer` | The gallery as a static page over synthetic buildings | Built by a subagent on 2026-10-03 (see its README) |
| `bim-open-notebook` | The 12 sample notebooks, opened from their snapshots, no server | Built on 2026-10-03 from the toolkit's package |
| `bim-open-flow` | Graphs over a public building in DuckDB, in the browser | Needs phase 5 and a way to run the host's evaluation in the browser or a hosted host; until then the page describes and shows screenshots |
| `bim-open-data` | IFC to BOS in the browser (web-ifc) and the BOS Browser | Needs phase 4; until then the page describes |
| `bim-open-toolkit` | The family page linking every live demo | Built on 2026-10-03 at `site/` |
- 2026-10-03, public faces (subagents, checked headless in Edge, none live until Pages is switched on, TKT-142):
  - `bim-open-viewer`: `npm run pages` builds the gallery as a static site over generated buildings; `npm run pages:smoke` loads the landing page and all five demos and fails on any that does not draw (passed). Viewer mark and lockup in teal. Viewer `main` `5141ec7`, pinned in the toolkit.
  - `bim-open-notebook`: README (the interaction model, honest status) and `site/`, which opens the 12 sample notebooks from their snapshots with no server; built by the toolkit's new `build:pages` script in the notebook package (tests 303 of 303).
  - `bim-open-data`, `bim-open-flow`: READMEs that say what moves there and when, landing pages, Data mark in rose.
  - Toolkit `site/`: the family page, one card per repository with its status; `docs/BRANDING.md` lists four products.

## Execution order (owner: "do it all", 2026-10-03 evening)

Waves run in this order. Agents within a wave have disjoint fences; a wave starts when the one before it has committed and passed its checks.

- **Wave A**, in parallel:
  - A1: TKT-141 (graph card layout; `bimopenflow/web/packages/graph/**`, sample graph layouts).
  - A2: TKT-139 and TKT-140 (notebook 3D legend, underscores; `bimopenflow/web/packages/bim-open-notebook/**`, `panes/src/viewPane3D.ts`, `panes/src/instanceLegend.ts`).
  - A3: phase 4, `bim-open-data`. It owns all .NET building in the checkout during the wave. It also moves the `bim-open-schema`, `ara3d-sdk`, and `parakeet` submodules to `deps/`, so the data repository and the toolkit share one copy of each, and it settles the rest of TKT-143 (meshing, Parakeet).
- **Wave B**: phase 3, the seams: host packs, editor panes, notebook embeds, BIM composition in `BimOpenFlow.Studio`.
- **Wave C**: phase 5, `bim-open-flow` (with `ara3d-dataflow` moved to `deps/`, kept as its own repository).
- **Wave D**: TKT-86, then phase 6, the notebook's code into `bim-open-notebook`.
- **Wave E**: phase 7: the workspace repository, a tag, and `nrc-ifc-llm` moved to the tag.
- 2026-10-03, chunk 3d: the notebook's embed renderers are a registry its page fills. `defaultRenderers` has no `view3d`; `withRenderers` adds it; `src/page/view3dEmbed.ts` is the one file importing the 3D pane, and `page/main.ts` registers it. A kind with no renderer shows its caption. Notebook: 302 tests, typecheck clean; the rebuilt static site opens s06-paper-figures with both 3D embeds. `page/nrc.ts` mounts no notebook, so it needs no registration.
- 2026-10-03, chunk 3a (toolkit `e6fd67a`, `cb11a32`): the graph host takes profiles from whoever composes it.
  - `BimOpenFlow.Host` names no BIM pack and no longer references `Nodes.Bos`, `Nodes.BimAnalysis`, `Nodes.Geometry`, `Nodes.Compliance`, or `Ara3D.Ifc.DuckDb`. `HostProfile` (packs, seeded model roots, seeding, background jobs) and `HostProfiles` (the set and its default) are the seam; `HostComposition.Generic` offers only `tables`, now the default of `bimopenflow-host` and `bimopenmcp-flow`. `SampleSeeding.FindRepoRoot` looks for any `*.sln`.
  - `BimOpenFlow.Studio` composes the `bim` profile (`StudioComposition`: `BimPacks`, `Bim`, `Tables` with the NRC graphs and jobs, `Profiles` with default `bim`). `BimSampleSeeding` moved there; the NRC constants and jobs are `NrcSamples` and `NrcPreparation`. `bimopenflow-studio mcp` serves the flow MCP tools over the studio's profiles; `bimopenflow-studio nodedocs [dir]` writes `nodes.md` and `nodes.catalog.json`. The generic `BimOpenFlow.NodeDocs` now requires an output path.
  - Adapted from the plan: Compliance stays in `NodeDocsProgram.GenericPacks` (it moves to flow in phase 5), so the studio prepends only Bos, BimAnalysis, and Geometry and the page order is unchanged; the catalog file comes from the same verb through `NodeCatalogFile`, not only from a test; the generic parts of `CompositionTests` stay in the host tests and the BIM parts went to a new `StudioCompositionTests`.
  - Tests: `BimWorkflows`, `NrcWorkflows`, and `SampleFlows` moved to `tests/studio`; CI's NRC gate follows. `NrcSeedingTests`, `NodeCatalogFileTests`, and the NRC job test moved to `Studio.Tests`. Host and MCP fixtures use `table.inline` instead of `view3d.camera`.
  - Checks: Release build 0 errors; CI filter 41 of 41 projects (`BimOpenMcp.Flow.Tests` failed once on a node-order assertion this chunk introduced, fixed, 50 of 50); `NrcWorkflows` 70 of 70 at its new path; layering 8 of 8; `node gates/host-smoke.mjs` passes for both the studio (112 kinds) and the generic host (83); `bimopenflow-studio nodedocs` reproduces both files byte for byte; over stdio the studio's `mcp` verb lists `bos.load` and `bimopenmcp-flow` does not.
  - Left for the web agent's files: the `host` script in `bimopenflow/web/package.json` and the `.claude/launch.json` entries that run `src/flow/BimOpenFlow.Host` with `--profile bim` must run `src/studio/BimOpenFlow.Studio` instead. Outside every fence: `scripts/nrc-walkthrough.mjs` builds and starts `bimopenflow-host` with `--profile bim` and `tables` (expecting NRC seeding), so it must build the studio; comments in `gates/all.mjs`, `scripts/demo-ifc-mcp.mjs`, `scripts/seed-store.mjs`, `src/flow/README.md`, and the documents name the old paths.
  - Debt: `NodeNotes.cs` in `NodeDocs` still holds the notes for `bos.*`, `bim.*`, and `view3d.*`; the studio's tables profile differs from the generic one only by the NRC samples, which phase 5 must keep in the toolkit.
- 2026-10-03, chunks 3e, 5a, 5b (toolkit `9421b22`, `4c7088f`; `bae67f0`, `e8a5f54`; `382d18b`, `3400253`, `c2819a5`):
  - 3e: the hand-written notes for `bos.*` and `view3d.*` moved from `NodeDocs` to the studio's `BimNodeNotes`; `NodeDocsProgram.Run` takes the notes beside the packs. New `BimSeamTests`: every project that moves to flow (all of `src/flow`, `src/mcp`, `tests/flow`, `tests/mcp`, `tests/BimOpenFlow.TestSupport`, and `src/studio/BimOpenFlow.Ask`, less the `Stays` list) references no BIM pack, no `Ara3D.Ifc.Mesher`, nothing in studio, and not the toolkit's TestSupport; `NodeNotes.Generic` names only generic kinds; the two vitest files holding the web seam exist. Rule 2 of the plan (no flow or mcp project references studio) was already `LayeringTests`; rule 3's `@bimopenflow/bim-open-notebook` is not in `genericPackages.test.ts` (no package violates it). ARCHITECTURE.md has an "Enforced boundaries" section and says where the bim profile lives.
  - 5a: `ara3d-dataflow` is a `deps.json` entry at `54479a9`; 71 references in 42 projects and the solution go through `$(DepsRoot)ara3d-dataflow`. No submodule remains: `.gitmodules` is gone, CI checks out without `--recursive`, preflight checks only `deps.json`. The engine's 7 test projects stay in the solution. README and START.md no longer run `git submodule update`.
  - 5b: `tests/BimOpenFlow.TestSupport` (root = any `*.sln`) serves Host, Nodes.Effects, Nodes.Relations, Nodes.Tables tests. `RepoDocToolTests` reads a fixture repository. The graph package's tests read `samples/{analyses,relations,tables}` and a generic catalog at `packages/graph/test/nodes.catalog.json`, kept current by `GenericNodeCatalogFileTests`.
  - Checks after each chunk: Release build 0 errors; CI filter 41 of 41 projects; `NrcWorkflows` 70 of 70; layering 13 of 13; host smoke and web smoke pass. After 5a, `node deps.mjs --check`: `ara3d-dataflow` cloned at `54479a9`, matches pin.
  - Open for 5c:
    - `BimOpenFlow.TableWorkflows.Tests` stays (Federation, Snowdon) but is also the only test of `samples/analyses` (golden, seeding); split the generic half off before extracting.
    - `Host.Api.Tests` and `Host.Catalog.Tests` read `samples/nrc/duplex-enriched.bos` and ignore their BOS tests when it is absent, so in flow they would be skipped until 5d's public building.
    - `BimOpenFlow.Ask.Tests` is not yet split from `Studio.Tests`.
    - The toolkit lost overlap and text-overflow coverage of its BIM sample graphs; `studio-web` can call `sampleGraphs(dirs)` with `docs/nodes.catalog.json`.
    - `deps/bim-open-viewer` on this machine is at `22a8c85`, against the pin `b0ec646`.
- 2026-10-03, phase 5, chunks 5c and 5e (`bim-open-flow`):
  - Unblocked in place (toolkit `c6d9250`, `2abb69a`, `cd85df3`, `0d79c47`, `7081e0a`): `TableWorkflows.Tests` keeps the tests of `samples/tables` and `samples/analyses`; DuckDbWorkflowCatalog and the Snowdon federation tests went to a new `tests/studio/BimOpenFlow.SnowdonWorkflows.Tests`, which borrows `SampleFixtures` and `TableReads` by referencing the TableWorkflows project. `BimOpenFlow.Ask.Tests` split from `Studio.Tests` (the AskIds tests stayed: they test the studio's endpoint). Host.Catalog and Host.Api tests write `SampleBos`, 120 synthetic walls built with `BimDataBuilder`, instead of reading the Duplex BOS (TKT-144); the file is shared by a linked Compile item, because the layering rule keeps TestSupport free of references. `studio-web/test/sampleCards.test.ts` checks the toolkit's 71 sample graphs against `docs/nodes.catalog.json` for unknown kinds, overlap, and text overflow; the overflow checks moved to `graph/scripts/cardOverflow.ts`, and `sampleGraphs` and `relayout-samples` take a root.
  - Extracted (5c): `git filter-repo` over a fresh clone at `C:\Users\cdigg\git\_split\flow` kept 370 of 1,224 commits: the 69 current paths plus the moved projects' earlier homes (`src/BimOpenFlow.*`, `tests/BimOpenFlow.*.Tests`, `src/BimOpenFlow.Mcp`, `src/mcp/BimOpenFlow.Mcp`) and the single files that moved in from `Nodes.Bos`, the studio, and the notebook, found by following renames backwards. The filtered tree matched the toolkit's 805 files exactly. Merged into bim-open-flow's three commits as `204324b`, no force-push. On top: `deps.json` (ara3d-dataflow `54479a9`, bim-open-data `c6916da`, gratify `bcf5f59`), props and targets with `DepsRoot`, `BimOpenFlow.sln` (52 own projects, 25 from deps), `tests/BimOpenFlow.Layering.Tests` (references point down; no BIM pack or mesher; no web package depends on or imports the viewer, pane-3d, the notebook, or studio-web; test support references nothing; the node-pack rules; generic node notes), the web workspace root with the toolkit's lock less the toolkit packages, the two gates, CI, and the README (`19140e0`, `52ae0d0`, `f13d3ff`). Then `a97bb93`: the tables profile seeds from `SampleSeeding.SamplesRoot`, the checkout the host was compiled from (found from the source file, as `RepoPaths` does), so a host composed by the toolkit still finds bim-open-flow's samples; `f482e4a` moves the node-notes rule there.
  - Standalone check: fresh clone of bim-open-flow at `C:\Users\cdigg\git\_split\fc`, `node deps.mjs` (cloned all six from GitHub), Release build 0 errors, tests with the CI filter 25 of 25 projects (1,014 tests, two skip without `data/`), `npm ci`, web smoke (api-client 22, viz 48, state 56, panes 96, client 73, graph 288, app 199; typechecks clean; app builds), host smoke (83 kinds).
  - Consumed (5e, toolkit `83a14a5`, `b48e2c4`, `7206b30`, `88a611c`): the moved folders are gone; `deps.json` pins bim-open-flow at `f482e4a`, and `node deps.mjs` links `deps/bim-open-flow/deps/{ara3d-dataflow,bim-open-data,gratify}` to the toolkit's (`--check`: no warning). References go through `$(DepsRoot)bim-open-flow/...`; the solution lists the 26 flow libraries from there. The web workspace takes the eight packages as `file:` dev dependencies with `overrides`; `flow.config.ts` aliases them to source from their package.json exports, and `deps.tsconfig.json` (was `viewer.tsconfig.json`) holds every path into deps/ for tsc. `bfast-buffers` moved to `samples/showcase-tables` with `{SAMPLES}` = bim-open-flow's `samples/tables`. The layering test maps `deps/bim-open-flow/src/<group>` to its group; `BimSeamTests` went, its rules now bim-open-flow's.
  - Checks after: Release build 0 errors; CI filter 19 of 19 projects (43 before; 24 test projects moved), 1,534 tests; NrcWorkflows 70 of 70; layering 10 of 10; host smoke (studio 112 kinds, generic host 83) and web smoke pass; `bimopenflow-studio nodedocs` reproduces `docs/nodes.md` and `docs/nodes.catalog.json` byte for byte; in headless Edge (Playwright from the viewer's `playwright-core`, swiftshader) `/studio.html` and `/3d.html` on a Vite server load 119 and 121 modules from `deps/bim-open-flow` and 122 from the viewer with no module error or failed request (no host was running, so `/api` calls were excluded).
  - Not done: the checks with `deps/bim-open-flow` linked to a sibling checkout instead of cloned; 5d, the public building (TKT-144 now names Schependomlaan under CC BY 4.0 as an alternative to the Duplex); open tickets whose fences name moved paths (the editor's TKT-23, 107, 110, 124, 125 and others) still live here.
  - Debt: `SampleBos` is shared between two test projects by a linked source file; `SnowdonWorkflows.Tests` references a test project in another repository; the toolkit's lock and bim-open-flow's pin the same third-party versions independently; the generic editor (`bof-editor-generic`, `npm run web:generic`) needs `npm ci` inside `deps/bim-open-flow/bimopenflow/web`; `bimopenflow/web/packages/app` is left as an empty folder a running process held; the untracked local store in `src/flow/BimOpenFlow.Host/artifacts` (636 KB) was moved to `C:\Users\cdigg\git\_split\toolkit-leftovers`.
