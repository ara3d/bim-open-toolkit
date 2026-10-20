# catalog-validation: TYPE-CATALOG.md sections 10, 11 and 16, and four section 15 concepts, in Plato

Ticket: TKT-323
Status: ready: catalog-validation

## Done
- catalog-validation, 94893ee8 (budgets, committed first for other tracks), f93bf77c (types,
  concepts, libraries, laws) and the commit holding this file (spec, TRACK.md), about 1.2 hours
  against 2 expected: 30 `Law_Catalog_` laws, all pass under cpu64; zero type errors in this folder.

Types added (32 of this track, plus 4 borrowed):
- Budgets (3): `TimeBudget`, `Elapsed`, `WorkBudget` (`catalog-validation-budgets.types.plato`; moved to `00-foundation/foundation-budgets.types.plato` at the catalog-meshing merge, 2026-10-20, its laws stay here).
- Section 10 (18): `LawId`, `LawName`, `Claim`, `Evidence`, `CheckRecord`, `AllowanceSource`,
  `Allowance`, `CompensatedSum`, `OracleAgreement`, `CheckScope`, `PairBudget`, `SampleGrid`,
  `WitnessSpec`, `PerturbationKind`, `Expectation`, `LawVerdictDetail`, `VerdictDelta`, `LevelProof`
  (`LawId` is a stand-in, see Contract requests).
