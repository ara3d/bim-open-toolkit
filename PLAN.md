# BIM Open Toolkit — initial population plan

> Plan for copying projects and data into this repository from their current homes
> (`studio/ara3d-sdk`, `studio/labs`, `nrc-ifc-llm`), with the eventual goal of
> removing them from those homes. Written 2026-08-30 (Claude + Christopher Diggins).
>
> BIM Open Toolkit is the open implementation layer around BIM Open Schema (BOS):
> converters (IFC→BOS, Revit→BOS), query/analytics (DuckDB, GLB/glTF export), the
> node-graph editor concept (PlatoFlow, to be rewritten), MCP servers, and the WebGL
> viewer integration. The `bim-open-schema` repo remains the spec/standard; this repo
> is the reference implementation and CI-tests against it. It will be referenced from
> the repo handed to the NRC.

## Principles

1. **Copy, stabilize, repoint, then delete.** Origins keep working until consumers
   (Ara 3D Studio, the NRC repo) reference this repo instead. No flag-day.
2. **Fix-on-entry, don't copy warts.** Extraction is the one moment nothing external
   depends on the new location. Each moved component pays its known debts on the way
   in (list in §5) rather than importing them.
3. **Keep namespaces and project names.** `Ara3D.*` names stay; only the repo moves.
   This keeps the Studio-side repoint to a NuGet/submodule swap, not a code change.
4. **Provenance over history.** Copies land as fresh commits with a provenance note
   (source repo, path, commit SHA) in each project README — the same pinning
   discipline as `bos-validation-evidence.md`. Full git history stays in the origin
   repos, which are not being deleted, only slimmed.

## 1. Inventory — what moves

Dependency tiers, measured from the actual `.csproj` references (2026-08-30).

**Tier 0 — leaf utilities** (no project references):
`Ara3D.Utils`, `Ara3D.Memory`, `Ara3D.Collections`, `Ara3D.Logging`, `Ara3D.F8`,
`Ara3D.PropKit` — from `ara3d-sdk/src`.

**Tier 1 — core data/geometry**:
`Ara3D.Geometry`, `Ara3D.DataTable`, `Ara3D.IO.BFAST`, `Ara3D.IO.StepParser`,
`Ara3D.Models` — from `ara3d-sdk/src`.

**Tier 2 — BOS and IFC**:
`Ara3D.BimOpenSchema`, `Ara3D.BimOpenSchema.IO`, `Ara3D.BimOpenSchema.Harmonizer`
(from `src`); `Ara3D.IfcLoader`, `Ara3D.IfcTypes` (from `ext`); `Ara3D.Ifc.Mesher`
(from `wip`); `Ara3D.IO.GltfExporter` (from `src`).
New at this tier: **`Ara3D.Ifc.Editing`** — promoted from the six source-linked
files in `tests/Ara3D.Ifc.Tests` (`IfcSourceFile`, `IfcEntitySpan`, `IfcDiff`,
`IfcPatcher`, `IfcPropertySetBuilder`, `IfcPropertyValue`). The byte-exact pset
write path is a headline feature of this repo and must be a real library here, not
test code.

**Tier 3 — MCP**:
`Ara3D.MCP` (protocol library) and `Ara3D.Ifc.Mcp` (the ~29-tool IFC/BOS query
server) — from `wip`. The graph-authoring MCP arrives with PlatoFlow in tier 5.

**Tier 4 — tests and fixtures**:
`Ara3D.BimOpenSchema.Tests`, `Ara3D.BimOpenSchema.Harmonizer.Tests`,
`Ara3D.Ifc.Tests` (rewired against `Ara3D.Ifc.Editing`), `Ara3D.Ifc.Mcp.Tests`,
`Ara3D.MCP.Tests`, `Ara3D.DoorClearance.Tests` — from `tests`.
Data: the IFC Test Kit (`nrc-ifc-llm/IFC-Test-Kit`: duplex.ifc, ground-truth and
analytics CSVs) is **copied** here as the toolkit's fixture set; `nrc-ifc-llm`
keeps its copy since it is itself an NRC deliverable. Large perf models stay out
of git (download script or LFS decision in §6).

