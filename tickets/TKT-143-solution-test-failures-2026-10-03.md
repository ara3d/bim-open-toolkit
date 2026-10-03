---
id: TKT-143
title: Three test projects fail in the CI test run: sample seeding, meshing crash catalog, Parakeet
status: open
depends_on: []
owner:
fence: [tests/flow/BimOpenFlow.BimWorkflows.Tests/**, src/flow/BimOpenFlow.Host/**, tests/data/Ara3D.IfcMeshingComparison/**]
kind: defect
---

## Acceptance criteria

- [ ] dotnet test BimOpenToolkit.sln -c Release --no-build --filter TestCategory!=RequiresTestData reports no failures in BimOpenFlow.BimWorkflows.Tests and Ara3D.IfcMeshingComparison
- [ ] The Parakeet failures are filed in ara3d/parakeet or excluded from the toolkit's solution, with the reason recorded

Seen 2026-10-03 when checking the repository split (docs/plans/repository-split.md); none is caused by the split. 47 of 50 test projects pass. (1) BimSampleSeedingTests.EmptyStore_SeedsEverySampleSource: expected 'federation-match' among the seeded graphs but got 'snowdon-toolkit' at index 39; samples/snowdon-analyses/federation-match.json arrived with TKT-30 (e4d9069, 2026-09-29) and either the seeding list or the test's expectation lags. (2) Ara3D.IfcMeshingComparison CrashCatalog_AllKnownVoidProfileExtrusions_HaveValidMeshIndices: 1 of 235. (3) Ara3D.Parakeet.Tests: 7 of 969, in the submodule's own markdown and C# grammar tests, one of them reading ../../ara3d-sdk beside the submodule. CI runs this step with continue-on-error, so it has not been failing builds.
