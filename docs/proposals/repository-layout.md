# Proposal: how the BIM Open repositories fit together

Status: proposal, for evaluation by an outside reviewer. Written 2026-10-03 by Claude (Opus 5.5) with the owner, Christopher Diggins, in one session. Nothing here is decided. Section 9 lists the questions the owner wants answered.

## 1. Why this exists

BIM Open Toolkit (`ara3d/bim-open-toolkit`, "the toolkit") grew into one repository holding several products: a 3D viewer, a dataflow graph system, a BIM data library, IFC (Industry Foundation Classes) utilities, Revit add-ins, a studio application, and the work for a research paper. The owner wants to split it so that:

- each product has its own repository, which people can find, read, and fork;
- the owner still works in **one** checkout, where an edit to one repository is seen at once by every repository that depends on it;
- **no repository is pinned twice at different commits.** If the viewer and the graph editor both use Gratify (a UI library), they use the same Gratify;
- other projects can take the whole set easily. Today `ara3d/nrc-ifc-llm` (a research collaboration between Studio 2.5 and the National Research Council Canada) includes the toolkit as a git submodule. Studio 2.5, the partner, may fork it.

The owner's own framing, which this proposal adopts, is that four separate concerns are currently tangled together:

1. **Product repositories**: the viewer, the graph system, the UI library, and similar.
2. **Miscellaneous IFC and BIM utilities**: loaders, converters, a DuckDB export, Revit add-ins.
3. **The working repository**: where the owner and coding agents edit everything at once.
4. **A consumer-facing entry point**: one thing someone adds to get all the subprojects at a combination known to work.

## 2. The repositories today

| Repository | What it is | How it is consumed today |
|---|---|---|
| `ara3d/bim-open-toolkit` | Everything below, plus samples, tests (523 files), tickets, plans, agent configuration | Submodule of `ara3d/nrc-ifc-llm`, pinned at `34499e3` (2026-09-29, 17 commits behind `main`) |
| `ara3d/gratify` | TypeScript canvas UI library | Toolkit submodule; used by the viewer's `ui-gratify` package and by the graph editor |
| `ara3d/ara3d-dataflow` | Specification, engine, and conformance suite for the dataflow engine; "nothing in this repository knows about buildings" | Toolkit submodule; referenced only by `src/flow` and `tests/flow` |
| `ara3d/bim-open-schema` | The BOS (BIM Open Schema) specification as code: five dependency-free C# files | Toolkit submodule; referenced by `src/data` and the Revit add-ins |
| `ara3d/ara3d-sdk` | General-purpose .NET libraries | Toolkit submodule, but every one of the 24 references is a NuGet `PackageReference` (version 1.6.1). No project builds from the submodule. |
| `ara3d/parakeet` | Parser library | Toolkit submodule; used by the IFC type generator |
| `ara3d/bim-open-flow` | New, holds only a README | Not yet populated |
| `ara3d/bim-open-viewer` | New, holds only a README, LICENSE, `.gitignore` | Extraction in progress (section 7) |

Inside the toolkit, by tracked files:

| Folder | Files | Contents |
|---|---|---|
| `viz/` | 937 | The 3D viewer: 17 npm packages |
| `bimopenflow/web` | 340 | The graph editor and its panes (npm workspace) |
| `src/flow` | 325 | 27 .NET projects: graph host, node packs, publishing chain |
| `src/data` | 226 | The BOS reference implementation and the IFC stack (loader, mesher, editing, types, conversion to BOS and DuckDB, IDS) |
| `plugins/` | 188 | Revit 2025 add-ins |
| `samples/` | 137 | Sample graphs and data, including the NRC paper's |
| `src/studio`, `src/mcp` | 61, 34 | The web studio's host and Ask box, an IFC question runner, and Ara 3D Studio scripts (see "Two meanings of studio" below); two MCP (Model Context Protocol) servers |
| `apps/`, `tools/` | 11, 16 | BOS Browser; IFC type generator and workflow tools |

