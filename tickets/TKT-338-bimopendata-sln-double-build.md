---
id: TKT-338
title: Whole-solution builds of BimOpenData.sln inside the toolkit build every SDK, schema and Parakeet project twice, by two paths into the same output folders, so a warm build is never incremental
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/BimOpenData.sln, deps/bim-open-data/Directory.Build.props, deps/bim-open-data/Directory.Build.targets, deps/bim-open-data/scripts/**, deps/bim-open-data/README.md, deps.json, docs/plans/build-times.md]
workflow: [process]
related: [TKT-321, TKT-197]
confidence: high
created: 2026-10-18
kind: defect
---

## Acceptance criteria

- [ ] inside the toolkit, each dependency project (ara3d-sdk, bim-open-schema, parakeet) appears once in the build of BimOpenData.sln: one path per project in the solution and in every ProjectReference, checked by a script that fails on two paths to the same project file
- [ ] a second whole-solution build with no source change compiles nothing (no Csc task runs, from a binlog) and takes a small fraction of the first; both times are recorded in docs/plans/build-times.md
- [ ] compiler warnings name each Ara3D.Geometry file once, not from two copies
- [ ] the standalone layout still works: a fresh clone of bim-open-data with node deps.mjs builds BimOpenData.sln
- [ ] bim-open-flow's solution is checked for the same fault, and fixed here or recorded in TKT-197

Found 2026-10-18 by the TKT-321 solution-filter measurement (docs/plans/build-times.md, toolkit c14c95e8). The owner rates it very important. Mechanism: BimOpenData.sln lists the dependency projects through bim-open-data's own deps/ folder, for example deps\ara3d-sdk\src\Ara3D.Utils\Ara3D.Utils.csproj, where deps/bim-open-data/deps/ara3d-sdk is a link to bim-open-toolkit/deps/ara3d-sdk. Inside the toolkit, the DepsRoot rule in deps/bim-open-data/Directory.Build.props (a deps parent folder with a .deps-root marker) sends project references to bim-open-toolkit/deps/ instead. MSBuild compares project paths as written, so it sees two projects per dependency and builds both into the same output folders, each overwriting the other. Evidence: warnings arrive from both copies of Ara3D.Geometry; warm whole-solution builds took 43 to 57 s against 49 to 57 s cold. The Directory.Build.props comment says the rule makes MSBuild see one project, not two: true for project references, false for the solution's own entries. Fix options from the finder: (a) list the dependencies in BimOpenData.sln by a path that agrees with DepsRoot in both layouts; (b) have Directory.Build.props use the repository's own deps/ links whenever they exist, so solution and references agree. Overlapping outputs can also corrupt a build silently (a stale assembly from the other copy), so this is a correctness risk as well as a time cost. Single-project builds (dotnet build <project>.csproj) do not list the solution's entries and are not affected; supervising sessions' whole-solution checks before pin moves and closes are.
