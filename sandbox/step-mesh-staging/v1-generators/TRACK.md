# v1-generators: law-runner generators so model-validity laws see only values the library can make

Ticket: TKT-446 (Plato runner rule), for TKT-423 (the 23 model-validity laws)
Status: ready: G1

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

## Merge instructions
- Move `tolerance-generators.library.plato` into `sandbox/step-brep-mesh/00-foundation/`
  unchanged, after the toolkit's Plato pin is at 7859fdce or later. Before that pin the
  `Generate_` functions are ordinary unused functions: harmless, but the laws still fail.

## Contract requests
- none

## Requests to other tracks
- none
