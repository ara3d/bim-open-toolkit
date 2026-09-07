# Operations track

State: verified by supervisor integrated gates; actual corpus/reopening gates remain supervisor-owned. Contract R4 read and acknowledged; shared Contracts.cs unchanged. Ownership: Operations source and Operations tests only.

Read parallel-wave and platonic-coder skills, wave plan, shared contracts and workflow proposal. No existing files in owned subtree were replaced. No builds, restores, background processes or Git index operations have run.

Public API namespace: `Ara3D.BimOpenSchema.BuildingModel.Workflows.Operations`.

- `OperationsWorkflows.InputRequirements(BuildingProjection)` returns six actual-source reports (04–09), each RequiresInput. Source occurrence IDs do not establish external operational facts.
- `Estimate(EstimateRequest)` creates model EstimateLine and EstimateSummary records with explicit scenario/catalog, known subtotal, complete total only for complete scope, disjoint scope validation and per-line decimal rounding.
- `Reconcile(ReconciliationRequest)` retains receipt revisions and installation histories, replaces older receipt revisions, does not infer installation, and requires product/substitution decisions.
- `Trace(TraceRequest)` traverses supplied directed connections, records predecessor evidence, handles cycles and stops at unknown states/direction, rejected inferred edges and query limits.
- `Coordinate(CoordinationRequest)` registers already resolved bounds, yields bounds candidates and deduplicated penetration memberships; no exact clash/compliance claim.
- `Maintain(MaintenanceRequest)` registers handover gaps, keeps replacement histories and derives due dates only under an explicit complete-history scheduling policy.
- `Carbon(CarbonRequest)` calculates one selected compatible module/method, leaf scopes only, tracks excluded assembly totals and unresolved contributions.

28 controlled NUnit tests written in CommercialTests.cs, SpatialAndTopologyTests.cs and LifecycleTests.cs with shared pure Examples.cs fixture constructors. Tests cover expected arithmetic, known-zero/missing distinctions, incompatible units/currencies, duplicate scope, receipt reingestion from freshly constructed records, revisions/substitutions, installation correction history, graph cycles/direction/state/inference/truncation, invalid enum/dangling input, registered rotated bounds, missing registration, duplicate geometry, shared assemblies, due-date arithmetic/history/evidence/replacement, carbon boundaries/factors/assembly exclusion and six source-input readiness reports. All fixture inputs are synthetic and tests carry Source.Synthetic. Integration supervisor owns build/test gates; none run by this track yet.

Supervisor reports integrated solution build passed with zero warnings/errors and the new test suite passed 54/54 with no skips, including all 28 operations tests. One integration compile fix qualified `Examples.Geometry` to avoid the Ara3D.Geometry namespace; those inputs are included in the passing gates. Source/test writers and commands remain stopped. This checkpoint-only update was authorized after verification.

No staging or commits performed. Publication is constrained by inherited untracked BuildingModel/DataModel/tools dependencies; supervisor retains responsibility for resolving that baseline. Runtime behavior against unavailable external operational inputs remains unproven; passing controlled synthetic fixtures does not supply rates, receipts, topology, registrations, maintenance logs or environmental factors for the actual samples.

Limits and design findings: receipt correction version, accepted-substitution basis, directed edge evidence, direct frame registration and replacement links need supplemental contracts. No returns/net inventory semantics, FX/unit/density conversions, hydraulic solver, inferred internal component connectivity, exact solid intersection or general maintenance scheduler. Disjoint scopes are caller-established assertions; names alone cannot prove physical disjointness. Unknown source operation capabilities remain unproven.