**Tier 5 — PlatoFlow** (to be rewritten in place here):
`ara3d-sdk/wip/platoflow-poc` — `web/`, `host/`, `demo/` (21 graphs), `tools/`
(headless gates), root docs. Plus the design docs that govern the rewrite:
`platoflow-ifc-design.md`, `platoflow-v1-nodes.md`, `platoflow-graph-semantics.md`,
`platoflow-agent-concepts.md`, `platoflow-compliance-design.md`,
`platoflow-design-principles.md` — copied from `studio/docs` (originals may stay
until the rewrite starts, then this repo's copies become canonical).
Dependencies to resolve: **gratify** (today a `studio` submodule reached by a Vite
alias) and **@ara3d/ara3d-webgl** (npm; see §5 for its required fixes).

**Tier 6 — Revit exporter**:
`plugins/Ara3D.BIMOpenSchema.Revit2025` currently drags the whole Bowerbird plugin
framework (`Bowerbird.Revit2025`, `Bowerbird.RevitSamples`) with it. Decision (§6):
either extract `BosDocumentBuilder`/`MeshGatherer` into a standalone
`Ara3D.BimOpenSchema.Revit` addin with no Bowerbird dependency (preferred — this is
the fix-on-entry version), or defer the Revit exporter to a second pass and ship
tier 0–5 first. Bowerbird itself does NOT move.

**Stays behind** (the paid/private layer): the WPF Studio app, rendering (GL,
OSPRay), `Ara3D.Flow`/SceneEval, DWG/RVT/VIM loaders beyond what's listed,
lakehouse, `Ara3D.Utils.Roslyn`/scripting, Plato compiler output projects
(`Plato.Generated`, `Plato.Intrinsics` — not referenced by anything moving).

## 2. Target layout

```
bim-open-toolkit/
  README.md  LICENSE  PLAN.md
  BimOpenToolkit.sln
  Directory.Build.props            # single owner of TFMs and package versions
  src/                             # tiers 0–3 C# projects, one folder each
  src/Ara3D.Ifc.Editing/           # promoted write path
  tests/                           # tier 4
  data/                            # IFC Test Kit fixtures + sample .bos (CI-regenerated)
  platoflow/                       # tier 5: web/, host/, demo/, docs/
  revit/                           # tier 6 (when it lands)
  docs/                            # provenance notes, architecture, spec conformance
  .github/workflows/               # build + test + sample regeneration
```

## 3. Phases

**Phase 0 — scaffold.** Solution, `Directory.Build.props` (net8.0 default;
`net8.0-windows` only where a native dependency truly forces it), central package
versions (fixes the Parquet.Net drift bug ara3d-081 by construction), CI workflow,
README stating scope and the spec relationship, this plan committed.

**Phase 1 — C# core (tiers 0–2).** Copy in tier order; each tier must build and
its tests pass before the next lands. Create `Ara3D.Ifc.Editing` and rewire
`Ara3D.DoorClearance.Tests`/`Ara3D.Ifc.Tests` against it. Apply the fix-on-entry
items for BOS (§5). Gate: `dotnet test` green on a clean clone with no reference
to `studio` or `ara3d-sdk`.

**Phase 2 — MCP (tier 3).** Copy `Ara3D.MCP` + `Ara3D.Ifc.Mcp`. Fix-on-entry:
expose the transport-free JSON-RPC handler (string in/string out) publicly, and
verify stdio works from Claude Desktop — that is this repo's first outward-facing
win. Gate: the existing stdio end-to-end test pattern passes here.

**Phase 3 — data + samples.** Copy the IFC Test Kit; add a CI job that converts
`duplex.ifc` → `.bos` with the current converter and commits/attests the sample,
ending the spec-vs-samples drift problem. Coordinate with `bim-open-schema` so its
`examples/` point here or get regenerated the same way.

**Phase 4 — PlatoFlow (tier 5).** Copy the PoC and design docs. Resolve gratify
(§6) so `npm install && npm run dev` works from a clean clone of THIS repo alone —
that is the acceptance test. The rewrite then happens here, against
`platoflow-v1-nodes.md`; the PoC copy is the reference implementation to strip
for parts, clearly labeled as such.

**Phase 5 — NRC wiring.** `nrc-ifc-llm` gains a pointer doc (and, where builds are
needed, a pinned submodule or NuGet reference) to this repo. Evidence links in the
NRC docs get re-pinned to bim-open-toolkit SHAs for anything demonstrated from
here. Nothing in `nrc-ifc-llm` is deleted — it is the deliverable record.

**Phase 6 — Revit exporter (tier 6).** Per the §6 decision.

**Phase 7 — remove from origins.** Only after Studio consumes this repo instead:
publish tiers 0–3 as NuGet packages (or add bim-open-toolkit as a submodule of
`studio` — decision in §6), swap `ara3d-sdk` project references, delete the moved
project folders from `ara3d-sdk`, and leave a tombstone note in `wip/README.md`
and `src/README.md` pointing here. Side benefit: shrinks the ~168-project Studio
solution and its 13-minute build. `platoflow-poc` is deleted from `wip/` as soon
as Phase 4's acceptance test passes — it has no other consumers.

## 4. What each phase must NOT break

- Studio's build, until Phase 7 executes the swap.
- The NRC evidence chain: existing pinned SHAs in `bos-validation-evidence.md` and
  `door-clearance-demo.md` remain valid because origin history is never rewritten.
- The `bim-open-schema` spec repo's role as the standard.

## 5. Fix-on-entry checklist

Debts paid during the copy, tracked one issue each once a tracker exists here:

1. `.bos` files gain a schema version marker; one generated owner for the
   parameter-type enum (converter, DuckDB views, TS loader currently hold copies).
2. `IfcDuck.CreateViews` (EntityText/ParameterText/RelationText) moves from the
   MCP project into `Ara3D.BimOpenSchema.IO` — every consumer needs it.
3. Pset write path becomes `Ara3D.Ifc.Editing` (Phase 1).
4. `Ara3D.MCP` exposes a public transport-free JSON-RPC handler; stdio verified
   against Claude Desktop (Phase 2).
5. Central package management pins Parquet.Net (ara3d-081) and DuckDB.NET once.
6. `IfcToBosConverter`: make geometry/native web-ifc dependency optional so
   data-only conversion is cross-platform `net8.0`; `net8.0-windows` only where
   meshing is requested.
7. ara3d-webgl asks (filed upstream, tracked here): `three` as peer dependency,
   float (not int) numeric parameters, per-instance color API, loader progress.
8. Harmonizer: called by both converters by default; parse `IFCUNITASSIGNMENT`
   instead of assuming SI.

## 6. Decisions needed before the relevant phase

1. **gratify delivery** (blocks Phase 4): publish to npm under `@ara3d/gratify`,
   or vendor as a git submodule here. npm preferred — same story as ara3d-webgl.
2. **Studio consumption model** (blocks Phase 7): NuGet packages (clean, versioned,
   slower iteration) vs submodule (fast iteration, submodule friction). Suggest
   NuGet for tiers 0–3 given the SDK already has a nupkg flow.
3. **Revit exporter shape** (blocks Phase 6): standalone addin extraction vs defer.
4. **Large model files**: git LFS vs download script for the 49 MB perf model.
5. **License**: MIT across the board (matches existing repos), or component
   exceptions? Decide before first public push.
6. **Namespace of the toolkit's NuGet org/prefix**: keep `Ara3D.*` (recommended)
   vs rebrand packages `BimOpenToolkit.*`.

## 7. Risks

- **Double-maintenance window** (Phases 1–7): changes landing in `ara3d-sdk`
  copies after the fork. Mitigation: freeze the moved projects in origin (announce
  in `wip/README.md`), keep the window short, and diff-check before Phase 7.
- **Bowerbird entanglement** makes the Revit exporter the likeliest slip; that is
  why it is last and severable.
- **PlatoFlow rewrite scope creep**: the PoC copy is reference material, not a
  foundation to extend. The rewrite tracks `platoflow-v1-nodes.md`.
- **Open-core line**: this repo deliberately open-sources conversion, querying,
  viewing, and graphs. The paid layer (Studio app, rendering, lakehouse, scale,
  batch) stays behind — revisit §1 "stays behind" before each phase adds scope.
