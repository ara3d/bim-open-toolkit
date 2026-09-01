# Contracts — initial population wave (2026-08-30)

See PLAN.md for the full plan. This wave lands Phases 0–4 (Revit postponed).
Test data is never committed (see data/README.md).

## Fences (who writes where)

Supervisor-owned (tracks READ only; request smallest unblocking change via NOTES.md):
`Directory.Build.props` (root/src/tests), `.gitignore`, `.gitmodules`,
`submodules/gratify`, `BimOpenToolkit.sln`, root `README.md`, `PLAN.md`,
`data/README.md`, `data/get-test-data.ps1`, `.github/workflows/**`, this doc.

| Track | Writes only |
|---|---|
| A tiers 0–1 | `src/Ara3D.Utils/**`, `src/Ara3D.Memory/**`, `src/Ara3D.Collections/**`, `src/Ara3D.Logging/**`, `src/Ara3D.F8/**`, `src/Ara3D.PropKit/**`, `src/Ara3D.Geometry/**`, `src/Ara3D.DataTable/**`, `src/Ara3D.IO.BFAST/**`, `src/Ara3D.IO.StepParser/**`, `src/Ara3D.Models/**` |
| B tier 2 | `src/Ara3D.BimOpenSchema/**`, `src/Ara3D.BimOpenSchema.IO/**`, `src/Ara3D.BimOpenSchema.Harmonizer/**`, `src/Ara3D.IfcLoader/**`, `src/Ara3D.IfcTypes/**`, `src/Ara3D.Ifc.Mesher/**`, `src/Ara3D.IO.GltfExporter/**`, `src/Ara3D.Ifc.Editing/**` |
| C tiers 3–4 | `src/Ara3D.MCP/**`, `src/Ara3D.Ifc.Mcp/**`, `tests/**` (except tests/Directory.Build.props) |
| D PlatoFlow | `platoflow/**` |
| S supervisor | everything else; solution file; integration + full gate |

## Seams

- All copied projects land flat under `src/` (no ext/wip split). Project references
  become `..\<Name>\<Name>.csproj`. Tests reference `..\..\src\<Name>\<Name>.csproj`.
- `Ara3D.Ifc.Editing` (Track B provides, Track C consumes): new library at
  `src/Ara3D.Ifc.Editing/Ara3D.Ifc.Editing.csproj`, promoted from the six files in
  `tests/Ara3D.Ifc.Tests` (IfcSourceFile, IfcEntitySpan, IfcDiff, IfcPatcher,
  IfcPropertySetBuilder, IfcPropertyValue). Keep the files' existing namespaces.
- gratify: git submodule at `submodules/gratify` (Track D repoints the Vite alias).
- Test fixtures resolve to `data/` at repo root, populated by `data/get-test-data.ps1`.
- Package versions come from root `Directory.Build.props` `$(Ara3D...Version)`
  properties — do not hardcode versions; request additions via NOTES.md.
- Provenance: each copied project gets a README note (or a line appended) naming
  source repo, path, and commit SHA.

---

# Contracts — BimOpenFlow rewrite, waves 0–1 (2026-08-31)

Implements `docs/bimopenflow-structure.md`. Wave 0 (landed by supervisor):
`spec/dataflow-graph/` drafts (SPEC track), `contracts/` + codegen,
`Ara3D.DataFlowEngine.Abstractions`, web workspace root + `@bimopenflow/contracts`.

## Fences (who writes where)

Supervisor-owned (tracks READ only; request smallest unblocking change via NOTES.md):
`docs/bimopenflow-structure.md`, `contracts/**`,
`src/Ara3D.DataFlowEngine.Abstractions/**`, `bimopenflow/web/package.json`,
`bimopenflow/web/packages/contracts/**`, `BimOpenToolkit.sln`,
`Directory.Build.props` (all), this doc.

