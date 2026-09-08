# Track I checkpoint — interact

State: working (chunk 1 verified)

Model revision built against: `@bim-open-toolkit/model` at commit `e2d71de` (`src/view.ts` landed
in `478984c`). `CameraPose`, `Projection`, `ViewState`, `Vec3`, `Matrix4`, `Bounds`,
`CoordinateContext` and `Result` are all exported, so no local structural types are needed and
`src/shapes.ts` was not created.

Fence: `viewer/packages/interact/**` except `package.json`, `tsconfig.json`, `tsconfig.build.json`,
`vitest.config.ts` (supervisor-owned).

Nested sub-agents spawned so far: 0.

## Chunk plan

| # | Concern | Files | State |
|---|---|---|---|
| 1 | wrap-or-replace decision | `docs/DECISION-controls.md`, this file | verified, committed |
| 2 | camera pose math and the view matrix | `src/camera.ts`, `test/camera.test.ts` | not started |
| 3 | projection math, fit-to-bounds, projection switching | `src/projection.ts`, `test/projection.test.ts` | not started |
| 4 | normalized input record | `src/input.ts`, `test/input.test.ts` | not started |
| 5 | bindings table, defaults, validation | `src/bindings.ts`, `test/bindings.test.ts` | not started |
| 6 | mode reducers: orbit, first-person, overhead | `src/navigation.ts`, `test/navigation.test.ts` | not started |
| 7 | interruptible camera animation | `src/animation.ts`, `test/animation.test.ts` | not started |
| 8 | session: navigation plus animation | `src/session.ts`, `test/session.test.ts` | not started |
| 9 | DOM adapter | `src/dom.ts`, `test/dom.test.ts` | not started |
| 10 | exports and README | `src/index.ts`, `README.md` | not started |

## Chunk 1 — decision

Decision: `interact` **replaces** `@ara3d/viewer-controls` rather than wrapping it. Reasons in
`docs/DECISION-controls.md`, scored against the four criteria in the brief order. The deciding
criterion is parallel development: the alpha packages are read-only for V2 and removed at the wave
4 cutover, so a wrapper would put a V2 package behind a dependency no V2 track may change and
behind alpha build state other sessions are editing. Correctness is the second reason: the alpha
`OrbitModel` hardcodes +Y up in both `position` and `pan`, while V2 views declare their up axis
through `CoordinateContext` and BIM data is Z-up.

Commit: pending (recorded below when made).

## Delivered behavior

Nothing yet beyond the decision.

## Remaining work

Chunks 2 to 10 above.

## Commands and results

Run from `viewer/`:

| Command | Result |
|---|---|
| (none yet; chunk 1 is documentation only) | |

## Blockers

None.

## Requests to the supervisor

1. Remove `"@ara3d/viewer-controls": "0.1.0"` from `viewer/packages/interact/package.json`
   dependencies. Nothing in the package imports it (decision above). `three` is **not** requested.
   Until this lands the declaration is unused and harmless.

## Findings

- `model`'s `frameBounds` sizes an orthographic projection as `height = radius * 2`, ignoring the
  viewport aspect. At aspect below 1 (a portrait viewport) that cuts the box off horizontally.
  `interact` computes its own orthographic fit as `height = 2 * radius * max(1, 1 / aspect)`.
  Suggested fix in `model`, not made here because `packages/model` is not in this fence.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| (none yet) | | | | | |
