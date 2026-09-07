# Mapping checkpoint

State: verified, source/tests stopped for supervisor corpus/integration gates. Contract: WAVE/Contracts R4.
Read parallel-wave and platonic-coder skills; fences accepted.
Pre-existing model/data/tooling work is untracked; do not stage inherited baseline.
Running commands/processes: none. Build/restore/test deferred to supervisor gate.
Changed: BuildingMapper.cs, ArchitecturalWorkflows.cs, ProjectionValidation.cs and tests/Mapping/ArchitecturalTests.cs.
Implemented public BuildingMapper.Map and ArchitecturalWorkflows.Schedule/Takeoff/Compare.
Typed Storey/Space/Door/Roof, snapshot, document/revision/source-object, policy and evidence records;
source objects limited to selected occurrence/type-owner evidence closure. Full BOS source remains BFAST.
MappingOptions explicit numeric storage policy applied; no display-unit assumption by default.
Workflow report IDs 01/02/03. Finish calculation accepts explicit host/face/scope input, rejects conflicts,
deduplicates equivalent representations and separates opposite faces. Real mapper does not infer finish faces.
Comparison rejects different lineages/policies; missing scope resolves neither additions nor removals;
global IDs survive reordering, duplicates disputed, local-only IDs remain delivery scoped.
Independent fixtures cover counts, relations, type evidence/conflicts, unit uncertainty/conversion,
invalid values, wrong groups/targets, explicit fire rating units, reimport/reorder/changes/omissions,
identity disputes, conservative roof basis and finish scope deduplication/conflicts.
Supervisor first integrated build found CS0411 in Reference<T> generic inference; fixed with explicit Resolve<SnapshotKey<T>>.
Stopped again for supervisor re-build/test. No agent checks run; shared gates owned by supervisor.
Second build: production/CLI compile; test fixture PURE001/004 fixed with sealed fixture and Impure test boundary.
Supervisor gate after repairs: integrated build 0 warnings/errors; new suite 54/54 passes, including 16 mapping cases.
Supervisor Snowdon actual CLI: 84 storeys, 290 spaces, 142 doors, 26 roofs; BFAST load/map/query 6.689 s.
Corpus/reopen verification remains supervisor-owned; no independent agent measurements claimed.
Private per-call mapper builder uses TrustedMutableKernel; immutable results escape. Comparer uses
explicit semantic projections without reflection; JSON serialization is deterministic for typed values.

Profiles inspected: snowdon.json, golden-nugget.json (via input agent findings), all-medium.json.
Snowdon/Golden use RevitAPI prefixes, English categories, raw feet despite diverse display unit labels;
caller must select RevitInternal. Room links: Rvt:FamilyInstance:{FromRoom,ToRoom,Room}.
Both contain linked authoring documents, not automatically multiple established buildings.
all-medium has IFC uppercase categories, empty numeric units and mostly string Level properties;
no string-name join silently substitutes a typed storey relation. IFC numerical semantics remain unknown.
Generic roof Area never establishes net construction-surface quantity. Real finishes remain absent.
Input identity profiles establish complete source GlobalId/Document fields for Snowdon/Golden.
Remaining: supervisor compile/test gates and three-source CLI/persisted reopening; return defects to owner.
