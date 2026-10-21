# perf-constants: RoundingUnit and SmallestNormal as closed forms

Ticket: TKT-378
Status: merged: I1 (2026-10-21, finished by the supervisor from the builder's two staged files after the builder stalled; into 00-foundation/foundation-constants.{library,laws}.plato; RoundingUnit and SmallestNormal wired to the constants, the halving loops kept as RoundingUnitByHalving and SmallestNormalByHalving, Law_ByHalvingIsTheLibraryLoop dropped as the track's own comment asked)

## Done
- Closed forms `RoundingUnitConstant` (2^-53 cpu64, 2^-24 gpu32) and `SmallestNormalConstant` from `Number.MaxValue` and `Number.Epsilon` in five operations; `ResolutionAtConstant`; the halving loops in counted form; `Witness_ResolutionAtWork` (slope Flips(1), sizes 8 and 64).
- Compiled cpu64, budget 2, staged: 188 laws over `BrepFoundationConstantsLaws`, `BrepFoundationLaws`, `BrepFoundationWorkLaws`, `BrepFoundationCoincidenceCellsLaws`, `BrepGeometryLaws`, `BrepTopologyLaws`: 156 pass, 24 baseline fails, 8 baseline skips, 0 regressed, laws 1.5 s summed.
- Compiled gpu32, budget 2: the two equality laws and the agreement laws pass (the constants equal the loops bit for bit under both profiles). `Law_ConstantsMeetTheSpec` fails under gpu32: the spec's comparisons (`foundation.spec.plato` 101-113) do not hold for the loop's own value under gpu32 either, since the constant equals it; a finding about the spec under gpu32, not about the constants.
