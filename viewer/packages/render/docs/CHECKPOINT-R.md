# Track R checkpoint: the render package

State: **working**. Contract revision: M1 at `641624b`.

Kept current as chunks land. The full account is written at the end of the track; this file records
what is true now.

## Landed chunks

| Chunk | Commit | Verification |
|---|---|---|
| Instance table and bulk column updates | `146ce91` | tsc, eslint, 50 tests |
| Performance suite at 10k, 100k and 456,598 rows | `e9e5f9f` | 14 perf tests, 16 s |

## Remaining

Picking, clipping, representations and replacement, overlays, environment, capture, frame timing,
scene binding, `docs/render.md`, `README.md`.

## Findings so far

1. `InstancedGroup.colors` and `.transforms` allocate a new `subarray` view on every access, so a
   per-row loop that reads them allocates once per instance. `InstanceTable` captures both views
   once. Measured: this was the difference between a usable whole-model write and one dominated by
   garbage collection.
2. viewer-core has no way to publish a changed range without also supplying the values. See the
   request below.
3. The group count dominates bulk update cost, and grouping instances by mesh recovers most of what
   the study's "one allocation per attribute" recommendation would buy. Numbers in the final
   checkpoint.

## Requests

- `@ara3d/viewer-core`, `InstancedGroup`: a `markColorsChanged(start, count)` and
  `markTransformsChanged(start, count)` that bump the version counters without taking values.
  Bulk writes go straight into the borrowed buffers, so publishing currently has to hand a group
  back the slice it already holds.