| Track | Writes only |
|---|---|
| SPEC | `spec/dataflow-graph/**` |
| NG NodeGraph | `src/Ara3D.NodeGraph/**`, `tests/Ara3D.NodeGraph.Tests/**` |
| EXP Expressions | `src/Ara3D.DataFlowEngine.Expressions/**`, `tests/Ara3D.DataFlowEngine.Expressions.Tests/**` |
| DUCK DuckDb | `src/Ara3D.BimOpenSchema.DuckDb/**`, `tests/Ara3D.BimOpenSchema.DuckDb.Tests/**` |
| VCORE viewer | `viewer/**` (whole workspace this wave, incl. its package.json + lockfile) |
| VIZ viz | `bimopenflow/web/packages/viz/**` + may run `npm install` in `bimopenflow/web` and commit the lockfile |
| S supervisor | everything else; sln membership; integration + full gate |

No shared servers this wave. Tests are per-project; supervisor runs the full gate.

## Frozen seams (wave 0 decisions — build against these, don't redesign)

- **Value kinds on edges** (Abstractions `FlowValue`): Boolean, Integer(Int64),
  Number(double), Text, Table(`Ara3D.DataTable.IDataTable`). Ports add `Any`.
- **Node identity**: dotted string kind (e.g. `source.model`) + integer version.
  Capability: Pure | Effect (Effect nodes run only inside an explicit Run).
- **Param kinds**: Boolean, Integer, Number, Text, Enum, FilePath, ModelRef,
  Expression, Json. Param values travel as canonical invariant strings
  (`ParamValues`).
- **Graph document** (`.dfg.json`): four layers. `structure`: `nodes`
  `[{id, kind, version}]`, `edges` `[{from: "nodeId.port", to: "nodeId.port"}]`;
  `values`: `{nodeId: {paramName: string}}`; `layout`: `{nodeId: {x, y}}` (+
  optional w/h); `session`: free-form presentation state. `structure+values`
  fully determine evaluation.
- **Canonical JSON**: UTF-8, LF, 2-space indent, object keys sorted
  alphabetically at every level, integers plain, doubles shortest round-trip
  ("R"). Graph hash = SHA-256 of canonical `{structure, values}` subdocument.
- **Expression language**: literals (boolean/integer/number/text), identifiers =
  column refs (bare or `[quoted]`), unary `-`/`not`; `* / %`; `+ -`; `&` (text
  concat, converts scalars to canonical text); comparisons; `and`; `or`;
  `cond ? a : b` (right-assoc, lowest). `/` always yields Number; `%` Integer
  only; `+ - *` Integer if both Integer else Number; Integer widens to Number.
  Null propagates through every operator; `coalesce` returns first non-null.
  Builtins: abs, min, max, round, floor, ceil, len, lower, upper, contains,
  startswith, endswith, coalesce.
- **Contracts codegen**: edit `contracts/contracts.json`, run
  `node contracts/generate.mjs`, commit outputs. TS lands in
  `@bimopenflow/contracts` (viz/api-client import it; never hand-copy types).
- **C# conventions**: net8.0; SDK packages via `$(Ara3DSdkVersion)`; NUnit test
  projects copy the pattern of `tests/Ara3D.BimOpenSchema.Tests`; follow the
  house C# style (immutable, expression-bodied, `IReadOnlyList`).

## Wave 4 fences (2026-08-31, later)

Supervisor additionally owns: `bimopenflow/web/packages/api-client/**` (fully generated).

| Track | Writes only |
|---|---|
| EFF | `src/BimOpenFlow.Nodes.Effects/**`, `tests/BimOpenFlow.Nodes.Effects.Tests/**` |
| MIG | `src/Ara3D.NodeGraph.Migrations/**`, `tests/Ara3D.NodeGraph.Migrations.Tests/**` |
| CAT | `src/BimOpenFlow.Host.Catalog/**`, `tests/BimOpenFlow.Host.Catalog.Tests/**` |
| STO | `src/BimOpenFlow.Host.Store/**`, `tests/BimOpenFlow.Host.Store.Tests/**` |
| STATE | `bimopenflow/web/packages/state/**` + may run `npm install` in `bimopenflow/web` and commit the lockfile |
| PANES | `bimopenflow/web/packages/panes/**` — NO npm install (lockfile belongs to STATE this wave); use tsconfig/vitest path aliases to sibling package sources |

New frozen seams: host HTTP API + shared app types live in `contracts/contracts.json`
("endpoints" section); the TS client (`@bimopenflow/api-client`) and C# `ApiRoutes`
are generated — never hand-edit. SSE endpoint `analysisEvents` streams `EvalUpdate`.

