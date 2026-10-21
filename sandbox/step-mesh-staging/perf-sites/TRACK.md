# perf-sites: the finding sites of pcurves and 2D curves as tables built once per check

Ticket: TKT-371
Status: ready: V3

## Files

- `sites.library.plato` (library `BrepCheckingSites`, layer 07): `PcurveSiteTableCounted(m): Counted<Array<Provenance>>`,
  `PcurveSiteTable(m)`, `Curve2DSiteTableGiven(m, pcurveSites)`, `Curve2DSiteTable(m)`;
  `CheckPcurvesIndexed`, `CheckCurves2DIndexed`, `CheckPcurveSamplesIndexed`, `CheckCurve2DSamplesIndexed`
  (same signatures as `CheckPcurves`, `CheckCurves2D`, `CheckPcurveSamplesGiven`, `CheckCurve2DSamplesGiven`).
- `sites.laws.plato` (library `BrepCheckingSitesLaws`, layer 07): `SharedPcurvesArena(g)`, `WithSharedPcurves(m)`,
  a new `ArenaCase` witness `Witness_SharedPcurvesBoxArena`, the count witness `Witness_PcurveSiteTableWork`, nine `Law_Perf_*`.

## Done

- V3, (this commit), about 0.6 h against 1.5 h expected. Types added: none (the tables are
  `Array<Provenance>`, indexed by the arena position the checks already loop over).
  - Warm interpreter: `plato_laws.py` reported "0 laws" for every filter including a single law
    name, while the pinned CLI interpreter (cpu64, budget 20) ran the same files: 12 laws, 12 pass
    (`BrepCheckingSitesLaws` 9, `BrepCheckingSamplersLaws` 2, `Law_WorkIsWithinSlope` 28 cases).
  - Compiled (pinned CLI e37c032f, csharp, cpu64, `--budget=2`, filter
    `BrepCheckingSitesLaws,Law_WorkIsWithinSlope,BrepCheckingSamplersLaws,Law_WitnessIsStructurallyClean,Law_WitnessValidatesClean,Law_BoxWithBottomPcurveValidatesClean,Law_CylinderBandIsStructurallyClean,BrepCheckingProofsLaws,BrepCheckingDefectsLaws,BrepCheckingLaws`):
    75 laws, 66 pass, 6 skipped (the six function-parameter laws of `BrepCheckingLaws`, skipped in
    the verdicts file too), 3 error, each a timeout over the 2 s budget and none in this chunk:
    `Law_ValidatedReportIffClean` 42.9 s, `Law_ValidatedReportRecordsLevel` 28.6 s,
    `Law_ByFaceRowsNameTheirFace` 3.7 s, each over 196 `BrepModel` cases (pass in the verdicts
    file; see Findings). Every `Law_Perf_*` of this chunk is under 0.1 s; `Law_WorkIsWithinSlope`
    1.23 s over 28 cases. The four `BrepWitnessesLaws` the row names pass, as in the verdicts file.
    - `Law_Perf_SiteTablesAgree` (10 ArenaCase cases: V1's nine and this chunk's) and
      `Law_Perf_SiteTablesAgreeOnWitness` (14 cases, `WitnessAt`): every entry of both tables equals
      `PcurveSite` / `Curve2DSite`.
    - `Law_Perf_SharedPcurvesBoxReachesEveryBranch`: on the shared-pcurve box, a pcurve at its first
      edge though a later edge also carries it, a pcurve at its surface, one at surface 99 (outside
      the arena), a 2D curve at its first pcurve's edge, one at `WholeInput`; and each synthetic law
      of the agreement laws fails there, so a failing provenance is compared.
    - `Law_Perf_CheckPcurvesIndexedAgrees`, `Law_Perf_CheckCurves2DIndexedAgrees`: `Identical` to
      the library check on a synthetic law (fails at odd entries) and on
      `Law_PcurveReferencesInRange` / `Law_Curve2DReferencesInRange`, every ArenaCase.
    - `Law_Perf_CheckPcurveSamplesIndexedAgrees`, `Law_Perf_CheckCurve2DSamplesIndexedAgrees`:
      `Identical` to V1's `Check*SamplesGiven` with ok as `IsWellFormed` says and with ok false.
    - `Law_Perf_PcurveSiteTableVisitsEachEdgeOnce`: the work is exactly `Insertions(E + P)`.
    - `Law_Perf_SiteFamilySizes`: the count family's sizes are its members' E + P.
  - Count witness `Witness_PcurveSiteTableWork`: Insertions are edges visited plus entries filled,
    slope `Insertions(1)` (the dispatch said 2; the exact count is E + P, so 1 holds and is the
    tighter claim), sizes E + P = 3 (unit cylinder), 13 (unit box with bottom pcurve), 20
    (shared-pcurve box), 32 (shared-pcurve hollow box); measured 3, 13, 20, 32. `PcurveSite` per
    pcurve made P x E edge visits on the same members: 0, 12, 96, 192.