Two coupling facts matter for any split:

- 23 of the 27 `src/flow` projects depend only on the engine. Four depend on the toolkit's `src/data`: `Nodes.Bos`, `Nodes.BimAnalysis`, `Host` (which composes the `bim` profile), and `NodeDocs`.
- Of the editor's eight web packages, only `panes` imports the viewer, in six files.

### Two meanings of "studio"

The word names two different things in this repository, and the first version of this proposal used it loosely.

1. **The web studio.** This is the analyst's browser application: graph editor, tables, charts, Ask box, and 3D view. `PROJECT.md` calls it "the Snowdon DuckDB studio". Its code is spread over several folders:
   - `src/studio/BimOpenFlow.Studio`: the server program `bimopenflow-studio`, which runs the graph host with the BIM node packs and the flow MCP server, and serves the Ask box;
   - `src/studio/BimOpenFlow.Ask`: the Ask box's agent loop, over any in-process MCP server;
   - `src/studio/BimOpenMcp.Ifc.Ask`: a command-line runner that answers a list of questions about one IFC file;
   - the pages in `bimopenflow/web/packages/app` (`studio.html`, `duckdb.html`, `3d.html`) and the 3D pane;
   - the notebook (section 5.1).
2. **Ara 3D Studio.** This is the owner's separate desktop application, in its own `studio` repository, with a plug-in API. One project here exists for it: `src/studio/Ara3D.Studio.BimTools`, 26 files of Studio scripts (filters, room and level tools, door clearance, a room navigator). `BimOpenFlow.Studio` can also run inside Ara 3D Studio as well as on its own.

In the rest of this proposal, "the analyst application" means the first. A future repository for it should not be called `bim-open-studio`, because readers would take it for Ara 3D Studio.

## 3. Requirements

| # | Requirement | Comes from |
|---|---|---|
| R1 | The owner works in one checkout containing every repository | Owner |
| R2 | An edit in one repository is visible to its dependents without a commit, push, or pointer bump | Owner ("propagate quickly") |
| R3 | Each repository is pinned at most once in any checkout | Owner ("not at different paces") |
| R4 | Each product repository clones and builds standalone | Products as landing places |
| R5 | A downstream project can add the whole set as one submodule and build it | `nrc-ifc-llm` |
| R6 | A partner can fork the set, change some repositories, and keep pulling updates | Studio 2.5 |
| R7 | Several coding agents can work at once in the one checkout, committing by path, with no git worktrees | The owner's `GIT.md` rules |
| R8 | Workflow 6 in `PROJECT.md` keeps working: CI fails a push that changes one of the paper's eight answers | `PROJECT.md` |

## 4. How repositories find their dependencies

This is the decision the rest depends on.

| Option | How it works | R2 (instant) | R3 (one pin) | R4 / R5 (standalone, one submodule) | Main cost |
|---|---|---|---|---|---|
| **A. Nested submodules** | Each repository pins its own dependencies inside itself | No | **Fails**: Gratify ends up pinned inside the viewer and inside the toolkit | Yes, `clone --recursive` | The diamond the owner wants to avoid |
| **B. Flat workspace plus a `deps/` folder** | One working repository holds every repository as a sibling. Each repository reads dependencies only from its own git-ignored `deps/<name>`. A script fills `deps/` with a link to the sibling if one exists, or a clone at the commit pinned in that repository's `deps.json`. | Yes: links point at the one sibling checkout | Yes inside the workspace; the pins only matter standalone | Yes, after one script run | One script; a pin file in each repository |
| **C. Monorepo with read-only mirrors** | All code in one repository; a GitHub Action splits each folder out to its public repository on every push (the Symfony model) | Yes: one commit spans everything | Yes | Mirrors still need B's script or packages to build alone | Pull requests on mirrors are re-applied by hand |
| **D. Versioned packages (npm, NuGet)** | Repositories depend on version numbers; the workspace substitutes local source | Yes, locally | Yes, through the package manager | Best for outsiders | A release has to be published before anyone else sees a change |
| **E. git subtree vendoring** | Copies a dependency's files into each repository | No | Fails: copies drift | Yes | Two-way syncing |

