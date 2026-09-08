# Track S2 checkpoint — the remaining synthetic generators

Wave 1 of the visualization V2 plan. Opus track lead. Fence:
`viewer/packages/synthetic/**` except `package.json`, `tsconfig.json`,
`tsconfig.build.json` and `vitest.config.ts`, which the supervisor owns.

Contract revision: **M1** at commit `641624b`
(`viewer/packages/model/docs/CONTRACTS-M1.md`). Nothing in `model` was edited.

## State

working — chunk 1 landed.

## Chunk commits

| Chunk | Commit | Checks |
|---|---|---|
| Shared draw cursor, array helpers, calendar arithmetic | `7ce5ce5` | tsc clean, eslint clean, 87 tests pass |

## Delivered so far

- `src/cursor.ts` — the draw cursor `building.ts` and `stress.ts` each had a
  private copy of, now shared. Output of both generators is unchanged.
- `src/arrays.ts` — `elementAt`, and `joinIds`/`splitIds` for a list-valued
  field inside one string column of a `Table`.
- `src/dates.ts` — `YYYY-MM-DD` text and integer day numbers by Howard
  Hinnant's civil algorithms. No `Date`, so no clock and no time zone enters
  a function that must be a pure function of its seed.

## Remaining work

The ten generators, `src/fixtures.ts`, the JSON snapshots and the README.

## Blockers

None.
