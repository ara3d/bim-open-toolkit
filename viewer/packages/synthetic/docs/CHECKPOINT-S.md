# Checkpoint S: synthetic generators

Track S of visualization V2 wave 0. Fence: `viewer/packages/synthetic/**` except `package.json`,
`tsconfig.json`, `tsconfig.build.json` and `vitest.config.ts`, which are supervisor-owned.

**State:** working (chunks 1, 2 and 3a of 6 verified).

**Model revision built against:** `M1-stub` as it stood in the working tree at 2026-09-07 22:10,
uncommitted by Track M (`viewer/packages/model/docs/CHECKPOINT-M.md` still records chunk 1 as
*working*). Chunk 3a adopted it and deleted the private `src/shapes.ts`. Types taken:
`Vec3`, `Bounds`, `Mesh`, `boundsOfPositions`, `triangleCount`, `vertexCount` from
`@bim-open-toolkit/model`. If Track M's committed `M1-stub` differs from what was read, this
package's chunk 3a needs a re-check; the surface it touches is four files.

## Chunks

| # | Delivers | State | Commit |
|---|---|---|---|
| 1 | Seeded PRNG | verified | `7f896b2` |
| 2 | Mesh primitives | verified | `0bb504a` |
| 3a | Adopt the model's types, drop `src/shapes.ts` | verified | pending |
| 3 | Building generator | not started | |
| 4 | Stress generator | not started | |
| 5 | README and public surface review | not started | |

## Files

- `src/prng.ts` — seeded generator.
- `src/mesh-builder.ts` — triangle accumulator over the model's `Mesh`.
- `src/triangulate.ts` — ear clipping for simple polygons in the XZ plane.
- `src/primitives.ts` — box, cylinder, plane, wedge, extrude.
- `src/index.ts` — public exports, one level.
- `test/prng.test.ts` — pinned sequences and property checks.
- `test/primitives.test.ts` — counts, index validity, bounds, winding and volumes.
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

Chunk 2: `box`, `cylinder` (segmented, radial side normals, flat caps), `plane` (a single upward
face, not a solid), `wedge` (right triangular prism) and `extrude` (a simple polygon along Y).
Each returns positions, normals, indices and bounds as typed arrays. Every primitive is centered on
the origin and wound counter-clockwise seen from outside; placement belongs to the instance
transform. Faces do not share vertices, so flat faces stay flat.

`extrude` accepts either winding and normalizes it; a self-intersecting or zero-area outline throws
rather than producing a plausible but wrong mesh. Ear clipping is O(n squared), which is right for
footprints with a handful of corners.

Chunk 3a: the private `src/shapes.ts` is gone. `Vector3` became the model's `Vec3`, `Bounds3` its
`Bounds`, `MeshData` its `Mesh`. Because `Mesh.normals` is optional and every primitive here
produces normals, `src/mesh-builder.ts` exports `ShadedMesh = Mesh & { readonly normals:
Float32Array }`; `build` returns that shape directly, so no cast is needed and callers read
`mesh.normals` without a check. `triangleCount` and `vertexCount` are the model's and are no longer
re-exported. The model has no two-dimensional vector, so `src/triangulate.ts` keeps a local
`Vec2 = readonly [number, number]` for footprint corners; it is exported so `extrude`'s parameter
type is nameable.

## Commands and actual results

Run from `viewer/`.

Chunk 1:

- `npx tsc --noEmit -p packages/synthetic/tsconfig.json` — passed, no output.
- `npx eslint packages/synthetic` — passed, no output.
- `npm test -w @bim-open-toolkit/synthetic` — 2 files, 14 tests passed, 929 ms.

Chunk 2:

- `npx tsc --noEmit -p packages/synthetic/tsconfig.json` — passed, no output.
- `npx eslint packages/synthetic` — passed, no output.
- `npm test -w @bim-open-toolkit/synthetic` — 3 files, 24 tests passed, 1.18 s.

Chunk 3a:

- `npx tsc --noEmit -p packages/synthetic/tsconfig.json` — passed, no output.
- `npx eslint packages/synthetic` — passed, no output.
- `npm test -w @bim-open-toolkit/synthetic` — 3 files, 24 tests passed, 802 ms.

The pinned integer sequences in `test/prng.test.ts` were produced by a second, independent
implementation of splitmix32 and xoshiro128** written from the published algorithms in a scratch
file, not copied from the package implementation.

Primitive tests check the properties rather than the vertex data: every index addresses a vertex,
every normal is unit length, the bounds contain every position, each triangle's normals agree with
the direction its winding faces, and the enclosed volume computed by the divergence theorem matches
the analytic volume. The cylinder is checked against the inscribed-prism volume at 3, 8 and 64
segments and against pi r squared h at 256.

## Remaining work

Chunks 3 to 5: building generator, stress generator, README.

## Blockers

None.

## Requests

To Track M, from chunk 3a:

- A two-dimensional vector (`Vec2 = readonly [number, number]`). Footprints, plan outlines and any
  two-dimensional layout need one; this package defines a local `Vec2` until the model has it.
- Nothing else is missing. `Vec3`, `Bounds`, `Mesh`, `InstanceRecords`, `ObjectRecord`, `ModelData`,
  `Table`, `Column`, `Fact`, `Observation` and `Coverage` all cover what the generators need.

## Findings

None yet.
