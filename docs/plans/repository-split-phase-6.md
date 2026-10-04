# Repository split, phase 6: the notebook moves to bim-open-notebook

Written 2026-10-03 by a planning agent against toolkit `fa1a461` (phase 5 landed). Parent plan: `repository-split.md`; proposal: `../proposals/repository-layout.md` section 5.1. Infrastructure: it serves the developer user and must keep workflows 2 and 6 of `PROJECT.md` passing.

## Acceptance criteria

1. **The notebook builds alone.** In a fresh clone of `ara3d/bim-open-notebook` at a short path, with no toolkit anywhere: `node deps.mjs`; `npm ci` and `npm run build` in `deps/bim-open-viewer`; `npm ci` in `bimopenflow/web`; `node gates/web-smoke.mjs` (tests and typecheck of `@bimopenflow/bim-open-notebook` and `@bimopenflow/pane-3d`, plus `build:pages`) all pass.
2. **It never depends on the toolkit.** Its `deps.json` lists only `bim-open-flow`, `bim-open-viewer`, `gratify`, `bim-open-data`; `node deps.mjs --check` shows no `bim-open-toolkit`. A seam test fails on any import of `@bimopenflow/app`, `studio-web` or `nrc-web`, and on any string naming `samples/nrc-analyses`, `{SNOWDON}` or `BIMOPENFLOW_SNOWDON`.
3. **History arrives, nothing is force-pushed.** `git log --follow` on `bimopenflow/web/packages/bim-open-notebook/src/document/format.ts` reaches the rewrite of toolkit `3b82b3e`; on `pane-3d/src/viewPane3D.ts` it reaches its `panes` commits; the old head `9b60c5f` is an ancestor of the new `main`.
4. **Pages is built from source.** The Pages workflow builds `site/app` in CI and `site/app` is no longer committed. The built site opens at least three public-building notebooks (Schependomlaan, DigitalHub, Duplex) with no page error, and links `NOTICE.md`.
5. **Public samples match the data.** Each public sample's headline numbers equal `deps/bim-open-data/samples/public/samples.json`; `test/samples.test.ts` reads that file rather than hard-coding numbers.
6. **The toolkit takes both packages through `deps/`.** The two package folders are gone from the toolkit; `deps.json` pins `bim-open-notebook`; the toolkit checks pass (Release build, CI filter, layering, host smoke, web smoke with `studio-web` and `nrc-web`, `NrcWorkflows` 70 of 70); in headless Edge `/studio.html`, `/3d.html`, and on port 5350 `/nrc.html` and `/notebook.html?notebook=nrc-eight-questions` load with no module error; the 12 sample notebooks still pass their answer tests (Q1 37,196.2 kgCO2e/yr; DC-W1 8 Pass, 6 Fail).
7. **Both dependency modes are checked:** criterion 6 runs with every `deps/` entry cloned and again with links to siblings under a `.deps-root` folder.
8. **No dependency loops back:** a toolkit layering test fails if any `deps/*/deps.json` pins `bim-open-toolkit`.
9. **It can be backed out:** reverting the toolkit's phase 6 commits restores both packages with history; `git revert -m 1` of the merge restores bim-open-notebook's earlier tree.

Out of scope: renaming the npm scope or flattening `bimopenflow/web/packages/`; moving `/api/ask` out of the studio host; finishing TKT-80; publishing to npm; publishing the NRC notebooks on the toolkit's Pages; moving tickets; splitting pane-3d's viewer-only modules into the viewer.

## Design

**`@bimopenflow/pane-3d` moves to bim-open-notebook, as its own package beside the notebook.** It depends on four flow packages and nine `@bim-open-viewer/*` packages, and is used by the toolkit's `studio-web` and by the notebook's `view3dEmbed.ts`. The notebook already depends on flow and the viewer, the toolkit will depend on the notebook anyway, proposal 5.1 puts every embed renderer there, and flow's README and layering test (`BimOnlyWeb`) forbid the pane in flow. It stays a separate package so the editor pages can take it alone; a new rule says pane-3d imports nothing from the notebook package. To move it later: the same filter-repo move into the new home, and three entries per consumer (`file:` path, `deps.tsconfig.json` paths, alias folder in `deps.config.ts`).

