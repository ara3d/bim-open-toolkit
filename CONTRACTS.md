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
