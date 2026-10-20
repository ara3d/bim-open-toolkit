# catalog-decided: TYPE-CATALOG.md section 5 (decided results and reasons, no sentinels) in Plato

Ticket: TKT-323
Status: ready: catalog-decided

## Done
- catalog-decided, see `git log -- sandbox/step-mesh-staging/catalog-decided`, about 0.8 h against 2
  expected: 27 `Law_Catalog_` laws, all pass under cpu64 (2026-10-20); zero type errors in this folder.

Types added (27), plus 2 borrowed:
- Values (13): `UndecidedReason`, `DecidedNumber`, `DecidedAngle`, `DecidedLength`, `DecidedParameter`,
  `DecidedSign`, `DecidedUv`, `DecidedPoint`, `DecidedDirection`, `DecidedFaceIndex`, `DecidedEdgeIndex`,
  `DecidedRange`, `DecidedRound`.
- Geometry (4): `SurfaceNormal`, `Projection`, `ClosestParameterResult`, `ClosureDecision`.
- Refinement (7): `KeepReason`, `SplitDecision`, `InsertionRejection`, `InsertionAttempt`, `FlipRejection`,
  `FlipAttempt`, `TerminationCertificate`.
- Outcomes (3): `FaceMeshResult`, `MeshResult`, `DecodeResult` (the sum forms of the extend entries).
- Borrowed (2, `catalog-borrowed.types.plato`): `CheckedMesh { Mesh: ModelMesh }`, `WorkBudget`.

Concepts added: none (section 5 lists none; `IBudgeted` is section 15's).

Functions (`CatalogDecidedValues`, `CatalogDecidedResults`): `IsDecided` and `ValueOr(fallback)` per
`Decided*`, and for `SurfaceNormal` and `ClosureDecision`; `CaseNumber` per multi-case sum;
`IsOnSurface`, `IsFound`, `ClosesCurve`, `IsSplit`, `IsInserted`, `IsFlipped`, `IsBlocked`,
`IsSucceeded`; `WorkTotal`, `CertifyRound`, `IsTerminal`; conversions `ToFaceMeshResult`,
`ToMeshResult`, `ToDecodeResult`.

Choices where the catalog sketches:
- **Every `Decided*` has value case `Decided(Value: T)`**, not the catalog's `Number(Value: Number)`
  named after the payload. A case `Point(Value: ModelPoint)` joined `ModelPoint`'s field accessor
  `Point` and made the foundation's `p.Point` CHK203 ambiguous; one name for every sum also makes
  callers uniform.
- Payloads: `DecidedParameter` holds a `CurveParameter`, `DecidedRange` a `ParameterRange`,
  `DecidedAngle` the stdlib `Angle`, `DecidedLength` a `ModelLength`, `DecidedPoint` a `ModelPoint`.
- `InsertionRejection.TooCloseTo(Point, Distance: Measure)`: UV distances have no length type, so the
  distance is a `Measure` of kind `ParameterKind`.
- `WorkTotal` reads a negative count as zero; `CertifyRound(before, after)` is the one constructor of a
  `TerminationCertificate`; `IsTerminal` is "not decreased, or no work left".
- `MeshResult.Succeeded.Rounds` is a `Count`.
- `DecodeResult` from `DecodedModel`: `Decoded` when the model has a face; with none, `Unreadable` when a
  diagnostic is an error, else `NoShape(NotApplicable("no shape representation"))`.
- `MeshOutcome` to `MeshResult`: `Ok` gives `Succeeded` (the clean report is the validation verdict, so the
  conversion builds the `CheckedMesh`), anything else `Failed(Report)`. `Incomplete` is unreachable from the
  record (no pending requests); the loop must build it.

Laws (27, all pass, cpu64):
- Values (13): UndecidedReasonRoundTrips and one `Decided<T>RoundTrips` per `Decided*` (IsDecided holds
  exactly for the Decided case; ValueOr returns the stored value or the fallback; exact `==` because the
  value is stored, not computed).
- Results (14): SurfaceNormalRoundTrips, ProjectionRoundTrips, ClosestParameterResultRoundTrips,
  ClosureDecisionRoundTrips, KeepReasonRoundTrips, SplitDecisionRoundTrips, InsertionRejectionRoundTrips,
  InsertionAttemptRoundTrips, FlipRejectionRoundTrips, FlipAttemptRoundTrips,
  WorkStrictlyDecreasesOrTerminal, FaceMeshOutcomeBlockedMapsToBlocked (blocking request to Blocked,
  advisory or none to Meshed), MeshOutcomeCleanMapsToSucceeded (196 cases, over the two tetrahedron
  witnesses), DecodedModelMapsByFacesAndErrors (unit cube, faceless clean, faceless with an error).

## Merge instructions
- `UndecidedReason`, `Decided*`, `KeepReason`, `TerminationCertificate` and the values library into
  `00-foundation`; `SurfaceNormal`, `Projection`, `ClosestParameterResult`, `ClosureDecision` into
  `01-geometry`; `SplitDecision` into `04-discretization`; insertion and flip types into `05-face-meshing`;
  `FaceMeshResult` into `05-face-meshing`, `MeshResult` into `08-pipeline`, `DecodeResult` into `03-step`,
  each with its conversion. Delete `catalog-borrowed.types.plato` once sections 4 and 10 land.
- No library function is rewired.

## Contract requests
- `FaceMeshOutcome` (**extend**): replace with `FaceMeshResult`. The catalog's `Meshed(Mesh, Advisory)` has no
  `Diagnostics`, so the warnings that come with advisory requests are dropped by `ToFaceMeshResult`; add
  `Diagnostics: Array<Diagnostic>` to `Meshed` before the switch.
- `MeshOutcome` (**extend**): replace with `MeshResult`; the refinement loop must return `Incomplete` with
  its pending requests when it stops at the round limit (today that state is a non-Ok record).
- `DecodedModel`/`DecodeBrep`: return `DecodeResult`, so a faceless decode is not passed on as a shape.
- `NormalOr(fallback)` and `LimitNormal`: return `SurfaceNormal` (F-57 item 2).

## Requests to other tracks
- Section 4's owner: `CheckedMesh`, borrowed as `{ Mesh: ModelMesh }`; replace with yours, keeping a
  constructor `ToMeshResult` can call on a clean outcome (or give one).
- Section 10's owner: `WorkBudget { Evaluations; Insertions; Flips; Projections: Integer }`, borrowed with
  the catalog's shape. Not blocking.

## Findings
- A sum case named after a type with a field of that name (`Point(Value: ModelPoint)`) collides with the
  field accessor: CHK203 in another track's file. The primer's "case may share its name with a stdlib type"
  (probe L08) does not cover field accessors.
- The server kept the removed case alive at the staging path (the foundation track's stale-path defect);
  every check here ran on a fresh copy under the scratchpad.
- The runner builds plain sums (`Sign` as a law parameter ran 126 cases, exhaustive), contrary to
  PLATO-PRIMER.md B.2, at least for payload-free sums.
- CLI lint: one LINT003 info, `CheckedMesh.Mesh` never read (borrowed minimal shape); no LINT001.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, primer A/D/F, catalog section 5, foundation and indices files, outcome records) | 15 min | |
| Writing types and libraries | 15 min | |
| Writing laws and spec | 15 min | |
| Type-check runs | 1 min | 6 server runs |
| Law runs | 10 s | 1 run (27 laws) |
| CLI lint | 1 min | 1 |
| Waiting on the server | 0 min | never busy |
| Committing | 2 min | 1 |

## Lessons
- Grep field names as well as function names before naming a sum case.