| Path in the toolkit | Goes to | Notes |
|---|---|---|
| `bimopenflow/web/packages/bim-open-notebook/**` less the NRC files | bim-open-notebook, same path | earlier home `packages/notebook/` included for history |
| `bimopenflow/web/packages/pane-3d/**` | bim-open-notebook, same path | plus earlier homes under `panes/` and `client/src/liveViewRecipe.ts` |
| `viewer.config.ts`, `flow.config.ts`, `deps.tsconfig.json` | bim-open-notebook, copies | planned debt |
| `docs/proposals/notebook-sessions.md`, `docs/plans/notebook.md` | bim-open-notebook | toolkit keeps one-line links |
| `nrc.html`, `src/page/nrc.ts`, `nrcView.ts`, NRC half of `nrcCatalog.ts`, NRC tests and answer cases, the `nrcGraphs()` Vite plugin, `snowdonPath()` | new toolkit package `@bimopenflow/nrc-web` | they read `samples/nrc-analyses`, `samples/nrc` and Snowdon |
| `samples/notebooks/**` (12 notebooks) | stays in the toolkit | their graphs and data are the toolkit's |
| notebook tickets (TKT-80, 87, 88, 90, 91, 104, 105) | stay in `tickets/`, fences rewritten | |

**Consumption afterwards** follows phase 5e: `deps.json` gains `bim-open-notebook`; `bimopenflow/web/package.json` gains `file:` devDependencies and overrides for both packages; `deps.tsconfig.json` gains their paths; `flow.config.ts` becomes `deps.config.ts` exporting `packagesAlias(dir)`, `flowAlias` and `notebookAlias`. `nrc-web`'s Vite config imports the notebook's Vite plugins by a relative path into `deps/`, since Node cannot load a bare `.ts` specifier. `nrc-web` serves on 5350 and takes the `notebook-web` launch entry; the notebook repository's own dev server moves to 5354.

### Signatures

```ts
// bim-open-notebook/vite/samples.ts (export "./vite")
export const NOTEBOOK_SUFFIX = ".notebook.json";
export function sampleNotebooks(dir: string): Plugin;              // dev: GET /__notebooks/ and /__notebooks/<name>
export function bundleSamples(dir: string, lead: readonly string[] = []): Plugin; // build: notebooks/, index.json, catalog.json

// bim-open-notebook/src/page/catalog.ts (generic half of nrcCatalog.ts)
export interface NotebookEntry { readonly name: string; readonly title: string; readonly profile?: string;
  readonly turns: number; readonly firstRequest?: string; readonly reconstructed: boolean; }
export function notebookEntry(file: string, text: string): NotebookEntry | { readonly errors: readonly string[] };
export function orderNotebooks(entries: readonly NotebookEntry[], lead: readonly string[] = []): NotebookEntry[];

// bim-open-notebook/src/page/entry.ts (export "./page")
export function startNotebookPage(options?: { readonly renderers?: EmbedRegistry; readonly root?: HTMLElement }): Promise<void>;

// bim-open-notebook/scripts/outline.ts
export type Placeholders = ReadonlyMap<string, string>;
export function parsePlaceholders(argv: readonly string[]): Placeholders;   // "--placeholder NAME=path", repeats are errors
export function expandPlaceholders(text: string, graphPath: string, placeholders: Placeholders): string;
export function hidePlaceholders(text: string, placeholders: Placeholders, root: string): string;
export function outlineRoot(outlinePath: string): string;

// bim-open-notebook/scripts/embedLayouts.ts
export function sampleGraphFiles(notebookName: string, samplesDir: string, analysesDirs: readonly string[]): Map<string, string>;

// toolkit nrc-web/src/nrcCatalog.ts
export interface GraphEntry { readonly id: string; readonly answers: string; readonly profiles: string; readonly viewer3d: boolean; }
export function parseGraphTable(markdown: string): GraphEntry[];
export const NRC_LEAD = ["nrc-eight-questions", "nrc-test-kit", "nrc-door-check"] as const;
```

