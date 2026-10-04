---
id: TKT-152
title: Linked-mode .NET build fails: ara3d-dataflow and bim-open-schema find the wrong Directory.Build.props
status: open
depends_on: []
owner:
fence: [deps.mjs, Directory.Build.props, Directory.Build.targets]
kind: defect
---

## Acceptance criteria

- [ ] With every deps/ entry linked to a sibling under a .deps-root folder, the Release build of the toolkit succeeds and host smoke passes
- [ ] A fresh clone with every entry cloned still builds

Found in chunk 6.11 (phase 6 build log). When linked, ara3d-dataflow and bim-open-schema look for their host's Directory.Build.props above their own folder, which is then the workspace folder, so they restore the 1.6.1 NuGet SDK and Ara3D.DataTable is missing (30 errors). A workspace-level shim that imports the toolkit's build files then evaluates projects under two paths (the deps junction and the sibling) that share obj/. The fix needs a change in ara3d-dataflow and in how the solution names linked projects. Criterion 7 of docs/plans/repository-split-phase-6.md is not met until this is fixed; another agent is working on it.
