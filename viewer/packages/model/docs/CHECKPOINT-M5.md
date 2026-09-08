# Track M5 checkpoint — the bounds fact landed, and a configurable selection

State: verified. Contract revision **M1.4**, signed in [CONTRACTS-M1.md](CONTRACTS-M1.md) "M1.4
additions". The `facts` change is the first non-additive one in this contract; the `style` change is
additive. Fence: `viewer/packages/model/**` less config, plus `workflows/src/observation.ts` and
`synthetic/src/schedule.ts` and their tests. 269 model tests, up from 260; no escape hatches.

## Chunks and commits

| # | Concern | Files | Commit |
|---|---|---|---|
| 1 | Bounds `FactValue` across three packages | `model/src/facts.ts`, `workflows/src/observation.ts`, `synthetic/src/schedule.ts`, three tests, CONTRACTS | `4aea304` |
| 2 | Configurable selection marking | `model/src/style.ts`, `test/style.test.ts`, CONTRACTS | `f027fa6` |
| 3 | This file | `docs/CHECKPOINT-M5.md` | this commit |

## What landed

- `FactValue` gains `{kind: 'bounds', bounds: Bounds}`, with `bounds`, `knownBounds` and one line in
  `sameFactValue` through `sameBounds`. `reconcile`, `mergeObservations`, `observedValues`,
  `coverageOf`, `reportedUnits` and `sumQuantities` needed nothing, as M4 predicted.
- `styleComposition` takes an optional sixth `selectionChange` defaulting to
  `defaultSelectionChange`; `withSelectionChange` restyles a composition a host did not build. It
  stays a change, so selection still cannot show what was hidden, filtered or deleted — pinned.

## For the supervisor: consumers that can now drop their workaround

- **`synthetic/src/clearances.ts`** (its own header comment, lines 9-13): six `f64` columns that
  read NaN plus four state columns. It can carry `known(bounds(box))` and `missing(reason)` instead.
- **`workflows/src/07-access-coordination.ts`** (lines 46-50): its own `Box`/`BoxObservation` types
  and `boxSchema`, and a disputed box stored as *text* it refuses to parse. `conflicting([bounds(a),
  bounds(b)])` now says that in the model's own vocabulary, and `knownBounds` reads it back.
- Neither was edited; both are outside this fence.

## Findings

- M4's measurement was exact: the two named files were the only breakages in the eleven packages
  that typecheck, no more and no fewer. Predicting a non-additive change's blast radius by running
  the downstream typechecks worked.
- A third reader existed and did not break: `demos`'s `describeValue` names its kinds and answers
  for the rest, so it compiled untouched. `demos`'s `factText` would have broken; that peer session
  had already fixed it by the time I typechecked. Naming the kinds is the pattern that survives.
- A row cell is one scalar, so both downstream readers render a box as `"0 0 0 to 1 2 3"`. That is a
  reader's rendering, not a wire format: `observationJson` round-trips a box back as text, which is
  honest but lossy. A workflow that needs the numbers should hold the `Observation`, not the JSON.

## Tooling

| Check | Runs | Wall time | Defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` (in-fence) | 8 | 7 s model and synthetic, 14 s workflows | 0 | none | neutral again: it cannot see the change that matters, which is downstream |
| downstream `tsc` (7 packages) | 4 | 6 to 20 s each | 0, and that is the result: it proved the blast radius was exactly two | none this time; render was not the outlier it was for M4 | essential, and the only check of additivity there is |
| `eslint` | 3 | 6 s | 1: a lost space, `fact =(subject` | fast and quiet under this load, unlike M4's 95 s | earned its place this time |
| `vitest` | 9 | 1.2 to 1.9 s | 1: an object key is `\|`-separated, not `/` | one failure was Track W2's in-flight rename, not mine — cost a minute to attribute | the gate that earned its place |
