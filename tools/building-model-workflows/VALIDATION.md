# Workflow implementation and corpus validation — 2026-09-07

The three supplied BOS files were converted to typed BFAST before the workflow runs. All source columns, including geometry, were retained; per-column hashes were verified. Repeated runs read BFAST and never decode the original Parquet. Original BOS files remain unchanged.

## Delivered and verified

- Separate source-cache, workflow and persistence projects, plus a CLI and focused tests, integrated into `BimBuildingModel.sln`.
- Actual BuildingModel architectural projections and executable APIs for all ten workflow experiments. Six supplemental calculations accept typed request records or CLI JSON input; absent operational inputs are never fabricated from the sample files.
- Full solution build passed with zero warnings/errors on the final incremental build. An earlier dependency rebuild exposed the pre-existing CS8632 nullable annotation warning in `Ara3D.BimOpenSchema/DataTableFromEntities.cs:72`; this wave did not change it.
- All **54 new tests** passed: 16 mapping/workflow cases, 28 operations cases, four BFAST fidelity/corruption cases and six persistence/portfolio cases. All **40 existing BuildingModel tests** also passed. No tests were skipped.
- All three corpus runs completed. Workflow output, coverage and diagnostics matched byte-for-byte after reopening their persisted typed projections in fresh processes.
- The synthetic JSON estimate example executed through the CLI and produced the independently expected **CAD 220** for two units at CAD 100 with 10% waste. This result is not associated with any source building.

## Actual source scope

These are counts of mapped source occurrences, not deduplicated physical portfolio counts. Source documents may contain links and do not establish physical buildings.

| Source | Source entities | Source documents | Storeys | Spaces | Doors | Roofs |
|---|---:|---:|---:|---:|---:|---:|
| all-medium | 1,237,191 | 224 | 1,264 | 6,641 | 8,467 | 450 |
| Snowdon Towers | 51,139 | 7 | 84 | 290 | 142 | 26 |
| Golden Nugget | 27,374 | 2 | 136 | 146 | 54 | 20 |

Snowdon and Golden Nugget runs explicitly selected Revit internal numeric storage, supported by the source profiles and existing repository conversion policy. IFC-derived all-medium values with unestablished storage units remain unresolved. Full source profiles retain raw descriptors, units, values and reference examples under `artifacts/building-model-source-probe`.

## Measured timings and memory

Timings are observations on this workstation, with the installed .NET 10.0.400 SDK targeting .NET 8. Each workflow/reopen measurement used a fresh CLI process; the OS file cache was not controlled. These are individual observations, not percentile guarantees or cold-disk benchmarks. Peak memory below means process peak working set; no workflow workers were spawned.

| Source | Initial BOS→BFAST preparation | BFAST bytes | BFAST load + map + first query | Peak working set for that run | Prepared projection open + query | Reopen peak working set |
|---|---:|---:|---:|---:|---:|---:|
| all-medium | 17.012 s | 1,622,158,592 | 13.267 s | 2,954.7 MiB | 2.416 s | 236.1 MiB |
| Snowdon | 3.470 s | 88,940,160 | 4.002 s | 912.1 MiB | 0.805 s | 93.6 MiB |
| Golden Nugget | 2.132 s | 88,486,720 | 2.475 s | 507.9 MiB | 0.539 s | 65.9 MiB |

Preparation and workflow timing came from separate invocations. Final source loading verifies each accessed buffer's hash. All geometry is retained in BFAST, but these architectural queries skip it. The domain JSON projection sizes were 73,315,345, 16,282,851 and 9,883,552 bytes respectively; the projection retains referenced evidence, while BFAST preserves all source rows.

**The prepared architectural projection met the ten-second opening target in these runs. The all-medium BFAST source-loading/mapping path did not.** This is not a measurement of full geometry browsing or unrestricted portfolio analysis. The existing generic DataModel loader still materializes core tables and indexes; BFAST conversion removes repeated Parquet decoding but does not remove those allocations.

## What the experiments established and what remains open

1. **Schedules are source-backed and usable.** Snowdon has 142 mapped doors; 142 have nominal heights, 141 have unambiguous nominal widths and one has conflicting width observations. There are 65 explicit fire-rating durations, but zero established clear widths. Nominal dimensions are not substituted for clear passage dimensions. 140 doors have observed space links, with relationship completeness still partial.
2. **Roof/finish material takeoff needs a reviewed mapping basis.** The files expose generic quantities, but this adapter has no confirmed mapping to net membrane surface area or independently measured room-facing finish scopes. Real reports show the roof inventory and missing measurements. Opposite-face accounting, duplicate prevention, conflicts and partial totals pass controlled fixtures; a complete real-source takeoff remains unproven.
3. **The supplied files are not a revision pair.** The comparison implementation passes reordering, changed facts, policy mismatch, disputed identity and incomplete-scope fixtures. Actual change detection awaits two comparable source revisions and explicit correspondence/scope evidence.
4. **Operational calculations are implemented and fixture-tested.** Pricing, delivery corrections/substitutions, directed service traversal, registered bounds candidates, maintenance/replacement history and material carbon all have independently checked cases. Their results on these actual buildings require corresponding external inputs. Missing topology is not proof of disconnection; bounds candidates are not exact clashes or clearance approval.
5. **Provenance must be complete at the projection boundary.** Source documents and interpretation policies are now persisted alongside the records that reference them. Source locators are limited to the referenced evidence closure, keeping reopening bounded while the full source remains available in BFAST.
6. **The design needs a few explicit supplemental concepts.** Receipt revision identity, accepted substitutions, direction evidence, frame registration and asset replacement links are represented in workflow request records. Decide which should graduate into the shared building model after real operational input examples are obtained.
7. **Portfolio aggregation needs building identities.** The current comparison reports source-local coverage. It deliberately does not sum overlapping source scopes, select arbitrary revisions or rank incomparable cost/carbon metrics.

## Reproduction and retained evidence

See [README.md](README.md) for preparation and run commands. The full small workflow suite is:

```powershell
dotnet test tests/Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests/Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests.csproj --no-build --no-restore
./tools/building-model-workflows/run-samples.ps1
```

The second command uses existing BFAST caches. Add `-Prepare` only for initial preparation or explicit source verification/repreparation.

Local artifacts include `tests/workflow-tests.trx`, `tests/model-tests.trx`, per-source `metrics.json`, `source-inventory.json`, `coverage.json`, `diagnostics.json`, CSV schedules, `projection.json`, and matching `reopened/` outputs. The workflow source/project/script fingerprints in `gate-inputs-before.txt` and `gate-inputs-after.txt` matched across the corpus gate. All three agents acknowledged stopped writers/processes before integrated builds/tests; later edits were documentation and the separately checked synthetic request only.

Restore used the already installed user package cache and sibling Platonic artifacts. The offline build command disabled NuGet audit for that invocation only; package advisory checking was not part of this validation. No repository NuGet policy was changed.

BuildingModel, DataModel and shared tooling were already untracked at the start; publishing only the new workflow files would omit their required foundation. The implementation wave initially retained all changes locally. The user subsequently authorized committing and pushing the entire pending baseline, including those dependencies and the other pending repository changes. Generated BFAST caches and build artifacts remain local under the existing ignore rules.