**Recommendation: B now, D later for the libraries outsiders actually use.**

How B works in detail:

- Every build configuration refers to `deps/<name>/...` and nothing else. That covers `package.json` `file:` paths, `tsconfig` paths, Vite aliases, and `.csproj` `ProjectReference`s.
- `deps/` is git-ignored.
- One script, run after cloning, fills `deps/<name>` with either:
  - a **link** to `../<name>` if that sibling exists (a directory junction on Windows, which needs no administrator rights; a symlink elsewhere), or
  - a **clone** of the repository at the commit pinned in `deps.json`.
- Inside the workspace every `deps/gratify` is a link to the one `gratify/` checkout, so R2 and R3 hold.
- The pins in each `deps.json` are written by the workspace, never by hand. A workspace command commits each changed repository by path, pushes it, rewrites dependents' `deps.json` to the commits checked out, and bumps the workspace's own pointers. The pins then record combinations that were actually built together.
- Each product repository's CI builds it standalone from its pins. That catches a repository that only builds inside the workspace.
- When a library is published as a package, its `deps.json` entry becomes a version instead of a commit. Nothing else in the consuming repository changes.

Known risks of B, for the reviewer to weigh:

- **Links:** Vite resolves links to their real paths, and so do MSBuild and npm. The editor already pins Gratify to one copy through a Vite alias, so this is expected to work but is unverified on macOS and Linux.
- **Detached HEAD:** submodules check out a commit, not a branch. Setting `branch = main` in `.gitmodules`, and having the workspace script check out `main`, handles it. Agents need a written rule for it.
- **Bootstrap location:** the script has to live somewhere every repository can reach before `deps/` exists (open question Q4).
- **Who wins:** two sources of pins exist, the workspace's submodule pointers and each `deps.json`. The workspace pointers must win, and `deps.json` must be generated from them.

C deserves a fair hearing. It is the fastest for the owner and for parallel agents, because one commit spans everything and there is one CI run. It was not recommended because separate repositories are meant to be real landing places that take issues and pull requests, which mirrors handle badly. If cross-repository commits under B become a burden, moving to C is straightforward.

## 5. Proposed repository roles

| Concern | Repository | Contents |
|---|---|---|
| Products | `bim-open-viewer` | `viz/` (in progress) |
| | `bim-open-flow` | The generic part of `src/flow` (23 projects), the graph editor without the 3D pane, the flow MCP server, the `bim-flow` skill, non-BIM samples. Possibly `ara3d-dataflow` folded in (Q6). |
| | `gratify`, `ara3d-dataflow`, `bim-open-schema`, `parakeet`, `ara3d-sdk` | Unchanged |
| Utilities | One new repository, name in section 6.3 | `src/data`: the BOS reference implementation and the IFC stack, the IFC MCP server, the BOS Browser app, the IFC type generator |
| | Optionally `bim-open-revit` | `plugins/` (Revit 2025 add-ins; a different platform and build) |
| Analyst application | Stays in the toolkit at first; later its own repository (section 6.2) | The web studio (`BimOpenFlow.Studio`, its pages, the 3D pane), the BIM node packs (`Nodes.Bos`, `Nodes.BimAnalysis`), the IFC question runner, the notebook's BIM parts (section 5.1), Snowdon and NRC samples and tests, gates, the paper's walkthrough |
| Plug-ins for other products | Ara 3D Studio's `studio` repository, or a plug-ins repository beside `bim-open-revit` | `Ara3D.Studio.BimTools`. It is a plug-in for another application and needs that application's API, so it does not belong with the web studio. |
| Working repository | New, names in section 6.1 | Flat submodules of everything above; workspace scripts; cross-repository agent configuration |
| Entry point | Names in section 6.2 | What `nrc-ifc-llm` adds and Studio 2.5 forks |

