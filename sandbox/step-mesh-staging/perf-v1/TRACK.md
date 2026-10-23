# perf-v1: identical-output speedups of 2026-10-22, moved out of the library

Ticket: TKT-496, TKT-501, TKT-503
Status: blocked: all three, unverified (the builders stopped at the Fable usage limit mid-chunk)

These edits were made directly in `sandbox/step-brep-mesh` by three builders of the 2026-10-22 performance session,
which broke staging rule 1. They were moved here on 2026-10-23 at the v1 supervisor's request, as one patch per
ticket against the library at `5817a9fc` plus the new files, and the library files were restored. Each patch was
checked with `git apply --check` against the restored library. Nothing here has had a law run to a verdict: each
builder stopped before its laws ran.

The changes come from `docs/plans/step-mesher-algorithmic-performance-2026-10-22.md`. Each is meant to leave every
output bit unchanged, which the agreement laws in the new files state.

## Done

- None verified.

## Merge instructions

Per ticket, in any order (the patches touch disjoint files):

- TKT-501 (finding 2, curve and pcurve inverse-search memo): `git apply sandbox/step-mesh-staging/perf-v1/tkt-501-inverse-memo.patch`
  (`01-geometry/bspline-inverse.laws.plato`, `bspline-inverse.library.plato`); copy `new/bspline-inverse-memo.types.plato`
  to `01-geometry/`. Ran: nothing. Next: the agreement laws in the patched `bspline-inverse.laws.plato`, then
  `BsplineInverseLaws`, `ProjectAlongLaws` and `BisectionCachedLaws`.
- TKT-496 (finding 5, `ImageInFace` with the face's seam set given): `git apply sandbox/step-mesh-staging/perf-v1/tkt-496-seams-given.patch`
  (`05-face-meshing/uv-regions.library.plato`, `face-meshing-domain-once.library.plato`); copy `new/uv-regions-given.laws.plato`
  to `05-face-meshing/`. Ran: nothing. Next: its laws, then `Law_PcurveAgreesWithProjection`, `Law_UnwrapKeepsSources` and
  `Law_LoopToUvCountMatchesDiscretization`.
- TKT-503 (prepare: once-cited edges of every shell in one pass): `git apply sandbox/step-mesh-staging/perf-v1/tkt-503-prepare-once.patch`
  (`03-step/step-shell-sewing.library.plato`); copy `new/pipeline-prepare-speed.laws.plato` to `08-pipeline/`. The
  patch adds the `...Of` and `...Given` forms beside the reference functions; whether `Sewn` was already pointed at
  `SewnVertexRootsGiven` is not established, so check the patch before merging. Ran: nothing. Next: the agreement laws
  in the new file, then `Law_PrepareIsIdempotent` and the `StepReadingLaws` reduction laws.

## Contract requests

- None.

## Requests to other tracks

- None.
