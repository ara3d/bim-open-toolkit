# v1-generators: law-runner generators so model-validity laws see only values the library can make

Ticket: TKT-446 (Plato runner rule), for TKT-423 (the 23 model-validity laws)
Status: ready: G1, G2

Plato 7859fdce (TKT-446) added the rule: a bodied `Generate_X(seed: Integer): T`, or
`Generate_X(_: T, seed: Integer): T`, makes the law runner draw every `T` from its generators and
witnesses only, with a seed from 0 to 15, as a law argument and as a field of another value; `T`
is never built field by field (Plato `docs/interpreter.md`, "The law runner"). The rule needs that
Plato commit or later; the toolkit's Plato pin was not moved.

## Done
- G1 (TKT-446), about 0.5 h. `tolerance-generators.library.plato`, library
  `V1GeneratorsTolerances`: `Generate_LengthTolerance`, `Generate_AngleTolerance`,
  `Generate_ParameterTolerance` (sixteen positive magnitudes, 1e-8 to 0.25; angles 1e-10 to
  2.5e-3 rad), and `Generate_Tolerances` (the parameter floors derived from the length, as the
  decoder builds them). No types added.
  TKT-423's 23 laws, `plato run --laws --profile=cpu64 --budget=60 --recursive` over the stdlib
  tiers and the library with `--exclude=brep.types.plato --exclude=brep.library.plato
  --exclude=brep.concepts.plato` (the warm server's excludes), Plato 7859fdce:
  - without this folder: 0 pass, 23 fail;
  - with it: 6 pass (`Law_LengthTolerancePositive`, `Law_AngleTolerancePositive`,
    `Law_ParameterTolerancePositive`, `Law_LengthToleranceResolvable`,
    `Law_CurvePlacementOrthonormal`, `Law_SurfacePlacementOrthonormal`), 17 fail. The 17 are over
    types with no generator: `CurveDomain` (2), `Check` (2), `Report` (1), `BSplineCurveData` (6),
    `BSplineCurve2DData` (6). Each needs a generator of the same kind or a restated law (TKT-423).
- G2 (TKT-423), about 1.5 h against 2 h. Generators for the five remaining types, each building
  only through the library's own functions, varied over seeds 0 to 15:
  - `check-report-generators.library.plato`, library `V1GeneratorsChecks`: `Generate_Check`
    (CheckExact, CheckWithin with worsts 0 to 0.75 and Number.Unmeasured against bounds 0 to 0.5,
    WorseOf of two samples of one law) and `Generate_Report` (Empty, ReportOf of a check,
    Merge, ReportOf of a decoder diagnostic made by `Diagnose`, Located).
  - `domain-generators.library.plato`, library `V1GeneratorsDomains`: `Generate_CurveDomain`
    (FullTurnDomain, UnboundedDomain, BoundedDomain, WithClosure, TorusVDomain Apple and Lemon,
    and layer 2's TraversalDomain for an arc and a closed edge on a full turn and on a Closed
    domain).
  - `spline-generators.library.plato`, library `V1GeneratorsSplines`:
    `Generate_BSplineCurveData`, `Generate_BSplineCurve2DData` (a STEP knot spec that passes
    `ConstraintsParamBSpline`, degree 1 to 5, clamped or unclamped uniform, expanded by
    multiplicity; polynomial or rational positive weights), and
    `Law_V1Generators_KnotSpecsDecodable` (every seed's spec passes the seven conditions).
  - `generator-seeds.laws.plato`, library `V1GeneratorsSeedLaws`: five laws that run the 17 laws
    over every seed, since the runner samples only 25 cases.
  No types added.
  Results, the same command as G1 with `--budget=30`, filter on the layer 0 and 1 law classes
  (`BrepFoundation,BrepGeometry,Bspline,GeometryLawsOnce,PolishCached,ProjectAlong`), Plato
  78a7776d built from HEAD (with other sessions' uncommitted edits to `Elaborator.cs` and
  `stdlib/foundation/primitives.library.plato` in that checkout):
  - before G2 (G1 only): 393 laws, 366 pass, 18 fail (the 17, and `Law_SagittaIsAttained`, TKT-425),
    1 obligation, 8 skipped; 110 s.
  - after G2: 399 laws, 387 pass, 3 fail, 1 obligation, 8 skipped; 62 s. 16 of the 17 pass. `Law_ClosedPeriodIsRangeLength` fails on a domain the library
    makes, a real defect (below). No other law's verdict changed; the six `V1Generators` laws pass
    except `Law_V1Generators_DomainLawsOnEverySeed`, which fails on the same case.
  - Defect found: layer 2's `TraversalDomain` (`02-topology/topology.library.plato:585`) gives a
    closed edge on a Closed curve domain `CurveDomain([first, first + period], Closed(period))`,
    and `(first + period) - first` is not `period` in floating point. Seed 7: the curve domain
    [0.125, 0.225] made Closed, a closed edge from 0.2, gives
    `CurveDomain(NumberInterval(0.2, 0.30000000000000004), Periodicity.Closed(0.1))`. The law is
    `CurveDomain`'s declared invariant (`foundation.spec.plato:61`), so the law stands and
    `TraversalDomain` is at fault (TKT-423). `Law_WrapOnClosedDomainStaysInRange` holds on the
    same domain, within its slack.

## Merge instructions
- Move `tolerance-generators.library.plato` and `check-report-generators.library.plato` into
  `sandbox/step-brep-mesh/00-foundation/`, `spline-generators.library.plato` into
  `01-geometry/`, and `domain-generators.library.plato` and `generator-seeds.laws.plato` into
  `02-topology/` (the domain generator calls layer 2's `TraversalDomain`; the seed laws call it),
  unchanged, after the toolkit's Plato pin is at 7859fdce or later. Before that pin the
  `Generate_` functions are ordinary unused functions: harmless, but the laws still fail.
- Rename the `Law_V1Generators_*` laws at merge as the staging rules say.
- `Law_ClosedPeriodIsRangeLength` stays failing until `TraversalDomain` keeps the invariant
  (TKT-423); do not drop seed 7's case to make it pass.
- TKT-423's second box (verdicts-cpu64.tsv records the 23 as pass) waits for this merge and the
  pin move, and for the `TraversalDomain` fix.

## Contract requests
- none

## Requests to other tracks
- supervisor, or the track that owns `02-topology`: make `TraversalDomain`'s closed-edge case on a
  Closed domain keep `Law_ClosedPeriodIsRangeLength`, for example by building the period as
  `(first + period) - first`, or decide that edge domains are outside the invariant and restate
  it. Blocks TKT-423's last law, not this folder's merge.