### 5.1 Where the notebook fits

`bim-open-notebook` (the package `@bimopenflow/bim-open-notebook`, 63 files in `bimopenflow/web/packages`) records a session with the agent as a document:
- each turn is a request and a reply;
- a reply is text, the tool calls the agent made, and embeds: a value, table, chart, graph, 3D view, picture, or file;
- every embed keeps a snapshot, so a notebook opens with no host;
- an embed backed by a node can be evaluated again, and says whether its result changed.

Its design is in `docs/proposals/notebook-sessions.md` and its plan in `docs/plans/notebook.md`. Thirteen sample notebooks are in `samples/notebooks`.

What it depends on:
- the editor's packages (`graph`, `state`, `panes`, `app`, `api-client`, `contracts`), and through `panes` the 3D viewer;
- the analyst application's host, for `/api/ask`, the Ask box backend.

It also holds `nrc.html`, the NRC project's landing page, which lists the NRC sample notebooks and graphs.

The notebook is a second face of the analyst application rather than a product of its own. It uses the same host, the same agent, and the same kinds of output as the editor and the studio pages. Split by the rule used everywhere else in this proposal, it has three parts:

| Part | Building-specific? | Goes to |
|---|---|---|
| The file format, the embed contract and registry, the live comparison, and the embeds for value, table, chart, graph, picture, and file | No | `bim-open-flow`, when that repository is extracted. A notebook of graphs and tables explains the graph system to newcomers better than any README. The embed registry already maps kinds to renderers, so it is the same seam as node packs and panes. |
| The 3D embed, and the Ask backend configured with the BIM node packs | Yes | The analyst application, which registers the 3D embed the same way it registers the 3D pane |
| `nrc.html` and the NRC sample notebooks | Specific to one project | The toolkit's `samples/` for now; `nrc-ifc-llm` may want to own them later |

`BimOpenFlow.Ask`, the agent loop behind `/api/ask`, works over any in-process MCP server and knows nothing about buildings. It would move to `bim-open-flow` with the notebook core, so a notebook works there against the generic host. Its system prompt is the `bim-flow` skill's guide files, which section 5 already places in `bim-open-flow`.

**Short term:** the notebook stays where it is. **Long term:** if the notebook rather than the editor becomes what an analyst opens first, the analyst application's repository could be named for it (section 6.2).

## 6. Names and locations

The owner first assumed the toolkit would be the central repository. Separating the concerns suggests otherwise:

- The **working repository** changes with every commit and carries plans, tickets, scratch scripts, and agent configuration.
- The **entry point** should change only when a combination has been tested, and should read cleanly to a stranger or a partner.

Those are different audiences on different schedules.

### 6.1 Working repository

| Name | Fits when | Against |
|---|---|---|
| `ara3d/bim-open-workspace` | The workspace stays scoped to the BIM Open family | Holds general libraries too (Gratify, the engine, the SDK) |
| `ara3d/ara3d-workspace` | The owner will also work on Plato, platonic-coder, and others from the same checkout | Wider than the BIM Open family needs today |
| `ara3d/bim-open-dev` | A short name that says "for developers" | "dev" is often read as a branch name |
| `cdiggins/workspace` (personal account, private) | The working repository is purely personal | Partners cannot reproduce the setup; agents' cross-repository configuration is hidden |
| `ara3d/bim-open-toolkit` (keep) | No new repository is wanted | Mixes the working and consumer concerns; every commit moves what `nrc-ifc-llm` sees |

**Recommendation: `ara3d/bim-open-workspace`, public**, so a partner can reproduce the setup. Rename to `ara3d-workspace` only if non-BIM repositories join.

