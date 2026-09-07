# Building-model workflow wave

Checkout: `C:/Users/cdigg/git/bim-open-toolkit` (shared).
Contract: R4, `src/Ara3D.BimOpenSchema.BuildingModel.Workflows/Contracts.cs` and the existing BuildingModel/DataModel public records. R2 established BFAST preparation before repeated tests/workflows. R3 adds explicit numeric storage policy (Unknown/DeclaredDescriptor/RevitInternal). R4 adds trailing source Documents and interpretation Policies arrays to close provenance references. Mapping writer paused and acknowledged before edits, no affected checks had run. Other tracks' existing signatures remain compatible. No agent edits shared contracts without a coordinated revision.

Acceptance: runnable workflow suite and CLI using the three user-supplied BOS files; actual BuildingModel projections, explicit field coverage/provenance, independent controlled fixtures for unavailable external data, versioned persistence and prepared reopening, reports for all ten proposed workflows. Report unavailable source capabilities and failed performance gates honestly. Never invent receipts, rates, topology or revision pairs for real-file results.

Baseline: the affected projects and supporting tools are pre-existing untracked work, previously surfaced to the user. Preserve them. Existing BuildingModel 40 tests passed in the preceding assessment. New project baselines and sample loading are being established in this wave.

Supervisor owns contracts, all project/solution integration except the probe subtree, CLI/persistence, aggregate reports, this plan, verification and publication. No source samples are writable. Runtime reports/cache go under ignored `artifacts/building-model-workflows` only. No services/ports needed.

Commit turn: none. Request a turn after scoped verification. Existing untracked dependencies prevent a self-contained commit without a separately reviewed baseline; do not stage inherited files. The supervisor will resolve publication after integration.

| Track | Exclusive writable paths | Readiness and checks | Resources |
|---|---|---|---|
| input | `src/Ara3D.BimOpenSchema.BuildingModel.Source/**`, `tests/Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests/SourceReaderTests.cs`, `tools/building-model-source-probe/**` | R2; BOS-to-BFAST preparation, fingerprinted lossless column cache including geometry/manifest, selective core loading into BimModel and source profile. Own new source/probe project manifests. Probe may build after its own edits stop; do not build the new workflow/test project. | Own probe output, `artifacts/building-model-source-probe/**` and source BFAST caches under `artifacts/building-model-workflows/cache/**`; exclusive source/probe dependency builds until notified. |
| mapping | `src/Ara3D.BimOpenSchema.BuildingModel.Workflows/Mapping/**`, `tests/Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests/Mapping/**` | R1; implement `BuildingMapper.Map(BimModel, MappingOptions)`, `ArchitecturalWorkflows.Schedule(BuildingProjection)`, `Takeoff(BuildingProjection)`, `Compare(BuildingProjection, BuildingProjection, bool completeComparableScope)`. Supervisor runs tests after writers stop. | Checkpoint `Mapping/CHECKPOINT.md`; no build/restore during active writers. |
| operations | `src/Ara3D.BimOpenSchema.BuildingModel.Workflows/Operations/**`, `tests/Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests/Operations/**` | R1; reusable pure calculations for workflows 4–9 with explicit typed input contracts local to owned directory and controlled fixtures. Supervisor runs tests after writers stop. | Checkpoint `Operations/CHECKPOINT.md`; no build/restore during active writers. |

All agents read and apply parallel-wave and `C:/Users/cdigg/.codex/skills/platonic-coder/SKILL.md`. Checkpoints record working/implemented/verified state, running processes, findings and handoff. Only supervisor assigns integrated state. Git index/commit operations are serialized. Stop all writers before integrated gates and fingerprint inputs before/after.

Required gates: build solution; existing 40 model tests; new mapping, loader, operational and persistence tests; CLI prepare/run/reopen for each supplied file with source SHA256, coverage, workflow readiness, timings and peak process memory; inspect outputs and report failures/gaps separately from passing fixture semantics. Actual three files are unrelated deliveries until source evidence establishes otherwise.

## Integration record

All three tracks are integrated. All acknowledged stopped source/test writers and processes before gates. Final solution build passed; 54 new and 40 existing tests passed without skips. All three BFAST corpus runs and byte-identical reopened workflow/coverage/diagnostic checks passed. Workflow source/project/script input fingerprints matched before/after corpus runs. The standalone synthetic estimate JSON request also passed through the CLI with expected CAD 220.

See VALIDATION.md for measured source scope, timings, memory, baseline warning, cache/runtime limitations and unproven real-source capabilities. Prepared domain opening passed the measured ten-second target; all-medium source loading plus mapping did not. The implementation gates passed; full real-source proofs for revision, takeoff and supplemental workflows still require the named missing evidence.

Publication scope: after the implementation wave, the user explicitly authorized committing and pushing all pending repository work, including the inherited model/DataModel/tooling foundation. The supervisor owns the serialized staging, commit and push. Track checkpoints above record the earlier pre-publication state. Generated caches and build artifacts remain ignored.
