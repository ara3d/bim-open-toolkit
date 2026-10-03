# Implementation plan: repository split, phases 3 and 5

Status: planned 2026-10-03 (read-only planner); builders follow it. Parent plan: [repository-split.md](repository-split.md).

I planned against the end state of the other agent's work: `src/data` lives in `deps/bim-open-data`, and the schema, SDK and Parakeet repositories are under `deps/`. Two facts from the current tree change the plan:

- **TKT-86 is half done in the working tree.** The new `bimopenflow/web/packages/client` (`@bimopenflow/client`) is uncommitted, `paneChoice.ts` has moved into it, and 71 paths are changed. The web chunks of phase 3 cannot start until it is committed.
- **Flow cannot be free of `bim-open-data`.** Eight "generic" projects reference it:
  - `Nodes.DuckDb`, `Cleaning`, `Dates`, `TableOps`, `Effects` and `Relations.DuckDb` use `Ara3D.BimOpenSchema.DuckDb` for `DuckTableSql`, `DuckDbOps` and `DuckDbSession`.
  - `Host.Catalog` uses `IfcLoader`, `Ifc.Bos` and `BimOpenSchema.IO`.
  - `Effects` also uses `Ifc.Editing`.

  So `bim-open-flow` lists `bim-open-data` in its `deps.json`, and its README sentence "It does not read IFC or BOS by itself" is false and needs correcting.

## 1. Seam design

### C#: the host takes profiles from whoever composes it

A new file, `src/flow/BimOpenFlow.Host/HostProfile.cs`:

```csharp
public sealed record HostProfile(string Name,
    Func<RelationRuntime, NodeRegistry> Packs,
    Func<string, IReadOnlyList<string>> SeededModelRoots,              // startDir -> roots
    Func<AnalysisStore, string, INodeRegistry, TextWriter?, IReadOnlyList<string>> Seed,
    Func<string, IReadOnlyList<SamplePreparation.Job>> Preparation);
public sealed record HostProfiles(string Default, IReadOnlyList<HostProfile> All)
{ public HostProfile this[string name] { get; } public IReadOnlyList<string> Names { get; } }
```

Changes in the host:
- **`HostConfig`**
  - Drop the static `Profiles` and `BimProfile`.
  - The default profile becomes `"tables"`.
  - The new signature is `Resolve(string[] args, string cwd, HostProfiles profiles)`.
- **`HostComposition`**
  - Keep `TablePacks`.
  - Add `static readonly HostProfile Tables`, which seeds `samples/analyses` and `samples/relations`.
  - Add `static HostProfiles Generic`.
  - Change to `BuildServices(HostConfig, HostProfile, IReadOnlyList<Job>?)` and `Build(HostConfig, HostProfile, IReadOnlyList<Job>?)`.
  - Delete `AllPacks` and `Registry(string, …)`.
- **`HostRunner`**: `RunAsync(string[] args, HostProfiles profiles, Action<HostApp>? configure = null, string name = …)`.
- **`Program.cs`**: passes `HostComposition.Generic`.
- **`SampleSeeding.FindRepoRoot`**: looks for any `*.sln` instead of `BimOpenToolkit.sln`.
- **`BimOpenFlow.Host.csproj`**: drop the references to `Nodes.Bos`, `Nodes.BimAnalysis`, `Nodes.Geometry`, `Nodes.Compliance` and `Ara3D.Ifc.DuckDb`.

What moves into `src/studio/BimOpenFlow.Studio`:
- `BimSampleSeeding.cs`.
- The NRC and showcase constants, `NrcAnalyses` and `ShowcaseAnalyses`, from `SampleSeeding`. They go to a new `NrcSamples.cs`.
- The NRC jobs `NrcDatabase`, `NrcBaseDatabase`, `NrcBos` and `Jobs`. They go to a new `NrcPreparation.cs`. The generic `Job`, `Run`, `RunInBackground` and `PendingReason` stay in the host.
- A new `StudioComposition.cs`:
  - `BimPacks(RelationRuntime?)`, which is the old `AllPacks`;
  - `Bim`, the bim profile;
  - `Tables`, the generic profile plus the NRC seeding and jobs;
  - `Profiles = new("bim", [Bim, Tables])`.