```csharp
// toolkit tests/BimOpenToolkit.Layering.Tests/DepsCycleTests.cs
public class DepsCycleTests { [Test] public void NoDependencyPinsTheToolkit(); }
```

Worked examples: `expandPlaceholders('{"path":"{PUBLIC}/schependomlaan.duckdb"}', "g.json", {PUBLIC: "C:/w/nb/deps/bim-open-data/samples/public"})` gives the absolute path, and `hidePlaceholders` turns it back; with no `SNOWDON` entry a graph naming `{SNOWDON}` throws `g.json needs {SNOWDON}; pass --placeholder SNOWDON=<path>`. `orderNotebooks([s01, nrc-door-check, nrc-eight-questions], NRC_LEAD)` gives `[nrc-eight-questions, nrc-door-check, s01]`.

## Considered and rejected

- **pane-3d in bim-open-viewer:** the viewer would depend on flow (reverses the direction). Reconsider if the flow-facing half is cut away.
- **pane-3d in bim-open-flow:** flow says it draws no 3D and its layering test forbids the pane; the `view3d.*` nodes stay in the toolkit; flow would pin the viewer. Reconsider if flow takes the geometry nodes.
- **Split pane-3d now** (viewer-only modules to `@bim-open-viewer/recipe`): mixes a refactor into a move. Extension point.
- **Move the 12 sample notebooks:** their graphs live in `samples/nrc-analyses`, `s10-snowdon` is Autodesk-derived (TKT-144), the NRC CSV has no recorded licence.
- **Keep committing `site/app`:** a built artefact drifts, and today only the toolkit can rebuild it.
- **Move the NRC page with the notebook:** it reads `samples/nrc-analyses`; proposal 5.1 keeps it in the toolkit.

## Planned debt

| Copy | From | Payoff |
|---|---|---|
| `viewer.config.ts`, `flow.config.ts`, `deps.tsconfig.json` in the notebook | toolkit `bimopenflow/web/` | flow and the viewer export a consumer alias module, or publish npm packages (proposal 8.5); ticket in 6.13 |
| building paragraphs of the notebook's `NOTICE.md` | `bim-open-data/samples/public/NOTICE.md` | test in 6.8 fails on drift; ticket to serve one NOTICE |
| `deps.mjs` | toolkit | existing policy: copies kept identical |
| `snowdonPath()` in `nrc-web` | `BimSampleSeeding.SnowdonPath` | existing debt, carried over |

Extension points: scope rename and flattened paths; a live 3D embed for public notebooks (`modelPathFor`, or a generic BOS-to-instance-table node); `/api/ask` on flow's generic host; `deps.mjs --only <names>`; NRC notebooks on the toolkit's Pages; `@bim-open-viewer/recipe`.

## Risks

1. Concurrent notebook work: freeze TKT-80, 87, 88, 90, 91, 104, 105 from 6.2 until 6.11 is committed.
2. Two copies of `three` or Gratify through a linked `deps/` entry: overrides, `packagesAlias`, `dedupe: ["three"]`; 6.11 checks three's `REVISION` appears once in the built bundle.
3. Two pins of bim-open-data (`eb7ec19` has `samples/public`; flow and the toolkit pin `c6916da`): 6.1 aligns them first.
4. Three viewer packages resolve to `dist/`: every notebook CI job builds the viewer first.
5. CI time: the notebook's `deps.mjs` clones eight repositories for a web-only build.
6. Windows path length: extract and check at `C:\Users\cdigg\git\_split\nb`.
7. pane-3d's panes-era history is already in flow; extracting it again duplicates it harmlessly.
8. Public notebooks may get no live 3D (generic graphs name `.duckdb`): see spike 6.5.
9. Snowdon-derived `s10-snowdon.notebook.json` was public in bim-open-notebook's `site/app`: withdrawn 2026-10-03 (`957f5c7`); still in history.
10. Regenerating public samples needs a .NET host from flow: CI checks snapshots only.