### 6.2 Consumer entry point

| Option | What it is | For `nrc-ifc-llm` | For a Studio 2.5 fork |
|---|---|---|---|
| **E1. `bim-open-toolkit` as the analyst application and entry point** | The toolkit keeps the analyst application (web studio, notebook BIM parts, BIM packs, 3D pane, samples, NRC tests) and takes the products through `deps/` | No URL change. Paths under `samples/` and `src/data` move once, as the utilities leave. | Fork one repository, then fork only the products they change and point `deps.json` at them |
| **E2. `bim-open-toolkit` as a pure umbrella** | Only flat submodules pinned to tested combinations, a README, and one start command. The analyst application moves to its own repository (names below). | `git submodule add` plus `--recursive` yields everything. Paths change to `bim-open-toolkit/<repo>/...`. | Lightest fork: edit `.gitmodules` to point at their forks |
| **E3. The working repository is the entry point** | `main` follows the owner's work; release tags mark tested combinations | Pin a tag, never `main` | Forking brings the owner's working clutter |
| **E4. A new name for the entry point** (`bim-open`, `bim-open-suite`) | Like E2, under a new name; the toolkit is retired or becomes integration | URL changes | As E2 |

**Recommendation:**
- **Short term, E1.** `nrc-ifc-llm` keeps its URL, and the integration code has a home while the products leave.
- **Long term, E2**, once the analyst application is small enough to justify its own repository. The toolkit is then exactly the "everything, at a tested combination" entry point the name suggests.
- **Tag releases in either case**, and have `nrc-ifc-llm` pin tags rather than arbitrary commits.

Names for the analyst application's repository under E2:

| Name | Fits when | Against |
|---|---|---|
| `bim-open-app` | The repository holds several faces (studio pages, notebook, 3D) | Generic |
| `bim-open-analyst` | It is named for its user, the BIM analyst in `PROJECT.md` | Leaves out the agent, the application's other user |
| `bim-open-notebook` | The notebook becomes what an analyst opens first, and the editor and 3D view are reached from it (section 5.1) | Wrong if the editor stays the main face |
| `bim-open-studio` | Not recommended | Confused with Ara 3D Studio |

**Recommendation: `bim-open-app`**, renamed to `bim-open-notebook` if the notebook becomes the front door.

### 6.3 Utilities repository

| Name | Scope |
|---|---|
| `bim-open-data` | BOS reference implementation and IFC stack together. `Ifc.Bos` and `Ifc.DuckDb` couple the two. |
| `bim-open-ifc` plus `bim-open-data` | Split the IFC stack from the BOS implementation. Cleaner names, but one more repository and one more pin. |
| `bim-open-utils` / `ara3d-bim-utils` | Honest about "miscellaneous", but says nothing about contents. Utility repositories named this way tend to collect anything. |

**Recommendation: `bim-open-data`** for all of `src/data`, its MCP server, the BOS Browser, and the type generator. Split out IFC later only if someone wants the IFC tools without BOS. Revit add-ins go to `bim-open-revit` only when their build gets in the way; `PROJECT.md` says they are not being extended in this stretch.

## 7. Short-term plan (the next few working sessions)

Each step is its own commit, or set of commits by path, and is verified before the next starts.