`Studio/Program.cs` gets three verbs:
- the default starts the host with `StudioComposition.Profiles`;
- `mcp …` runs `FlowMcpProgram.Run(rest, StudioComposition.Profiles)`;
- `nodedocs [path]` runs `NodeDocsProgram.Run(path, [..NodeDocsProgram.GenericPacks, ..StudioComposition.DocPacks])`.

MCP and NodeDocs:
- **MCP**: `FlowServices.Create(HostConfig, HostProfile)`. A new `FlowMcpProgram.Run(string[] args, HostProfiles profiles)` holds today's `Program.cs` body, and `Program.cs` passes `HostComposition.Generic`.
- **NodeDocs**:
  - `Pack` becomes public.
  - New: `NodeDocsProgram.GenericPacks` and `NodeDocsProgram.Run(string outputPath, IReadOnlyList<Pack> packs)`.
  - The project drops its references to the three BIM packs.

### TypeScript: the editor takes panes

A new file, `client/src/paneRegistry.ts`. `ShownNode` moves from `app/src/paneArea.ts` to `client/src/shownNode.ts`.

```ts
export interface PaneFeedIo { readonly ctx: PaneContext; readonly current: () => boolean;
  readonly resolveModelId: (path: string) => Promise<string | null>; readonly note: (text: string) => void; }
export interface PaneRegistration { readonly kind: string; readonly label: string;
  readonly offer: (desc: NodeDescriptor | undefined) => boolean;
  readonly create: (chart: ChartPaneOptions) => Pane; readonly fillHeight?: boolean;
  readonly feed?: (pane: Pane, shown: ShownNode, io: PaneFeedIo) => Promise<void>; }
export function paneRegistry(...panes: readonly PaneRegistration[]): ReadonlyMap<string, PaneRegistration>;
export const genericPanes: readonly PaneRegistration[];            // table, chart, verdict, inspector
export function choosePanes(desc: NodeDescriptor | undefined, registry: ReadonlyMap<string, PaneRegistration>): string[];
```

Changes in the editor:
- **`app/src/paneArea.ts`**
  - `PaneKind` becomes `string`.
  - `PANE_LABELS` and the switch statement go; the area reads the registry instead.
  - The `view3d` branches of `feedData` (`feedModel`, `completeTable`, the live recipe) move into the 3D registration's `feed`.
- **`AppOptions`** gains `panes?: readonly PaneRegistration[]` (default `genericPanes`) and `templates?: readonly FlowTemplate[]`.
- **`bootEditor`** changes to `bootEditor(options?: { chrome?: ChromeFactory; panes?; templates? })`.

The `panes` package splits in two:
- **`panes` keeps** `pane`, `base`, `styles`, `columns`, `tablePane`, `chartPane`, `inspectorPane`, `verdictPane`, `verdictGroups`, `entityProperties`, `instanceTable`, `instanceLegend`, `scaleLegend`, and `isBoxTable`/`parseBoxTable`.
  - A new `legend.ts` holds `LegendEntry` with a local `Vec3`. Today `instanceLegend` and `scaleLegend` import that type from `toolkitRecipe`, which is the only thing tying the chart pane to the viewer.
- **A new package, `packages/pane-3d` (`@bimopenflow/pane-3d`)**, takes:
  - `viewPane3D`, `viewerDeps`, `toolkitRecipe`, `toolkitSource`, `viewRecipe`, `categoryPalette`, `entityKeys`, `startupTrace`, and `UNIT_CUBE`;
  - the 9 `@bim-open-viewer/*` dependencies;
  - 7 test files;
  - and it exports `view3dPane: PaneRegistration`.

A second new toolkit package, `packages/studio-web`, takes from `app`:
- the pages `index.html`, `studio.html`, `3d.html`, `showcase.html` and `duckdb.html`, with their entry scripts;
- `snowdonFixture`, the Vite configs, and `templates.generated.ts`.

Its entries call `bootEditor({ panes: [...genericPanes, view3dPane], templates: TEMPLATES })`. `app` keeps its library code and a generic `index.html` on a new port.

### TypeScript: the notebook takes embed renderers

- In `bim-open-notebook/src/embeds/contract.ts`, every key of `EmbedRegistry` becomes optional (`?:`).
- In `registry.ts`:
  - `defaultRenderers` drops `view3d`;
  - new: `withRenderers(base: EmbedRegistry, extra: EmbedRegistry): EmbedRegistry`;
  - when a kind has no renderer, `renderEmbed` draws the embed's snapshot caption.