---

# Contracts — table sandbox wave (2026-08-31)

Implements the table-only sandbox (SQL/DuckDB/CSV/XLSX/SQLite workflows).
Wave 0 (landed by supervisor): engine optional input ports (PortSpec.Optional,
MissingValue placeholder, memo key = connected ports only), PortDescriptor.optional
through contracts codegen, skeleton NodeSpecs for the two new packs, sample CSVs
under samples/tables/.

## Fences (who writes where)

Supervisor-owned (tracks READ only; request smallest unblocking change via NOTES.md):
`src/Ara3D.DataFlowEngine.Abstractions/**`, `src/Ara3D.DataFlowEngine/**`,
`contracts/**`, `samples/tables/*.csv`, `BimOpenToolkit.sln`,
`Directory.Build.props` (all), this doc.

| Track | Writes only |
|---|---|
| A duckdb | `src/BimOpenFlow.Nodes.DuckDb/**`, `tests/BimOpenFlow.Nodes.DuckDb.Tests/**` |
| B tables | `src/BimOpenFlow.Nodes.Tables/**`, `tests/BimOpenFlow.Nodes.Tables.Tests/**` |
| C host+workflows | `src/BimOpenFlow.Host/**`, `tests/BimOpenFlow.TableWorkflows.Tests/**`, `samples/tables/*.xlsx`, `samples/tables/*.sqlite`, `samples/tables/*.duckdb` |
| S supervisor | everything else; integration + full gate |

## Seams

- Node kinds, ports, and params are FIXED in the skeleton NodeSpecs (wave 0) —
  implement bodies; do not change Spec shapes without a NOTES.md contract request.
- sql.query table naming: connected inputs register as t1..t4; `t` is a view of t1.
- Read-only SQL validation: reuse `BosDuckDbQueries.ReadOnlyQuery` (DuckDb pack);
  Tables pack implements its own single-statement SELECT/WITH check for SQLite.
- Track C provides `HostComposition.TablePacks()` (DuckDbNodes.All + TableNodes.All
  + the four table.* nodes cherry-picked from the Bos pack) and a `--profile`
  option (`bim` default | `tables`); Tracks A/B do not touch the host.
- File-reading nodes cache by file content hash (the BosLoadNode pattern); the
  engine's memo does not see file content (known staleness wart, out of scope).

---

# Contracts — sandbox UI wave (2026-08-31)

UI improvements to the table sandbox. Supervisor pre-landed: green web baseline
(PortDescriptor.optional in test literals) and the canvas theme seam
(`packages/app/src/canvasTheme.ts` names + `CanvasEditor.setTheme` stub).

## Fences (who writes where)

Supervisor-owned (tracks READ only; request via NOTES.md): `bimopenflow/web/packages/{state,panes,viz,api-client,contracts}/**`,
`contracts/**`, `src/BimOpenFlow.Host.Api/**`, `submodules/gratify`, `platoflow/**`,
`samples/tables/*.csv`, `BimOpenToolkit.sln`, this doc.

| Track | Writes only |
|---|---|
| A shell-ux | `bimopenflow/web/packages/app/src/**` EXCEPT canvas*.ts and viewModel.ts; `bimopenflow/web/packages/app/test/**` EXCEPT canvasIntents/canvasParts/viewModel tests |
| B canvas | `bimopenflow/web/packages/app/src/{canvasEditor,canvasIntents,canvasParts,canvasTheme,viewModel}.ts`; `bimopenflow/web/packages/app/test/{canvasIntents,canvasParts,viewModel,canvasTheme}.test.ts` |
| C samples | `samples/analyses/**`, `src/BimOpenFlow.Host/**`, `tests/BimOpenFlow.TableWorkflows.Tests/**` |

## Seams

- Theme: canvasTheme.ts names are the contract; A renders the picker + persists
  choice in localStorage and calls editor.setTheme; B implements the themes
  (platoflow/web/src/theme.ts is the light-theme model) and the actual setTheme.
- A may not change the CanvasEditor interface; B may not change shell/topbar.
- Sample analyses (C) must validate against HostComposition.TablePacks() and use
  a {SAMPLES} path placeholder rewritten to the absolute samples/tables dir at
  seed time.
