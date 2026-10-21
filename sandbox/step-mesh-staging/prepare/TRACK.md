# prepare: closure decided without evaluating a B-spline

Ticket: TKT-348
Status: merged 8984df4b (D1, 2026-10-21; the .plato files are deleted, the library holds them)

## Done

- D1, this commit, about 1 h against 1.5 h expected. Files, all new, in this folder:
  - `prepare-closure.types.plato`: `DecidedClosure` (Decided(Boolean) | Undecided(UndecidedReason)), after the foundation's Decided* sums.
  - `prepare-closure.library.plato` (library `PrepareClosure`): `ReachesSpline` (curve, pcurve, 2D curve, surface: true when evaluation would reach a B-spline), `EndsClosure(BSplineCurveData, tol)` (clamped knots: first and last control points coincide; else Undecided), `TrimmedEndsClosure` (a trim of a clamped spline over exactly its whole domain uses the spline's ends), `DecidesClosedByEnds` (the decision per kind; evaluated ends only for kinds that reach no spline), `DecidesClosedWithoutEvaluation` (its Boolean, for the closure marks), `RunsBackToStartDecided`, `UndecidedClosureDiagnostic`, `ReducedDecided` (Reduced's body with the decision: an undecided edge is never dropped and gets one diagnostic at its instance with the curve's instance id as Measure), `ClosureMarksDecided`, `PrepareModelDecided` (PrepareModelWith through the two).
  - `prepare-witnesses.library.plato` (library `PrepareWitnesses`): five spline fixtures (clamped open, clamped closed, unclamped, and two with no weights so `BSplinePoint` cannot evaluate them), `Witness_RawCubeWithClampedSplineEdge` and `Witness_RawCubeWithUnclampedSplineEdge` (the raw unit cube with curve #33 of edge #53 replaced), and `PrepareClosureArena`, 21 curves of every `BrepCurve` kind including the unevaluable splines, a plain fixture rather than a witness so layer 1's evaluating laws never reach it.
  - `prepare.laws.plato` (library `PrepareLaws`): 10 laws `Law_Prepare_*`, all pass under cpu64 (verdicts below). No type added beyond `DecidedClosure`.
- Verdicts, `plato_laws.py "Law_Prepare_" --staging sandbox/step-mesh-staging/prepare`, cpu64, 2026-10-21: 10 pass, 0 fail. `Law_Prepare_ClosureDecisionReturnsForEveryKind`, `Law_Prepare_ClosureDecisionIsTheEnds`, `Law_Prepare_DecisionAgreesWithEvaluation`, `Law_Prepare_UndecidedOnlyWhenReachingSpline` (each one exhaustive case over the 21 arena curves), `Law_Prepare_ClampedSplineClosureIsItsEndControlPoints` and `Law_Prepare_ClampedSplineEndsAreTheEvaluatedEnds` (25 cases over layer 8's fixtures plus this folder's), `Law_Prepare_PreparationReturns` (4 raw witnesses), `Law_Prepare_UndecidedEdgesAreKeptAndDiagnosed` (56 cases), `Law_Prepare_PreparationAgreesWhereDecided` (4), `Law_Prepare_CubeWitnessesPrepareAsStated` (1: the unclamped cube's one diagnostic sits at #53 measuring #33, both cubes keep 12 edges).
- Layer 03 with the folder staged (the eight law libraries of `03-step`, 202 laws): 125 pass, 77 obligation (the `Part21File` forms, as before), 0 fail, 0 error; verdict for verdict the same as `reviews/verdicts-cpu64.tsv`. `Law_CurveClosureDecidedByEnds(RawDecodedModel, Integer)` passes on 56 cases (28 before: the two new raw witnesses doubled them), `Law_ClosureMarksAreTheDecisions` and `Law_PrepareIsIdempotent` on 4. Two `(RawDecodedModel, Integer)` rows, `Law_LeftHandedSurfacesAreFolded` and `Law_MirrorFoldRecordedOnce`, are missing from the class run's listing (Findings, 3) and pass on 56 cases when run by name.

## Merge instructions

- `03-step/step.library.plato` `DecidesClosed(g: GeometrySet, c: CurveIndex, tol: LengthTolerance)` => `g.DecidesClosedByEnds(c, tol).IsClosed` (that is `DecidesClosedWithoutEvaluation`); `ClosureMarks` then decides curves without evaluation and `ClosureMarksDecided` is deleted.
- `Reduced(raw)`: body replaced by `ReducedDecided`'s (the change is the `decisions`, `closes`, `undecided`, `dropped`, `unsettled` and `unsettledFindings` lines; everything else is a copy). `RunsBackToStart` keeps its Boolean form for other callers, or becomes `RunsBackToStartDecided(...).IsClosed`. `PrepareModelDecided` is then `PrepareModelWith` and is deleted.
- Move `prepare-closure.types.plato` into `00-foundation/foundation-decided.types.plato` (section "Scalars and quantities", beside `DecidedSign`) and `prepare-closure.library.plato` into `03-step/step.library.plato` (after "Closure"), with `IsClosed`/`IsDecided` into `foundation-decided.library.plato`.
- `prepare-witnesses.library.plato` into `03-step/step-raw-witnesses.library.plato`; `prepare.laws.plato` into `03-step/step.laws.plato` ("Closure" section) with `Law_Prepare_*` renamed `Law_*`.
- Document in `03-step/README.md`: Reduced never evaluates a B-spline; an undecided closure is a kept edge plus a `STEP-EDGE-CLOSURE-UNDECIDED` diagnostic.

## Contract requests

- `StepDiagnosticCode`: a case `EdgeClosureUndecided`, subject `AboutInstance`, with `UndecidedClosureDiagnostic`'s text, so `Diagnose` and `Law_DecodeFindingsPointAtTheirSubject` cover it. Until then the diagnostic is built directly with code `STEP-EDGE-CLOSURE-UNDECIDED`.

## Requests to other tracks

- E (C# regeneration, chunk E1), then D2 (the corpus rerun): both blocked on this merge, not on anything further here.

## Findings

1. Since the bspline track merged (2026-10-19) the library's `BSplinePoint` has a body, so in the interpreter `DecidesClosed` no longer throws; the defect is in the C# library generated before that merge, and `ReducedDecided` is still the right fix, since the decoder must not depend on evaluation to prepare a model (the arena's unevaluable splines show it: `Law_Prepare_ClosureDecisionReturnsForEveryKind`).
2. The library does not type-check at this commit: `05-face-meshing/triangulation-fast.laws.plato:21` CHK201 `==` on two `Array<Integer>` (`UpdatedTableIsTable`, from the catalog merge 00ecee6e). The law server still runs laws; a `plato_laws.py` run therefore always exits 1 until it is fixed. Not this track's fence.
3. The law server's listing of a whole-class run drops a row now and then: a run of the eight layer 03 libraries listed 200 rows for 202 laws, the two `(RawDecodedModel, Integer)` overloads named above missing; run by name they pass. A verdict comparison should run missing names alone before calling them regressions.
4. A trimmed B-spline is decided from the spline's control points only when the trim's range equals the spline's domain exactly; any other trim, a composite, an offset, or a surface curve over a spline stays Undecided. The corpus census (ticket) shows B_SPLINE_CURVE_WITH_KNOTS edges directly on their splines, so this covers 40,378 of the 40,399 throwing edges; the 21 SURFACE_CURVE edges of SHO/NINA-B222-W1x2 become kept edges with a diagnostic.
5. The interpreter cannot `match` on a local `var` (error "match subject is not a sum type"); match on a parameter or a call instead (`ClosableEndsClosure`).

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading the ticket, the staging rules, Reduced, DecidesClosed, the Decided types and witnesses | 25 min | 0 |
| Writing the types, library, witnesses and laws | 20 min | 1 type check (33 s cold compile) |
| Law runs and fixes (local match, the trim's full turn, the composite's closure) | 10 min | 5 runs of 4 to 10 s |
| Layer 03 comparison and TRACK.md | 10 min | 3 runs |

## Lessons

- The runner's Integer range reaches at most 17 fixture indices; a law over a larger arena should check all of it in one case (`ArenaCurves.All`) rather than select by `k`.