1. **Settle B's mechanics.** Define the `deps.json` format, write the `deps` script (link or clone), and decide where the script lives (Q4). Test that links work for npm, Vite, `tsc`, vitest, and MSBuild on Windows.
2. **Finish the viewer extraction on B.** State on 2026-10-03:
   - The viewer's history (285 commits of `viewer/` and `viz/`) has been extracted with `git filter-repo`, merged with the new repository's first commit, and all 17 packages renamed to `@bim-open-viewer/*`. The three `@ara3d/viewer-*` packages are included and keep resolving from their built output.
   - Machine-specific absolute paths are replaced with repository-relative ones, and the fixture server uses `tsx` from npm instead of a sibling checkout.
   - It builds and typechecks. It passes 2,161 of 2,162 V2 tests and every per-package suite except one test, which expects the repository folder to be named `viewer`. That test fails in the toolkit today for the same reason.
   - One lint error (`prefer-const` in `ui-gratify/src/inspector/host.ts`) also predates the move.
   - It still carries a nested Gratify submodule, which B replaces with `deps/gratify`.
   - Nothing is pushed. The toolkit is unchanged. The work sits in a temporary session folder, `%LOCALAPPDATA%\Temp\claude\C--Users-cdigg-git-bim-open-toolkit\5b8f2e5c-d661-401c-9de6-c79f2d67b22f\scratchpad\extract`, which is not durable. As the review in section 11.3 says, it should be pushed to a branch before any other step.

   Remaining work: switch Gratify to `deps/`, push, replace the toolkit's `viz/` with `deps/bim-open-viewer`, and update the toolkit's consumers:
   - the editor's `panes` package file, `toolkit.config.ts`, `toolkit.tsconfig.json`, and three `tsconfig.json` files;
   - seven scripts;
   - `.claude/launch.json`, the CI comment, and the current documents.

   Then check `/3d.html` in a browser.
3. **Create `bim-open-workspace`** with flat submodules: toolkit, viewer, Gratify, engine, schema, Parakeet. Add the workspace commit-and-pin command and a `GIT.md` section on committing inside workspace submodules.
4. **Move the toolkit's own submodules to `deps/`**, so the workspace holds the only copies. This changes what `nrc-ifc-llm` must run after cloning (one script instead of `--recursive`); update its README in the same step. Drop the unused `ara3d-sdk` submodule unless Q8 finds a reason to keep it.
5. **Tag the toolkit** at the first combination that passes CI, and move `nrc-ifc-llm` to that tag.

## 8. Long-term plan

1. **Extract `bim-open-flow`.** First, inside the toolkit:
   - the host takes node packs from whoever composes it, rather than naming `Nodes.Bos`;
   - the editor takes panes the same way, so the toolkit plugs in the 3D pane;
   - the notebook takes embeds the same way, so the toolkit plugs in the 3D embed;
   - the BIM composition moves into the web studio's host, `BimOpenFlow.Studio`.

   The notebook core and `BimOpenFlow.Ask` go with the extraction (section 5.1).

   Then extract with history. Ship a small public building as DuckDB tables so the repository demonstrates BIM questions with no toolkit code.
2. **Extract `bim-open-data`** from `src/data`, with its tests and the IFC MCP server.
3. **Decide on `ara3d-dataflow`:** fold it into `bim-open-flow`, or keep it separate and publish to NuGet (Q6).
4. **Thin the toolkit** to the analyst application plus entry point (E1). When the application is small, move it to `bim-open-app` and make the toolkit a pure umbrella (E2). Move `Ara3D.Studio.BimTools` to Ara 3D Studio's repository at any point; nothing else depends on it.
5. **Publish packages** for what outsiders consume: Gratify, the viewer, and the flow web packages on npm; flow and data on NuGet. Switch the matching `deps.json` entries to versions.
6. **Write down the partner workflow:** how Studio 2.5 forks the entry point, forks only the repositories they change, and pulls the owner's tagged releases.

## 9. Questions for the reviewer

