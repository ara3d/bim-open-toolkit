---
id: TKT-143
title: Three test projects fail in the CI test run: sample seeding, meshing crash catalog, Parakeet
status: done
depends_on: []
owner:
fence: [tests/flow/BimOpenFlow.BimWorkflows.Tests/**, src/flow/BimOpenFlow.Host/**, tests/data/Ara3D.IfcMeshingComparison/**]
kind: defect
---

## Acceptance criteria

- [x] dotnet test BimOpenToolkit.sln -c Release --no-build --filter TestCategory!=RequiresTestData reports no failures in BimOpenFlow.BimWorkflows.Tests and Ara3D.IfcMeshingComparison
- [x] The Parakeet failures are filed in ara3d/parakeet or excluded from the toolkit's solution, with the reason recorded

Seen 2026-10-03 when checking the repository split (docs/plans/repository-split.md); none is caused by the split. 47 of 50 test projects pass. (1) BimSampleSeedingTests.EmptyStore_SeedsEverySampleSource: expected 'federation-match' among the seeded graphs but got 'snowdon-toolkit' at index 39; samples/snowdon-analyses/federation-match.json arrived with TKT-30 (e4d9069, 2026-09-29) and either the seeding list or the test's expectation lags. (2) Ara3D.IfcMeshingComparison CrashCatalog_AllKnownVoidProfileExtrusions_HaveValidMeshIndices: 1 of 235. (3) Ara3D.Parakeet.Tests: 7 of 969, in the submodule's own markdown and C# grammar tests, one of them reading ../../ara3d-sdk beside the submodule. CI runs this step with continue-on-error, so it has not been failing builds.

## Resolution (2026-10-03, repository split phase 4)

1. Sample seeding: fixed by e603d29 (the test expects federation-match to be skipped, as TKT-83 designed). BimOpenFlow.BimWorkflows.Tests passes 29 of 29.
2. Meshing crash catalog: the test moved with tests/data to ara3d/bim-open-data. It failed because none of its six corpus models (example.ifc, dental_clinic.ifc, and four more, never committed) was present, and it asserted that at least one had run. In bim-open-data c6916da it reports a skip when none is present and still fails on an out-of-range index when any is. The toolkit's solution no longer contains the project; bim-open-data's filtered test run passes 10 of 10 projects on a fresh clone.
3. Parakeet: Ara3D.Parakeet.Tests and Ara3D.Parakeet.ConsoleApp are out of BimOpenToolkit.sln (9b20d0a) and were never added to BimOpenData.sln. Their 7 failures (markdown and C# grammar tests, one reading ../../ara3d-sdk beside the checkout) belong to ara3d/parakeet and are not filed there yet. Ara3D.IfcTypeGen in bim-open-data still references the test project for its EXPRESS file helpers, which builds it but does not run it.

After both commits the toolkit's CI-filtered test run passes 41 of 41 projects.