## Open questions (with defaults)

1. Public site content: only the notebook repository's own public-building notebooks; the three NRC Duplex notebooks stay in the toolkit because the NRC analytics CSV has no recorded licence.
2. Ticket home: notebook tickets stay in the toolkit until phase 7; 6.13 rewrites fences to `bim-open-notebook:` paths.
3. Package names: keep `@bimopenflow/bim-open-notebook` and `@bimopenflow/pane-3d`.

## Chunks

"Toolkit checks" = Release build, `dotnet test` with the CI filter, `NrcWorkflows`, layering, `gates/host-smoke.mjs`, `gates/web-smoke.mjs`, `/studio.html` and `/3d.html` in headless Edge.

| Chunk | Repository | Work | Fence | Test | After |
|---|---|---|---|---|---|
| 6.0 | — | gate: phase 5 committed, fences clean, no notebook ticket in progress | — | — | — |
| 6.1a | flow | pin bim-open-data `eb7ec19` | `deps.json` | fresh clone: deps, Release, CI filter, host smoke | 6.0 |
| 6.1b | toolkit | pin bim-open-data `eb7ec19` and flow at 6.1a | `deps.json` | toolkit checks; `deps.mjs --check` clean | 6.1a |
| 6.2 | toolkit | notebook takes samples folder, placeholders, analyses folders and lead list from its caller (refactor; new `vite/samples.ts`, `src/page/catalog.ts`, `src/page/entry.ts`, package exports) | `packages/bim-open-notebook/**` | 303 notebook tests, typecheck; `build:pages` same file list and catalog order | 6.0 |
| 6.3 | toolkit | NRC page and the toolkit's notebook page move to new `@bimopenflow/nrc-web` (`git mv`) | `packages/nrc-web/**`, the notebook's NRC files and Vite configs, web `package.json` and lock, `launch.json` `notebook-web`, `gates/web-smoke.mjs`, `samples/notebooks/README.md`, `docs/DEMOS.md`, `docs/nrc-walkthrough.md` | nrc-web plus notebook tests ≥ 303; headless Edge on 5350; web smoke | 6.2 |
| 6.4 | toolkit | seam tests for notebook and pane-3d | two new `seam.test.ts`, `WebSeamTests.cs` | fail on a planted import | 6.3 |
| 6.5 | — | one-hour spike, no commit: can generic nodes on `bimopenflow-host --models <public>` colour `schependomlaan.bos` from a DuckDB query in a notebook 3D embed? | `_split\spike` | answer written here | 6.1a |
| 6.6 | notebook | filter-repo the "What moves" rows from a fresh toolkit clone at `_split\nb`, merge `--allow-unrelated-histories`, push | merged paths only | criterion 3; `git diff 9b60c5f HEAD -- site README.md` empty | 6.4 |
| 6.7 | notebook | build alone: `deps.json`, `deps.mjs`, `.gitignore`, web `package.json` and lock, `gates/web-smoke.mjs`, `.github/workflows/build.yml`, dev port 5354 | those files | criteria 1 and 2 in a fresh clone | 6.6 |
| 6.8 | notebook | public sample notebooks (Schependomlaan first look; DigitalHub heating; Duplex door widths and an honest-absence turn) with `NOTICE.md` | `samples/notebooks/**/p0*`, README, `NOTICE.md`, `test/samples.test.ts`, `test/notice.test.ts` | criterion 5; NOTICE lists every file; NOTICE sections equal bim-open-data's | 6.7, 6.5 |
| 6.9 | notebook | Pages builds `site/app` from source | `pages.yml`, `site/app` removed and ignored, `vite.pages.config.ts`, `site/index.html`, `src/page/site.ts`, `gates/pages-smoke.mjs` | criterion 4 locally and in CI | 6.8 |
| 6.10 | notebook | README with screenshots | `README.md`, `docs/images/**` | every command run in a fresh clone | 6.9 |
| 6.11 | toolkit | consume the notebook and pane-3d from `deps/bim-open-notebook` | delete the two packages; `deps.json`; web `package.json` and lock; `deps.tsconfig.json`; `flow.config.ts` → `deps.config.ts` and its importers; `gates/web-smoke.mjs`; `WebSeamTests.cs`; `launch.json` | criteria 6 and 7; single `three` | 6.7 pushed |
| 6.12 | toolkit | `DepsCycleTests` | that file | criterion 8, fails on a planted entry | 6.1b |
| 6.13 | toolkit | documents and tickets: README layout, ARCHITECTURE, OVERVIEW, link stubs, `site/index.html`, ticket fences, debt tickets, build log | those files | `git grep "bimopenflow/web/packages/(bim-open-notebook\|pane-3d)"` outside build logs is empty | 6.11 |

