# Track S3 checkpoint — an opt-in roof and ceilings for the building

State: **verified**. Fence: `viewer/packages/synthetic/**` except `package.json`,
`tsconfig*.json` and `vitest.config.ts`. Nothing outside it was written. No
nested delegates. Contract revision **M1 with M1.1 and M1.2**; nothing in `model`
was edited and nothing needs adding, because `Roof` and `Ceiling` are ordinary
`ObjectRecord` categories, which M1 leaves open.

## Files

Edited: `src/building.ts`, `src/fixtures.ts`, `test/building.test.ts`, `README.md`.
New: `test/snapshots/buildingWithRoof.json`, this file.

## Delivered behaviour

Two optional fields on `BuildingOptions`, both `false` in `defaultBuildingOptions`:
`generateBuilding({ ...defaultBuildingOptions, roof: true, ceilings: true })`.

Optional fields rather than a second `extras` parameter, because the output has
to stay a function of the options record alone. An absent field means off, so an
options record written before these existed gives the building it always gave —
asserted, not assumed.

| Object | Category | Id | Placement |
|---|---|---|---|
| Roof | `Roof` | `roof`, parented to `storey-<storeys>` | Plan extent by 0.25 m, centred at `storeys * storeyHeight - slabThickness / 2` — where one more storey's floor slab would sit, so it rests on the top storey's walls. |
| Ceiling | `Ceiling` | `ceiling-1` up, each parented to `storey-<n>` | A 0.03 m plate whose top is the underside of the slab above, or of the roof on the top storey. Inset by half the exterior wall thickness each side, so it stops at the inner wall face. It clears the 2.1 m doors by 1.2 m at the default storey height. |

Both are emitted after every other object and draw no random numbers, so the seed
sequence is untouched. Their meshes, `roof-slab` and `ceiling-panel`, are
appended after the window meshes and only when asked for, so a building without
them keeps exactly the mesh library it had.

Catalog: a new entry `buildingWithRoof` — the default building with both on — in
`fixtures`, `fixtureNames`, the summaries and `test/snapshots/`. The two building
entries share one `buildingSummary` helper rather than a copy. Its two schedules
are identical to `building.json`'s; every other snapshot is byte-for-byte
unchanged. Zero escape hatches.

## Verification, from `viewer/` after the last edit

| Check | Result |
|---|---|
| `npx tsc --noEmit -p packages/synthetic/tsconfig.json` | clean |
| `npx eslint packages/synthetic` | clean |
| `npm test -w @bim-open-toolkit/synthetic` | 14 files, 223 tests pass, 1.6 s (212 before, so 11 new) |
| `npx tsc --noEmit -p packages/workflows/tsconfig.json` | clean, read-only |
| `npx tsc --noEmit -p packages/testing/tsconfig.json` | clean, read-only |

Limits: nothing has been rendered; the new objects are asserted against the
transforms of the slabs, walls and doors around them, not visually. At a
`storeyHeight` near the 0.5 m minimum a ceiling would fall below the door heads,
which is already true of the walls and is not newly checked.

## Blockers and requests

No blockers. To the E2E and demo tracks: `fixture('buildingWithRoof')` is the
model for "remove the ceilings and roofs to see inside"; hide the categories
`Roof` and `Ceiling`. The default `building` fixture still has neither.

## Findings

- The instance count another track hardcodes is the default building's 150
  objects. A test now asserts that number beside the fixture snapshot, so the
  next change to the generator fails here rather than in that track.
- The extras had to be optional rather than required because an existing test
  writes a full options literal. That test forced the change to be additive at
  the type level too, and was worth more than a new test would have been.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc -p packages/synthetic` | 4 | 12 s under load | 0 | none | **neutral** here — a small, typed change, so it confirmed rather than caught |
| `npm test -w @bim-open-toolkit/synthetic` | 3 | 1.6 s, 223 tests | 0, but it is the check that proves the default output is unchanged, which is the acceptance criterion | none | **helpful** |
| `eslint packages/synthetic` | 2 | 8 s under load | 0 | costs more wall time than the whole test suite | **neutral** |
| Fixture snapshots | 2 | under 1 s | 0 | `SYNTHETIC_UPDATE_SNAPSHOTS=1` rewrites all thirteen files, so adding one entry needs `vitest -t <name>` to leave the other twelve alone | **helpful**, with that caveat |
| `tsc` on `workflows` and `testing` | 1 each | 20 s together | 0 | none | **helpful** — the only evidence the change is additive for callers |