- `view3d.ts` moves to `src/page/view3dEmbed.ts`. The entries `page/main.ts`, `page/nrc.ts` and the static-site build pass `withRenderers(defaultRenderers, { view3d: renderView3d })`.

## 2. Classification

**Moves to flow:**

| Where | What |
|---|---|
| `src/flow`, 24 of 27 projects | `Contracts`, `Dashboards`, `Evidence`, `GraphText`, `Host`, `Host.Api`, `Host.Catalog`, `Host.Store`, `NodeDocs`, `Nodes.Support`, `Nodes.Cleaning`, `Nodes.Compliance`, `Nodes.Dates`, `Nodes.DuckDb`, `Nodes.Effects`, `Nodes.Relations`, `Nodes.Spatial`, `Nodes.TableOps`, `Nodes.Tables`, `Nodes.Viz`, `Publishing`, `Relations`, `Relations.DuckDb`, `Reports` |
| MCP and Ask | `BimOpenMcp.Flow`, `BimOpenFlow.Ask` |
| Root folder | `contracts/` |
| `tests/flow`, 21 of 30 projects | `Dashboards`, `Evidence`, `GraphText`, `Host.Api`, `Host.Catalog`, `Host.Store`, `Host` (generic remainder), `Nodes.{Cleaning, Compliance, Dates, DuckDb, Effects, Relations, Spatial, TableOps, Tables, Viz}`, `Publishing`, `Relations`, `Relations.DuckDb`, `Reports` |
| Other tests | `BimOpenMcp.Flow.Tests`, and a new `BimOpenFlow.Ask.Tests` (split from `Studio.Tests`, see below) |
| Test support | A copy of `TestSupport`, renamed `BimOpenFlow.TestSupport` |
| Samples | `samples/{tables, analyses, relations}` |
| Web packages | `contracts`, `api-client`, `state`, `graph`, `viz`, `client`, `panes` (generic part), `app` (library part) |

The new `BimOpenFlow.Ask.Tests` holds `AnthropicChat`, `AskAgent`, `ChatBackend`, `ClaudeCli*`, `ClaudeStream`, `LoopbackPorts`, `ScriptedChat` and `tests/studio/fake-claude`.

**Stays in the toolkit:**

| Project or package | What keeps it |
|---|---|
| `Nodes.Bos`, `Nodes.BimAnalysis` | `Ara3D.BimOpenSchema` |
| `Nodes.Geometry` | `Ifc.Mesher` (native tessellation); its `view3d.*` output only feeds the 3D pane |
| `BimOpenFlow.Studio` | The BIM composition root, plus `/api/ask` with its BIM skill prompts |
| `BimOpenMcp.Ifc.Ask` | `BimOpenMcp.Ifc` from data |
| `Ara3D.Studio.BimTools` | Studio API; later goes to Ara 3D Studio's repository |
| Tests: `Nodes.Bos`, `Nodes.BimAnalysis`, `Nodes.Geometry`, `PocParity`, `View3dWorkflows` | They test the BIM packs |
| Tests: `BimWorkflows`, `NrcWorkflows`, `SampleFlows` | BIM profile and NRC samples; move to `tests/studio` in phase 3 |
| Test: `TableWorkflows` | `Federation` and `samples/snowdon-analyses` |
| `Studio.Tests` (remainder), `Ifc.Ask.Tests` | They test Studio and the IFC Ask runner |
| `pane-3d` | `@bim-open-viewer/*` |
| `studio-web` | Snowdon fixture, toolkit samples, the 3D pages |
| `bim-open-notebook` | Phase 6 |

The remainder of `Studio.Tests` is `AskChecks`, `AskHandler` and `AskPrompts`. `Ifc.Mcp` and its tests go to data in phase 4.

## 3. Chunks

### Phase 3

**3a. C# seam.** Can run in parallel with 3b.
- Fence:
  - `src/flow/BimOpenFlow.Host/**`, `src/flow/BimOpenFlow.NodeDocs/**`;
  - `src/mcp/BimOpenMcp.Flow/**`, `src/studio/BimOpenFlow.Studio/**`;
  - `tests/flow/BimOpenFlow.Host.Tests/**`, `tests/mcp/BimOpenMcp.Flow.Tests/**`, `tests/studio/**`;
  - moving `BimWorkflows`, `NrcWorkflows` and `SampleFlows` to `tests/studio` with `git mv`;
  - `BimOpenToolkit.sln`, `gates/host-smoke.mjs` (point it at Studio), `.github/workflows/build.yml` line 48;
  - the `host` script in `bimopenflow/web/package.json`, and `launch.json`.