Parallel sets: {6.1a, 6.2, 6.5}; {6.12} with anything after 6.1b; {6.8–6.10 in the notebook} with {6.11 then 6.13 in the toolkit}.

## Build log

- 2026-10-03: plan written; `s10-snowdon` withdrawn from the notebook's public site (`957f5c7`, risk 9).
- 2026-10-03, 6.3: new `@bimopenflow/nrc-web` holds `nrc.html`, `notebook.html` (calls `startNotebookPage`), the NRC half of the catalog, the landing-page and answer tests (`samples.test.ts`), `snowdon.ts`, and wrappers of the notebook's write and sync scripts (the write wrapper adds `--placeholder SNOWDON=`); the notebook drops `{SNOWDON}` and the NRC lead, exports `listSamples`, `fetchSample`, `ensureNotebookStyles`, `editorUrl`, `viewer3dUrl` and `./layouts`, and its own dev server defaults to 5354. Tests: notebook 231 plus nrc-web 84 = 315 (312 before, less 3 Snowdon tests moved, plus 6 new). Web smoke passes; headless Edge on 5350 loads both pages with no module error (only `/api/*` fails, no host). `deps.tsconfig.json` needed no entries while the notebook is a workspace package.
- 2026-10-03, 6.4: `pane-3d/test/seam.ts` holds the rules once (no import matching `@bimopenflow/app`, `studio-web` or `nrc-web`; no file in the package naming `samples/nrc-analyses`, `{SNOWDON}` or `BIMOPENFLOW_SNOWDON`); `seam.test.ts` in pane-3d (which also forbids importing the notebook) and in the notebook call it. Both failed on planted files (`import "@bimopenflow/studio-web"` plus `BIMOPENFLOW_SNOWDON`; `export * from "@bimopenflow/bim-open-notebook"` plus a relative import of `nrc-web`), passed with the plants removed; pane-3d 81 tests, notebook 232. `WebSeamTests.cs` checks the three files still name their rules; layering 20 of 20 in Release. The third file, `seam.ts`, is one beyond the planned two.
- 2026-10-03, 6.1b: pins moved to bim-open-flow `a3dc533`, bim-open-data `b4c7e3f` (pushed main at start) and bim-open-viewer `6cc06c2`; deps checkouts moved to match. Release build 0 errors; tests (no test-data category) all pass, including NrcWorkflows 70 of 70 and layering 20 of 20; host smoke and web smoke pass. `node deps.mjs --check` still prints 3 warnings, all from bim-open-data's own `deps.json` pinning older commits (viewer `b0ec646`, flow `eb7ec19`) and no nested viewer checkout.
- 2026-10-03, 6.5 (spike, no commit): yes, with one change. Flow's generic host (`--profile tables --models <bim-open-data samples/public>`) lists the `.bos` files and serves their bytes; one `duck.query` over `schependomlaan.duckdb` gives the instance table the 3D embed reads (`entityId` from `EntityText.StepId`, `r g b a` in 0..1; 38,947 rows, exclude the 88 with `StepId = -1`). The embed failed only because `modelPathFor` returned the `.duckdb` path, which the catalog does not list. Fixed in bim-open-flow `05a2451`: `matchModelId` retries `x.duckdb` or `x.sqlite` as `x.bos`, then `x.ifc`. 6.8's public notebooks may carry `view3d` embeds. Untested: the pane itself in a browser.
- 2026-10-03, after 6.1b: bim-open-data `4434ebb` pins the viewer at `6cc06c2`; `node deps.mjs` filled the missing nested link. Two warnings remain until the next pin move: bim-open-data at `b4c7e3f` still pins the viewer at `b0ec646`, and flow pins bim-open-data at `eb7ec19`.
- 2026-10-04, 6.11 (`ffdc3eb`): the toolkit pins bim-open-notebook `d5799aa` (its pushed main at 6.7) and takes the notebook and pane-3d from `deps/bim-open-notebook`; the two folders are gone. `deps.config.ts` (was `flow.config.ts`) exports `packagesAlias(dir)`, `flowAlias` and `notebookAlias`. Two things the plan missed: npm installs no dependencies of a `file:` link target outside the workspace, so the web `package.json` now lists the nine viewer packages and `@types/three` itself (pane-3d's own `file:` links no longer reach this `node_modules`); and the viewer's dist-built core, controls and loaders could not be found from pane-3d's real path in `deps/` (studio-web's build failed), so `viewer.config.ts`, outside the fence, aliases them to their package folders. The lock drops the stale entries of the phase 5 packages. nrc-web's samples test runs `outlineErrors` over the toolkit's 12 outlines (the prefix check 6.7 dropped from the notebook); it fails on a planted id. `WebSeamTests` points at the seam files in `deps/bim-open-notebook`. `launch.json` needed no change: no entry named the moved packages. Checks, deps cloned: Release build 0 errors; CI filter all pass, NrcWorkflows 70 of 70, layering 20 of 20; host smoke and web smoke pass (studio-web 28 tests, nrc-web 96 = 84 + 12); three's REVISION once in the studio-web bundle; headless Edge loads `/studio.html`, `/3d.html` (12 pane-3d modules from `deps/`) and on 5350 `/nrc.html` and `/notebook.html?notebook=nrc-eight-questions` with no module error (`/3d.html` logged one aborted `__bimflow/models/*.bos` fetch, a data request, not a module). Linked, a fresh clone at `_split\ws` with every entry linked to a sibling: `npm ci` matches the lock, web smoke passes with the same counts, three once, the four pages load with no module error. The .NET half of criterion 7 fails before any phase 6 code: `ara3d-dataflow` and `bim-open-schema` find their host's `Directory.Build.props` by looking above their own folder, which is the workspace folder when linked, so they restore the 1.6.1 NuGet SDK and `Ara3D.DataTable` is missing (30 errors); a workspace-level shim importing the toolkit's build files then hits projects evaluated under two paths (the `deps\` junction and the sibling) sharing `obj/`. Layering 20 of 20 passed from the partial build. Not fixed here: it needs a change in ara3d-dataflow and in how the solution names linked projects, and blocks host smoke when linked.
- 2026-10-04, 6.8: bim-open-notebook `dbbc359` repins flow `05a2451`, data `b4c7e3f`, viewer `6cc06c2`; `b284367` adds p01-schependomlaan (6 storeys, 100 spaces, 205 doors, 259 windows, 3D by IFC class), p02-digitalhub-heating (42 systems, 63 heaters, 914 pipe segments; 3D on digitalhub-hzg.bos because STEP ids repeat across the federated files), p03-duplex-doors (14 doors, 8 pass, 6 fail at 850 mm via table.derive plus table.filter, no check.rule in the generic catalog; honest absence: duplex-mep has no IfcSystem), NOTICE.md and samples/notice tests (notebook package 268 tests). Live 3D rendered in all three against flow's generic host; only /api/ask/model 404s.
- 2026-10-04, 6.13: documents and tickets. README layout table, ARCHITECTURE (workspace, seam tests, `DepsCycleTests`), OVERVIEW, `bimopenflow-structure.md`, REPOSITORY-INVENTORY (adds nrc-web; the notebook and pane-3d come from `deps/bim-open-notebook`), the layering tests README, `site/index.html` (notebook card now "Split out") and `samples/notebooks/README.md` name the new homes. `docs/plans/notebook.md` and `docs/proposals/notebook-sessions.md` are one-line links; their copies in bim-open-notebook are identical apart from line endings. The s13 outline and notebook were edited together, not regenerated (regenerating needs two hosts and rewrites every snapshot): they now say the host starts from the repository root and the write script runs from `nrc-web`. Fences of every ticket naming the two packages (TKT-80, 86, 87, 88, 90, 91, 94, 104, 105, 107, 108, 109, 111, 127, 139, 140) are `bim-open-notebook:`-prefixed. New tickets: TKT-149 (copied alias configs), TKT-150 (copied NOTICE paragraphs), TKT-151 (`snowdonPath()` duplication), TKT-152 (linked-mode .NET build, defect). The grep in the chunk's test now matches only paths into `deps/bim-open-notebook/` and the build logs and plan files; `docs/proposals/repository-layout.md` and the dated wave plans keep their historical paths.
- 2026-10-04, pins (`b96bd1a`): bim-open-data `95db8e2` (IFC tool fixes: duplicate property sets read once, material names and layer thicknesses, umlaut decoding) and bim-open-flow `e793ec7` (`05a2451` model lookup, `e7b9f5e` data pin, NOTICE copy). Checked at flow `e7b9f5e`: Release build 0 errors; CI-filter tests 19 of 19 assemblies; NrcWorkflows 70 of 70; layering 20 of 20; host and web smoke pass; no toolkit number or golden changed. `e793ec7` changes only flow's `site/data/NOTICE.md`. The three remaining `deps.mjs` warnings are the notebook's older pins at `d5799aa`, cleared when the toolkit repins the notebook after 6.10.