| # | Question |
|---|---|
| Q1 | Is B the right mechanism, or does C (monorepo with mirrors) serve R1, R2, and R7 enough better to accept its cost to the landing-place goal? |
| Q2 | Is a separate working repository worth one more repository, compared with E3 (working repository equals entry point, tags for consumers)? |
| Q3 | E1 then E2, or go straight to E2? |
| Q4 | Where does the `deps` script live so a fresh clone can run it before `deps/` exists? Options: a copy in each repository, kept identical by a workspace check; an npm package run with `npx`; or a short bootstrap in each repository that downloads the script from the workspace repository at a pinned commit. |
| Q5 | Which names: `bim-open-workspace` or another for the working repository; `bim-open-data` or another for the utilities? |
| Q6 | Fold `ara3d-dataflow` into `bim-open-flow`? Its README positions it as an independent engine with its own specification. |
| Q7 | Does a downstream project like `nrc-ifc-llm` really want one submodule for everything, or one submodule per product it uses? |
| Q8 | Is anything lost by dropping the `ara3d-sdk` submodule, given all 24 references are NuGet packages? |
| Q9 | Are there failure modes of links (junctions or symlinks) under Vite, MSBuild, npm, or on macOS and Linux that make B worse than it looks? |
| Q10 | (Added after the review in section 11.) Should the notebook core and the Ask agent loop go to `bim-open-flow`, or stay with the analyst application until the notebook's design settles? |
| Q11 | (Added after the review.) Which name for the analyst application's repository under E2: `bim-open-app`, `bim-open-analyst`, or `bim-open-notebook`? |

## 10. What the reviewer should check against

- The owner's coding rules at `github.com/cdiggins/platonic-coder` (`PRINCIPLES.md`, `GIT.md`). Principles are ordered: correct, easy to change, built for parallel agents, no repetition, reasonable performance. `GIT.md` bans git worktrees and requires commits by path.
- `PROJECT.md` in this repository, especially workflow 6 (requirement R8 above) and the Scope section.
- `docs/ARCHITECTURE.md`, and the layering test `tests/BimOpenToolkit.Layering.Tests`, which enforces the dependency order data < flow < mcp < studio.

## 11. Review (2026-10-03, Claude Fable 5.1)

Written against the repository at `516e0b3` and the sibling checkouts under `~/git`. Each finding names what was checked.

### 11.1 Verdict

The direction holds: separate product repositories, one working checkout, and one pin per repository are the right goals, and B is the right mechanism. The proposal rests on one wrong fact about the SDK, leaves the only unrecoverable work in an unnamed place, and does the expensive steps before the cheap one that would prove B works.

### 11.2 Facts that do not match the repository

- **The SDK submodule is built from source, not from NuGet.** `Directory.Build.targets` rewrites every `PackageReference` whose id matches a project under `submodules/ara3d-sdk` into a `ProjectReference`, so all 24 references compile the SDK at the pinned commit, which is 156 commits past the v1.6.1 tag (`git submodule status`: `v1.6.1-156-gd41dfa7`). Three projects also reference the submodule directly: `plugins/Ara3D.Bowerbird.Revit2025`, `plugins/Ara3D.Bowerbird.RevitSamples`, and `src/studio/Ara3D.Studio.BimTools`, for `Ara3D.Bowerbird` and `Ara3D.Studio.Samples`, which are not packages. The downstream `poc/EnrichIfc` project in `nrc-ifc-llm` resolves SDK projects through the same path (its `obj/project.assets.json`). Step 4's "drop the unused submodule" would regress the SDK by 156 commits and break four projects. Answer to Q8: keep it, or publish a new SDK version first.
- **The repository already runs the "D later" pattern.** The targets file is exactly "depend on a version number, substitute local source when present". The engine and schema use raw `ProjectReference`s into `submodules/` instead, about 60 of them (57 engine, 22 schema, 3 Parakeet, counted over `src`, `tests`, `apps`, `tools`, `plugins`). B is a path rename for those. The SDK pattern should be kept and named as the second mechanism, not discarded. The engine cannot move to D yet: no project under `ara3d-dataflow/src` declares a `PackageId` or `Version`.
- **The diamond already exists on the owner's disk.** `~/git/gratify` is at `f8764ca` and `~/git/bim-open-schema` at `4e507df`; the toolkit pins `a2d1723` and `d12e635`. The Gratify sibling does not contain the pinned commit. Three Gratify histories on one machine is the strongest evidence for B and belongs in section 1.
- **"Only `panes` imports the viewer, in six files"** is three source files (`boxTable.ts`, `viewerDeps.ts`, `test/toolkitRecipe.test.ts`) plus `panes/package.json`; `app/src/styles.ts` also imports from `viz`. The number is load-bearing for how easy the 3D pane is to unplug.