- Test moves:
  - `CompositionTests`, `NrcSeedingTests`, `NodeCatalogFileTests`, the NRC part of `SamplePreparationTests`, and the `bos.*`/`view3d.*` cases of `HostHttpTests` go to `Studio.Tests`;
  - the MCP fixture switches from `view3d.camera` to `table.inline`.
- Checks: Release build, the CI test filter, host smoke, and `bimopenflow-studio nodedocs` reproduces `docs/nodes.md` byte for byte.
- Back out: `git revert`.

**3b. Panes split.** Starts after TKT-86 is committed.
- Fence: `packages/panes/**`, the new `packages/pane-3d/**`, `packages/client/**`.
- Checks: tests and typecheck in `panes`, `pane-3d` and `client`.
- Back out: `git revert`.

**3c. The app takes panes.** After 3b; can run in parallel with 3d.
- Fence: `packages/app/**`, the new `packages/studio-web/**`, `scripts/build-flow-templates.mjs`, `gates/web-smoke.mjs`.
- Checks: web smoke, and `/studio.html` and `/3d.html` load in the browser.
- Back out: `git revert`.

**3d. The notebook takes embeds.**
- Fence: `packages/bim-open-notebook/**`.
- Checks: 303 notebook tests, the typecheck, and `build:pages`.
- Back out: `git revert`.

**3e. Layering test.** After 3a through 3d.
- Fence: `tests/BimOpenToolkit.Layering.Tests/**`, `docs/ARCHITECTURE.md`.
- New tests:
  1. No `src/flow` or `src/mcp` project, other than the three BIM packs themselves, references `Nodes.Bos`, `Nodes.BimAnalysis` or `Nodes.Geometry`.
  2. `src/flow` and `src/mcp` never reference `src/studio`.
  3. No `package.json` or `src/**/*.ts` in `contracts`, `api-client`, `state`, `graph`, `viz`, `client`, `panes` or `app` names `@bim-open-viewer/`, `@bimopenflow/pane-3d` or `@bimopenflow/bim-open-notebook`.
  4. Notebook files under `src/embeds/**` never import `pane-3d`.
- Back out: `git revert`.

### Phase 5

**5a. `ara3d-dataflow` moves to `deps/`.**
- Fence: `.gitmodules`, `deps.json`, every `.csproj` that references `submodules\ara3d-dataflow` (about 57), `build.yml`.
- Checks: full build and tests.
- Back out: revert the commits, then `git submodule update --init`.

**5b. Prepare in place.** After 5a.
- Fence: `tests/BimOpenFlow.TestSupport` (new copy, marker `*.sln`), the `RepoPaths` users in moved tests, `docs/nodes.catalog.json`, and the `graph` sample scripts.
- What changes:
  - The flow catalog is generated from the generic packs.
  - The `graph` overlap test reads only the samples that move.
- Checks: full build and tests, and web smoke.
- Back out: `git revert`.

**5c. Extract with history.**
- Where: a fresh clone at `C:\Users\cdigg\git\_split\flow`.
- Steps:
  1. Run `git filter-repo --paths-from-file` over the paths in section 2, plus `contracts/`, `deps.mjs` and `.gitignore`.
  2. Keep identical paths, so no relative reference changes. Renaming folders is a later commit.
  3. Merge into `bim-open-flow` with `--allow-unrelated-histories`.
  4. Add `BimOpenFlow.sln`, the `Directory.Build.*` files, `deps.json` (`ara3d-dataflow`, `bim-open-data`, `gratify`), `build.yml`, a generic `gates/host-smoke.mjs` (`table.inline` → `table.sort`), `gates/web-smoke.mjs`, a layering test (the copied flow-layering rules plus "no BIM pack, no `Ifc.Mesher`, no `@bim-open-viewer`"), and an updated README.
- Checks: in a standalone clone, `node deps.mjs`, then build, test and web smoke.
- Back out: revert the merge on `bim-open-flow`.

