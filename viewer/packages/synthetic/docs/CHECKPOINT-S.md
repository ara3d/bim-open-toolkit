# Checkpoint S: synthetic generators

Track S of visualization V2 wave 0. Fence: `viewer/packages/synthetic/**` except `package.json`,
`tsconfig.json`, `tsconfig.build.json` and `vitest.config.ts`, which are supervisor-owned.

**State:** working (chunk 1 of 5 verified).

**Model revision built against:** none yet. `viewer/packages/model/src/index.ts` is still the wave 0
skeleton (`export {}`) and `viewer/packages/model/docs/CHECKPOINT-M.md` does not exist, so revision
`M1-stub` has not landed. Chunk 1 needs no model types.

## Chunks

| # | Delivers | State | Commit |
|---|---|---|---|
| 1 | Seeded PRNG | verified | pending |
| 2 | Mesh primitives | not started | |
| 3 | Building generator | not started | |
| 4 | Stress generator | not started | |
| 5 | README and public surface review | not started | |

## Files

- `src/prng.ts` — seeded generator.
- `src/index.ts` — public exports, one level.
- `test/prng.test.ts` — pinned sequences and property checks.
- `docs/CHECKPOINT-S.md` — this file.

## Delivered behavior

Chunk 1: xoshiro128** seeded by splitmix32, as pure functions over an immutable `Rng` state value.
Every draw returns `{ rng, value }`; the input state is never modified. `seed`, `next` (unsigned
32-bit), `float` ([0,1) with 24 bits), `range` (real interval), `int` (integer interval), `pick`,
`shuffle` (returns a new array) and `gaussian`.

Determinism decisions:

- All state arithmetic is 32-bit integer only (`Math.imul`, shifts, xor), so sequences are identical
  on every engine and platform.
- `gaussian` is the Irwin-Hall sum of twelve uniforms, not Box-Muller. `Math.log` and `Math.cos` have
  implementation-defined precision in ECMAScript, so Box-Muller would not be bit-identical across
  platforms. The cost is truncation at six standard deviations, which is accurate enough for
  dimensional jitter. Recorded here because it is a deviation from the obvious implementation.
- `int` uses `floor(float * span)`. The bias is below one part in 2^24 for the span sizes used here.
- `pick` and `shuffle` throw for arrays holding `undefined`, because `noUncheckedIndexedAccess` is on
  and the package uses no non-null assertions or casts.

## Commands and actual results

Run from `viewer/`, chunk 1:

- `npx tsc --noEmit -p packages/synthetic/tsconfig.json` — passed, no output.
- `npx eslint packages/synthetic` — passed, no output.
- `npm test -w @bim-open-toolkit/synthetic` — 2 files, 14 tests passed, 929 ms.

The pinned integer sequences in `test/prng.test.ts` were produced by a second, independent
implementation of splitmix32 and xoshiro128** written from the published algorithms in a scratch
file, not copied from the package implementation.

## Remaining work

Chunks 2 to 5: mesh primitives, building generator, stress generator, README.

## Blockers

None. Watching for the `M1-stub` model revision before chunk 2; if it has not landed, chunk 2
defines the smallest local structural types in `src/shapes.ts`, not exported from `src/index.ts`.

## Requests

None yet.

## Findings

None yet.
