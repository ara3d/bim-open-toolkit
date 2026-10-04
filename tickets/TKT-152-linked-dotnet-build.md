---
id: TKT-152
title: Linked-mode .NET build fails: ara3d-dataflow and bim-open-schema find the wrong Directory.Build.props
status: closed
depends_on: []
owner:
fence: [deps.mjs, Directory.Build.props, Directory.Build.targets]
kind: defect
---

## Acceptance criteria

- [x] With every deps/ entry linked to a sibling under a .deps-root folder, the Release build of the toolkit succeeds and host smoke passes
- [x] A fresh clone with every entry cloned still builds

Found in chunk 6.11 (phase 6 build log). When linked, ara3d-dataflow and bim-open-schema look for their host's Directory.Build.props above their own folder, which is then the workspace folder, so they restore the 1.6.1 NuGet SDK and Ara3D.DataTable is missing (30 errors). A workspace-level shim that imports the toolkit's build files then evaluates projects under two paths (the deps junction and the sibling) that share obj/. The fix needs a change in ara3d-dataflow and in how the solution names linked projects. Criterion 7 of docs/plans/repository-split-phase-6.md is not met until this is fixed; another agent is working on it.

## Resolution (2026-10-04)

The fix needed no change in ara3d-dataflow or the solution. Two causes: `DepsRoot` pointed at the sibling checkout while the solution named `deps\<name>`, a junction MSBuild does not resolve, so each shared project had two paths and one `obj\`; and `deps.mjs` linked a dependency's dependencies only into that dependency's `deps\`. Now `deps.mjs` links the whole closure into the top repository's `deps\`, and `DepsRoot` is the repository's own `deps\` (or the parent `deps\` when the repository is itself a dependency). Commits: bim-open-flow `5e14455`, `147d9c0`; bim-open-data `0af9822`, `16ea129`; bim-open-notebook `9549140`; bim-open-viewer `aa419cd`; the toolkit's `Directory.Build.props` and `deps.mjs` in the commit that closes this ticket. Verified linked and cloned: toolkit Release build 0 errors, CI-filter tests 19 assemblies, NrcWorkflows 70 of 70, host smoke; flow 25 assemblies; data 10 assemblies. Do not build two repositories of one linked workspace at the same time: each re-restores the shared projects under its own path.