**5d. Public building, in `bim-open-flow`.** Can run in parallel with 5e.
- What it adds:
  - `samples/building/duplex.duckdb`, built from `samples/nrc/duplex-base.ifc` by `IfcDuckDbBuild.Build`. It is 1.8 MB, with 9 tables (`Entities` 4,721 rows, `Parameters` 15,658, `Relations` 949, …) and 5 views (`EntityText`, `ParameterText`, `RelationText`, `StoreyOfElement`, `StoreyOfEntity`).
  - A `.gitignore` exception for it.
  - 4 graphs in `samples/building-analyses`: doors per storey, elements by IFC class, door-width `check.rule`, and parameter coverage.
  - Golden tests, seeding in `HostComposition.Tables`, and `scripts/snapshot-samples.mjs`.
- Licence: the repository's only note is "Duplex is a public buildingSMART sample" (`docs/plans/nrc-handoff-wave.md:234`); there is no licence file here or in `nrc-ifc-llm/IFC-Test-Kit`. Verify the licence before pushing. If it does not allow redistribution, fall back to the synthetic `BimSampleModel` exported to DuckDB.
- What the landing page can show with no server:
  - each graph drawn read-only by `graph`;
  - each node's result from committed snapshots in the table, chart and verdict panes;
  - a catalog browser over `nodes.catalog.json`;
  - optionally, DuckDB-WASM rerunning `duck.query` SQL against `duplex.duckdb`.
- What it cannot show: 3D, Ask, or re-evaluating after an edit. The C# nodes need a host.

**5e. The toolkit consumes flow.** After 5c is pinned.
- Fence:
  - delete the moved folders;
  - `deps.json` (add `bim-open-flow`);
  - `.csproj` references to `..\..\..\deps\bim-open-flow\src\…`;
  - the solution file;
  - the web root `package.json`: `file:` dependencies for every flow package, plus `overrides` for `@bimopenflow/*`;
  - a new `bimopenflow/web/flow.config.ts` alias file, modelled on `viewer.config.ts`;
  - the gates, the layering test (`deps` allowed like `submodules`), the current documents, and the split plan's build log.
- Checks: all five of the plan's checks, run once with the deps cloned and once linked.
- Back out: revert the commits; the folders return with their history.

## 4. Risks

1. **The working tree is shared right now.** Phase 4 edits are present in the `.csproj` files, and TKT-86 is touching `app/src/*` and `client`. The phase 3 web chunks must wait for both to commit.
2. **Flow needs data pinned first.** Because of the `bim-open-data` dependency, 5c needs data's `deps.json` (schema, SDK, Parakeet) to be stable. The SDK's `Directory.Build.targets` substitution has to be copied into flow.
3. **npm and `file:` consumption.** Transitive `@bimopenflow/*@0.1.0` will not resolve without overrides. There is a risk of duplicate `three` and Gratify copies (keep `dedupe`). The viewer's own `deps/gratify` must link to the toolkit's.
4. **Shared `obj/` folders.** A linked `deps/bim-open-flow` and the toolkit share `obj/` and `project.assets.json` (the review's Q9 answer). Build one at a time, or use `--artifacts-path`.
5. **Smoke tests assume the bim profile.** Host smoke and the MCP tests use `view3d.camera` and `bos.load` today, and the default profile flips to `tables`. Every script and document that starts `bimopenflow-host` expecting BIM nodes must start Studio instead.
6. **Ask and the skill stay in Studio.** `/api/ask` and the `bim-flow` skill prompts stay in Studio, so flow's standalone editor has no Ask box. Moving `AskEndpoint` behind a prompt seam is a follow-up.
7. **Phase 6 needs a decision about `pane-3d`.** The notebook repository cannot depend on the toolkit, so `pane-3d` must move into `bim-open-notebook` or `bim-open-viewer` before phase 6.
8. **The DuckDB file format must match.** The `.duckdb` written by DuckDB.NET must be a storage version DuckDB-WASM can read. If not, ship Parquet instead.

### Critical files for implementation
- `C:\Users\cdigg\git\bim-open-toolkit\src\flow\BimOpenFlow.Host\HostComposition.cs`
- `C:\Users\cdigg\git\bim-open-toolkit\src\studio\BimOpenFlow.Studio\Program.cs`
- `C:\Users\cdigg\git\bim-open-toolkit\bimopenflow\web\packages\app\src\paneArea.ts`
- `C:\Users\cdigg\git\bim-open-toolkit\bimopenflow\web\packages\bim-open-notebook\src\embeds\registry.ts`
- `C:\Users\cdigg\git\bim-open-toolkit\tests\BimOpenToolkit.Layering.Tests\LayeringTests.cs`