## Merge instructions

- `CheckPcurves(m, law, holds)` => `m.CheckPcurvesIndexed(law, holds)` (or move the body in)
- `CheckCurves2D(m, law, holds)` => `m.CheckCurves2DIndexed(law, holds)`
- `CheckPcurveSamplesGiven(m, ok, plan, law, holds)` => `m.CheckPcurveSamplesIndexed(ok, plan, law, holds)`
- `CheckCurve2DSamplesGiven(m, ok, plan, law, holds)` => `m.CheckCurve2DSamplesIndexed(ok, plan, law, holds)`
- `Check_PcurveWithinSurfaceDomainHoisted` (validation-checks-geometry-hoisted.library.plato:183):
  add `var sites = m.PcurveSiteTable;` and replace `(p, j) => m.PcurveSite(PcurveIndex(p))` with `(p, j) => sites[p]`
  (the O(P 2p E) case of candidate 15).
- `Check_Curve2DPlacementOrthonormal` (validation-checks-geometry.library.plato:228): bind
  `var sites = m.Curve2DSiteTable;` in a block body and replace `c => m.Curve2DSite(Curve2DIndex(c))` with `c => sites[c]`.
- Move `sites.library.plato` into `07-validation/` (for example as
  `validation-checks-sites.library.plato`) and `sites.laws.plato` beside it, renaming the
  `Law_Perf_*` as the supervisor's convention says. `PcurveSite` and `Curve2DSite` stay: the
  agreement laws read them as the oracle.

## Contract requests

- none

## Findings

- With nothing wired, three library laws the row names time out under `--budget=2` compiled:
  `BrepCheckingProofsLaws.Law_ValidatedReportIffClean` (42.9 s), `Law_ValidatedReportRecordsLevel`
  (28.6 s) and `BrepCheckingDefectsLaws.Law_ByFaceRowsNameTheirFace` (3.7 s), each over 196
  `BrepModel` cases. The verdicts file has them as pass (no budget). This chunk does not change
  them before merge; after merge their `ValidateBrep` runs pay E + P per pcurve check instead of
  P x E, which may not be enough to bring them under 2 s: they need the shared-witness treatment.
- `plato_laws.py --staging sandbox/step-mesh-staging/perf-sites` matched no laws (also with a
  single full law name) while the pinned CLI with the folder as a root ran them all; the warm
  server may not pick up a new staging folder.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan rows, sites, callers, witnesses) | 10 min | |
| Writing library and laws | 10 min | |
| Warm server attempts | 1 min | 2 (no laws matched) |
| Interpreter runs (pinned CLI) | 1 min | 2, all pass |
| Compiled run | 2 min | 1 |
| TRACK, ticket, commit | 6 min | |

## Lessons

- A heredoc holding an apostrophe-heavy Plato file failed in Git Bash; the Write tool avoided it.
- The staged laws' synthetic checks first held everywhere on the sampler side (zeros at ok false);
  a branch law that asserts the synthetic check fails keeps an agreement law from passing vacuously.
