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

The script then repeats this for each dependency's own `deps.json`, so a dependency's dependencies land flat in the same `deps/` folder as siblings. Rule 2 then links them. The result is one copy of each repository per checkout. When two pins disagree, the first one wins and the script prints both.

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
4. **`bim-open-data`.** Extract with history, then consume it through `deps/`. Back out: revert. The folders return with their history.
5. **`bim-open-flow`.** As phase 4.
6. **`bim-open-notebook`.** As phase 4, after TKT-86. Write the README with screenshots at this point.
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
6. **Phase 6: `bim-open-notebook`'s code.** After TKT-86 (the client library) and phase 5. The README and the static sample page are already in that repository; the code then builds the page in its own CI.
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