### 11.3 The plan

- **Say where the extracted viewer is.** Section 7 step 2 describes 285 extracted commits, renamed packages, and "nothing is pushed", with no path. No `bim-open-viewer` folder exists within four levels of the home directory, and `~/git/viewer` is the older `ara3d/viewer` repository. Push it to a branch before any other step.
- **Prove B on Gratify inside the toolkit first.** Ten web config files (`tsconfig.json`, `vite.config.ts`, `vitest.config.ts` under `app`, `graph`, `bim-open-notebook`, and `vite.duckdb.config.ts`) and the `file:` dependency in `viz/package.json` point at `submodules/gratify`. Switching them to `deps/gratify` and running the web and viz tests proves junctions under Vite, tsc, vitest, and npm in one session with no new repository. Also pick one consumption mode: the editor aliases Gratify source while `viz` compiles it first with `tsc -p ../submodules/gratify/tsconfig.build.json`.
- **Give the commit-and-pin command its own step with a test.** Every change inside a submodule is two commits in two repositories, and several agents bumping the workspace pointer will race. This is the piece most likely to make the owner want C, and it is one line in step 3. `GIT.md` says nothing about submodules yet. Acceptance: two agents commit to different submodules at once and no pointer bump is lost.
- **Say where tickets go.** `tickets/` lives in the toolkit. TKT-28, one graph over data and 3D, spans three future repositories and has no home in any product.
- **Name what replaces the layering test.** `tests/BimOpenToolkit.Layering.Tests` and `docs/ARCHITECTURE.md` describe one repository with data below flow below mcp below studio. After the split, data and flow are separate repositories and the test's `submodules` exemption describes nothing.

### 11.4 Answers to the nine questions

| # | Answer |
|---|---|
| Q1 | B. C's real advantage is the single CI run; today `build.yml` is one solution build with `submodules: recursive`. Under B each product repository needs its own pipeline running the deps script, so budget for five pipelines, not one. |
| Q2 | A separate working repository, kept to `.gitmodules`, the script, a README, and agent configuration. Plans belong with the product they concern. |
| Q3 | E1 then E2. Going straight to E2 creates a `bim-open-studio` that is most of today's toolkit under a new name, before `bim-open-flow` exists to take the generic half. |
| Q4 | A copy of the script in each repository, checked identical by the workspace. An npx package puts a registry and a network on the bootstrap path of .NET-only repositories. |
| Q5 | `bim-open-workspace` is fine. `bim-open-data` next to `bim-open-schema`, both holding projects named `Ara3D.BimOpenSchema.*`, will be confused for each other. The IFC stack is the larger part; name the repository for it. |
| Q6 | Keep the engine separate. "Knows nothing about buildings" and the conformance suite are its value to a developer, and B makes the extra pin nearly free. |
| Q7 | One submodule. `nrc-ifc-llm` references toolkit .NET projects by relative path, not packages, so it needs the whole tree at one commit, pinned to a tag. |
| Q8 | See 11.2: the SDK is built from the submodule everywhere. Keep it. |
| Q9 | Two known failure modes. Vite's dev server refuses files whose real path is outside its allow list, so every `deps/<x>` junction needs a `server.fs.allow` entry or `resolve.preserveSymlinks`. MSBuild writes `obj/` into the real directory, so the toolkit and `bim-open-flow` building the engine from one linked checkout with different configurations fight over one `project.assets.json`. The existing `dedupe: ["three"]` in the Vite configs shows the npm side of the same problem has already been met. |