- 2026-10-04, 6.9 and 6.10 (bim-open-notebook `1ce4528`, `37a3c80`, `e7a016f`): the Pages workflow builds `site/app` from source (`1ce4528` committed the built site by mistake; `37a3c80` removed it); `gates/pages-smoke.mjs` serves `site/` as plain files and opens the landing page and each notebook in headless Edge (3 notebooks with 4, 5 and 3 turns); the README has screenshots of the three public notebooks. The host needs absolute paths for `--models`, `--store` and `--cache`. The Ask box answered the 14-door question in 21 s and 54 s in two runs.
- 2026-10-04, repin (bim-open-notebook `a94ff34`; toolkit pins the notebook at `a94ff34` and the viewer at `aa419cd`): the notebook pins flow `147d9c0`, data `16ea129`, viewer `aa419cd`. Fresh clone at `_split
bz`: `node deps.mjs`, viewer `npm ci` and build, `npm ci`, web smoke and pages smoke pass. In the toolkit, `node deps.mjs --check` prints two warnings, both pins that lag inside a dependency: bim-open-data at `16ea129` pins the viewer at `6cc06c2`, and bim-open-flow at `147d9c0` pins bim-open-data at `95db8e2`. Web smoke passes (nrc-web 96 tests, studio-web builds); layering 20 of 20 in Release; the lock needed no change (`npm ci --dry-run` clean, no `npm install`). The .NET Release build was skipped because a running `bimopenflow-studio` process holds the studio DLLs. Notebook tickets filed: TKT-154 to TKT-158. Phase 6 is done.
