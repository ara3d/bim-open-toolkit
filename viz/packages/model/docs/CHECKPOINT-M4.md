# Track M4 checkpoint — model follow-up for Tracks I, T, W, R and S2

State: verified. Contract M1, additive only: nothing renamed, removed or re-signed. Sixteen exports
and one optional `JsonSchema` field in `math`, `schema`, `coordinates` and `view`, signed in
[CONTRACTS-M1.md](CONTRACTS-M1.md) "M1.3 additions", plus `resolveStyles`'s omissions written down.
Fence: `viewer/packages/model/**` less its four config files; 260 tests, up from 244; no hatches.

## Chunks and commits

| # | Concern | Files | Commit |
|---|---|---|---|
| 1 | Space vectors | `src/math.ts`, `test/math.test.ts` | `4334104` |
| 2 | `mapped`, `enumeration`, the frame schema | `src/{schema,coordinates}.ts`, both tests | `d5730c5` |
| 3 | `sameBounds`; the bounds fact measured, not landed | `src/{math,facts}.ts`, `test/math.test.ts` | `1880bf6` |
| 4 | Framing for the viewport | `src/view.ts`, `test/view.test.ts` | `d284ba0` |
| 5 | What `resolveStyles` leaves out | `src/style.ts`, `test/style.test.ts`, `README.md` | `52b3bdf` |
| 6 | CONTRACTS M1.3, this file | `docs/**` | this commit |

## The bounds fact is not landed

Widening `FactValue` is not additive. With the variant in place `model` compiled and two packages
outside this fence did not: `workflows/src/observation.ts:34` (`factScalar` ends its chain of kind
tests with `value.ref`, TS2339) and `synthetic/src/schedule.ts:54` (`formatValue`'s switch then
lacks an ending return, TS2366). The variant, that evidence and the one-line fix each file needs are
in CONTRACTS-M1.md "M1.3 proposed", and `sameBounds` landed: it is one commit across three packages.

## Requests to other tracks

- **interact**: `src/vec.ts` can drop `dot`, `cross`, `perpendicularTo` and `unitSlerp` for the
  model's, keeping `lerpVec3` and `clamp`; its own orthographic fit is `frameBoundsInViewport`.
  **testing**: `src/bench/camera-path.ts` can drop its local `cross`.
- **workflows**: `src/schema-tools.ts` and all of `src/coordinates.ts` are now in model, where
  `enumeration` takes any JSON literal rather than strings only. `mapped` is the converting schema.

## Commands and results

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/model/tsconfig.json` | pass, 6 to 8 s |
| `npx eslint packages/model` | pass, 10 s quiet, 95 s under load |
| `npm test -w @bim-open-toolkit/model` | pass, 20 files, 260 tests, 1.0 to 7.5 s |
| downstream `tsc`: formats, interact, synthetic, workflows, testing, render | pass, 6 to 10 s each, render 59 s |

## Findings

- A closed discriminated union has no additive widening, and neither `tsc` here nor the tests can
  see that: only the downstream typechecks caught it, twice, in code that narrows by elimination.
- `mapped` inside `object()` typechecks and silently does nothing, because `object` returns the
  value it was given — Track W's finding about `object()` from the other side. A test pins it.
- `frameBounds`'s aspect only ever reached the perspective path; the corner test is what shows it.

## Tooling

| Check | Runs | Wall time | Defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` | 7 | 6 to 8 s | 0 | none | neutral: the tests found what it did not |
| `eslint` | 5 | 10 s quiet, 95 s loaded | 0 | slowest gate again, and the only one that varies tenfold with machine load | hindrance at this package size |
| `vitest` | 9 | 1.0 to 7.5 s, 260 tests | 2: `mapped` under `object`, the framing at 0.5 | none | the gate that earned its place |
| downstream `tsc` | 8 | 6 to 10 s, render 59 s | 1, the one that mattered: the union widening | render costs ten times the rest | essential: the only check of additivity there is |
