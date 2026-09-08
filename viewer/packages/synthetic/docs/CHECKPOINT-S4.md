# Track S4 checkpoint — opt-in room volumes for the building

State: **verified**. Fence: `viewer/packages/synthetic/**` except `package.json`,
`tsconfig*.json` and `vitest.config.ts`. Nothing outside it was written. No nested
delegates. Contract revision **M1 with M1.1 and M1.2**; nothing in `model` was
edited and nothing needs adding — a room volume is an ordinary `representation`
on an `ObjectRecord` with its instance row.

Edited: `src/building.ts`, `test/building.test.ts`, `README.md`. New: this file.
No snapshot was regenerated, because no fixture's output changed.

## Delivered behaviour

A third optional field on `BuildingOptions`, `false` in `defaultBuildingOptions`,
following S3's `roof` and `ceilings` exactly:
`generateBuilding({ ...defaultBuildingOptions, roomVolumes: true })`. The existing
`Room` object gains geometry rather than a second object appearing beside it, so
the room keeps one identity for sets, selection and the schedule. It carries:

| | |
|---|---|
| Category, id, parent, name | Unchanged — `Room`, `room-<storey>-<cell>`, its storey when the link survived. |
| `representation` | The index of one shared `room-volume` unit box, scaled by the instance transform. |
| Instance row | Was `noMesh`; now draws that mesh. One row per room, still in object order. |
| Transform | Was a translation to the cell centre at the storey elevation; now `placeScaled` — the cell inset by half the interior wall thickness (0.12 m) each side, from the top of its floor slab up by the wall height (`storeyHeight - slabThickness`), which reaches the underside of the slab above. |
| Appearance | `spaceAppearance` unchanged: translucent blue, so what is inside the room stays visible. |

The volume's plan area is the `areaM2` the schedule already reported, now one
computation rather than the same formula written twice. A room whose storey link
was dropped still stands on the storey it was generated for, because the height
comes from the loop, not from the parent.

`buildingWithRoof` **stays as it is** — roof and ceilings only. Its purpose is
"hide the roof and the ceilings to see inside", and filling every room with a
translucent box would change what that demo shows. So no snapshot was touched and
`SYNTHETIC_UPDATE_SNAPSHOTS` was never set. A demo that wants volumes asks by
option; the README shows the one line.

`room-volume` is appended after `roof-slab` and `ceiling-panel`, so no mesh index
moves. No random numbers are drawn for it. The default building is asserted, not
assumed, to be the same 150 objects with the same geometry. Zero escape hatches.

## Verification, from `viewer/` after the last edit

| Check | Result |
|---|---|
| `npx tsc --noEmit -p packages/synthetic/tsconfig.json` | clean |
| `npx eslint packages/synthetic` | clean |
| `npm test -w @bim-open-toolkit/synthetic` | 15 files, 236 tests pass, 1.9 s (223 before, so 13 new: 8 mine, 5 from another writer's `test/schedule.test.ts`) |
| `npx tsc --noEmit -p packages/workflows/tsconfig.json` | clean, read-only |
| `npx tsc --noEmit -p packages/demos/tsconfig.json` | clean, read-only |

Limits: nothing was rendered; the volume is asserted against the slabs above and
below it and against the schedule's area. At the perimeter it overlaps the thicker
exterior wall, deliberately: the inset matches the recorded area, not that face.
One chunk, commit `PENDING`.

## Blockers, requests and findings

No blockers. To the demo tracks: a "show by room" page wants
`generateBuilding({ ...defaultBuildingOptions, roomVolumes: true })` and can
colour or filter the `Room` category directly, because the drawn instance is the
room, not a proxy. Ask here if a named fixture would be easier than the option.

For the supervisor: `src/schedule.ts` and a new `test/schedule.test.ts` were
uncommitted inside this fence when S4 started and are not S4's work. They were
left untouched and unstaged. Another writer is in `viewer/packages/synthetic`.

The three opt-in fields now share one shape. A fourth would be worth turning into
a set rather than four booleans; noted, not done.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc -p packages/synthetic` | 2 | 25 s under load | 0 | none | **neutral** — confirmed a small typed change |
| `npm test -w @bim-open-toolkit/synthetic` | 2 | 1.9 s, 236 tests | 0, but it is the check that proves the default building is untouched, which is the acceptance criterion | none | **helpful** |
| `eslint packages/synthetic` | 1 | 30 s under load | 0 | fifteen times the cost of the whole test suite | **neutral**, same verdict as S3 |
| Fixture snapshots | 1 | under 1 s | 0 | none this time, because no fixture changed; S3's warning about the update variable did not have to be tested | **helpful** |
| `tsc` on `workflows` and `demos` | 1 each | 40 s together | 0 | none | **helpful** — the only evidence the change is additive for callers |