- Section 11 (6): `StageOutcome<T>`, `MeshingEvent`, `Trace`, `RunKey`, `Pending`, `Incremental`.
- Section 15 and 16 (4): `RowDump`, `DiffSummary`, `CorpusRow`, `Benchmark`. `DecidedDifference` was
  declared and then removed at merge (2026-10-20): it duplicated layer 9's `ModelDiff`; `IDiffable.Diff` returns `ModelDiff`.
  (The merge also hit a compiler defect in the library's generic `DifferencesTable`, which depended on the
  program's size, not on this type; the library function was made concrete, see `tooling-dumps.library.plato`.)
- Borrowed (4): `CriterionName`, `RequestSet` (section 7), `Defect`, `DefectReport` (section 13).
- Concepts (4): `IDiffable`, `ICheckable`, `ITraced`, `IWitnessed`. Their BrepModel functions
  exist (`Diff`, `Check`, `Witnesses`); no type declares `implements` yet (see Merge instructions),
  so the CLI lint reports LINT009 "unreachable" for all four. `ITraced` has no implementer.

Choices where the catalog sketches:
- `CompensatedSumOf` is written **beside** layer 6's `CompensatedSum(values)` (Neumaier), as
  Kahan's summation, so the agreement law compares two independent routes. Error is Higham's Kahan
  bound `(2u + 4 n u^2) * sum |x|`; the law allows twice it (each route is within its bound of the
  exact sum, and Neumaier's bound is no larger). The type `CompensatedSum` and the function
  `CompensatedSum(Array<Number>): Number` coexist (different arity).
- `FromRounding(count, resolution)` as a function would be ambiguous with the case constructor
  `AllowanceSource.FromRounding`; the constructors are `AllowanceFromRounding(operations: Count,
  resolution, kind: MeasureKind)`, `AllowanceFromModelTolerance`, `AllowanceFromCriteria`,
  `AllowanceFromOracleBound`, `AllowanceStated`. The kind is a parameter: a resolution has none.
- `ToCheckRecord(c: Check, kind: MeasureKind, samples: SampleCount)`, not `ToCheckRecord(c)`: a
  library `Check` carries no measure kind and no sample count, and inventing either breaks honest
  absence. Bound 0 maps to `ExactEvidence` (layer 0's `CheckExact` convention), otherwise
  `SampledEvidence`. The one-argument form follows once `Check` holds `Measure`s.
- `VerdictDelta` is a change when the two verdicts are different cases (`VerdictOrdinal`); two
  `Fail`s with different evidence are the same verdict.
- `LevelProof { Level; Ran: Array<CheckFamily> }`, built by `LevelProofOf(level)` from layer 7's
  `Requires`; `Proves(p, level)` checks coverage.
- `DecidedDifference` and `DiffSummary` use layer 9's `ModelTable`, not `TableName`: the diff
  tables include closures, tolerances and units, which `TableName` lacks. `RowDump` keeps
  `TableName` as the catalog says.
- `Expectation.IsMet(verdict)`: `ShouldWarn` is met by a pass (a warning is not a failure).
- `Trace` rounds: `RoundsOf(event)` returns zero or one `Round` (no sentinel); `FaceMeshed` and
  `RoundEnded` carry one.
- `Incremental` is built by `IncrementalOf(m, changed: Array<BrepEdgeIndex>)`: a face citing a
  changed edge is redone, every other reused. The changed-edge list stands in for
  `DiscretizationDelta.Changed`.
- `InvarianceOf(PerturbationKind)` names layer 9's `Law_MotionKeepsTopologyRows`,
  `Law_PerturbedShellVolumeFollowsFactor`, `Law_JitterStaysWithinLengthTolerance`.

Laws (30, all pass, cpu64, 2026-10-20; the three numeric ones also pass under gpu32):
TimeBudgetIsNonNegative, ElapsedIsNonNegative, WithinBudgetIsMonotone, WorkBudgetIsNonNegative,
WorkTotalIsAdditive, WorkIsWithinItsSum, LawNameKeepsId, ToCheckRecordPreservesHolds,
ToCheckRecordPreservesExactHolds, ToCheckRecordKeepsLaw, RoundingAllowanceIsCountTimesResolution,
RoundingAllowanceKeepsKind, OracleAgreesIffWithinAllowance, BenchmarkMeetsItself,
OracleOfOtherKindNeverAgrees, CompensatedSumAgreesWithLibrary, CompensatedSumErrorIsNonNegative,
CompensatedSumCountsTerms, PairScopeRespectsBudget, PerElementScopeIsUnlimited,
VerdictDeltaChangesOnlyWhenVerdictsDiffer, ShouldPassIsMetOnlyByPass, ShouldFailIsNotMetByPass,
LevelProofProvesItsLevel, StructuralProofIsNotOracle, TraceRoundsAreMonotone,
TraceWithEarlierRoundIsNotMonotone, ReusedFacesTouchNoChangedEdge, IncrementalCoversEveryFace,
SameModelHasNoDifference. Laws over sums and arrays take Integer selectors (`CatalogVerdictAt`,
`CatalogTraceAt`) or Numbers and build the value inside; the incremental and diff laws run on
`Witness_UnitBox` (and `Witness_UnitBoxMillimetres`).

## Merge instructions
- Section 10 files to `07-validation` (claims, witnesses, budgets) and `00-foundation` for
  `TimeBudget`, `Elapsed`, `WorkBudget` if other layers need them below 7; section 11 to
  `08-pipeline`; section 16 and the concepts to `09-tooling`.
- `BrepModel implements ICheckable, IDiffable, IWitnessed` (the functions exist in
  `catalog-validation-pipeline.library.plato` and `catalog-validation-claims.library.plato`).
- Delete `catalog-borrowed.types.plato` once the section 7 and 13 tracks' declarations land; check
  that their `Defect` case payload types match (the borrowed one guesses `Distance: ModelLength`,
  `Deviation: Measure`, `Tolerance: LengthTolerance`).
- Rename `Law_Catalog_*` to the layer's law prefix.

## Contract requests
- `LawId`: the catalog marks it **exists** in `09-tooling/tooling-law-runner.types.plato`; it does
  not (`LawRun.Law` is a `String`). Declared here as `LawId { Name: String }`, built by
  `LawIdOf(LawRun)` and `LawIdOf(Check)`. Request: make `LawRun.Law` and `Check.Law` a `LawId` (or
  `LawName`), and give the runner a table of law ids so a name not in it cannot be built.
- `Perturbation` (layer 9) to become the sum the catalog gives; declared beside it as
  `PerturbationKind`. Rename at merge.
- `LawVerdict` (layer 9) to carry payloads; declared beside it as `LawVerdictDetail`. Its cases
  differ from `LawVerdict`'s (`FailedAsExpected`, `HeldUnexpectedly` are expectation outcomes,
  which `Expectation.IsMet` now computes).
- `Check` to become `CheckRecord { Claim; Evidence; Holds }` (with `ToCheckRecord` the bridge);
  foundation's request for `Measure` in `Worst`/`Bound` is the first step.
- `RunStage` versus the catalog's `Stage`: `RunStage` names where the law runner looked
  (`ModelStage`, `MeshedStage`, `MeshStage`, `SelectorStage`), not pipeline stages. `StageOutcome`
  uses `RunStage` for now; request a separate `Stage = Parsing | Decoding | Preparing |
  Discretizing | FaceMeshing | Assembling | Validating` in layer 8, since the two mean different
  things.
- `LawRun` to add `Elapsed: Elapsed` (catalog section 10).
- `PipelineState` to add `Trace: Trace` and `Work: WorkBudget`; then it implements `ITraced`.

## Requests to other tracks
- Section 7 (discretization) track: `CriterionName`, `RequestSet` borrowed. Not blocking.
- Section 13 (repair) track: `Defect`, `DefectReport` borrowed, for `CorpusRow.Defects`. Not blocking.
- Other tracks: borrow `TimeBudget`, `Elapsed`, `WorkBudget` from
  `catalog-validation-budgets.types.plato` (commit 94893ee8).

## Findings
- The warm server silently compiles nothing when a law calls a function on a qualified
  payload-free case, `Expectation.ShouldPass.IsMet(v)`: it reported "0 laws, 0 type errors" (the
  library's known CHK201 also vanished), while the pinned CLI lint parsed and resolved the same
  files clean. `IsMet(Expectation.ShouldPass, v)` compiles. A run whose error count drops below the
  library's known one means the compile was skipped.
- LINT010 (info) remains for `StageOutcome`, `RowDump`, `CorpusRow`: plain records no function
  takes yet. LINT003 (info) lists fields read only by laws.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, README, primer A/D/F, spec DSL, catalog sections, library types) | 20 min | |
| Writing types, concepts, libraries | 25 min | |
| Writing laws and spec | 20 min | |
| Type-check runs | 3 min | 10 server runs, 2 CLI lints |
| Law runs | 1 min | 3 runs (27, 30 laws, 3 under gpu32) |
| Waiting on the server | 0 min | never busy |
| Diagnosing the silent compile failure | 4 min | 3 runs |
| Committing | 3 min | 3 commits |

## Lessons
- Check that a name the catalog marks **exists** really does (`LawId`) before planning around it.
- When the server's error count drops below the library's known one, the compile did not happen;
  bisect the latest edit.
