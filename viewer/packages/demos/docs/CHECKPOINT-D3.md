# Track D3 — workflow demos A

Contract revision: G1 at 39a01b5 (`demos/src/gallery/contracts.ts`, `ui-gratify/src/contracts.ts`).
Fence: `demos/{src,test}/demos/{_workflows,door-schedule,revision-comparison,takeoff,pricing-alternatives,delivery-timeline}/**`,
their thumbnails, this file.

## State

| Piece | State | Notes |
|---|---|---|
| `_workflows` | verified | 508ec08. D4 may start. |
| `door-schedule` | working | |
| `delivery-timeline` | not started | |
| `pricing-alternatives` | not started | |
| `takeoff` | not started | |
| `revision-comparison` | not started | |

## Delivered

`demos/src/demos/_workflows/`:

- `apply-result.ts` — `applyWorkflowResult(session, result, options)`: defines the sets, adds the
  rules, draws the overlays with the demo's click action, saves the view, selects what the workflow
  points at. `selectedSetId` reads that set from the workflow's own recipe. A refused dispatch is
  returned as a failure with its diagnostics.
- `exceptions.ts` — the exceptions as one `SheetTable` of text columns in reading order;
  `exceptionsFirst` orders any list.
- `basis.ts` — the one honesty sentence and the sidebar group stating fixture, basis and how much
  the workflow could not decide.
- `fixture.ts` — a `DemoFixture` from a catalog fixture; refuses one with no geometry;
  `tabularFixture` gives a table-only generator real objects and an honestly empty viewport.
- `columns.ts` — a generator's six state columns back into one `ObservationJson`.
- `bounds.ts` — the box each object occupies, and the box of a set of them.
- `actions.ts`, `held.ts` — two shims, below.

## Commands and results

From `viewer/`, 2026-09-08:

- `npx tsc --noEmit -p packages/demos/tsconfig.json` — clean (about 100 s under load from the other
  tracks).
- `npx vitest run --root packages/demos test/demos/_workflows` — 19 tests, 3 files, passed, 1.4 s.

## Chunk commits

- `508ec08` `_workflows`: the shared helper, 12 files, 896 lines.

## Shims, and what would remove them

1. `actions.ts`. An `OverlayAction` (`render/overlays.ts`) carries a record of strings, numbers and
   flags, and no landed command selects an object from a key. So a demo defines a one-member set per
   object and a click names that set. **Request to FA:** `sets.selectKeys { keys: string }`, taking
   space-separated keys the way the synthetic tables already carry a list in one cell.
2. `held.ts`. G1 hands `inspector`, `ready` and `report` a `Session` only, and no feature owns result
   tables, so a demo keeps its own result beside the session. **Request to GAL:** a context from
   `start` to those three, or a sheet source returned from `start`.
3. `bounds.ts` re-implements model's private `meshBoundsOf`. **Request to M:** export it.

## Requests to other tracks

- **FA** — `sets.selectKeys { keys: string }` (above). Also: `appearance` has no way to replace a
  rule; `delivery-timeline` re-colours on every scrub, so it removes and re-adds. A
  `appearance.putRules` that replaces by id would halve the dispatches.
- **FC** — `overlays.add` takes no `action`, so a workflow overlay cannot be made clickable through
  it; `applyWorkflowResult` merges a layer and dispatches `overlays.set` instead.
- **GAL** — the `held.ts` request above. Also `gratify` is not in `demos/package.json`; it resolves
  from the hoisted root `node_modules` today. Ask the supervisor to declare it.
- **W** — none. `recipe.ts` was updated to the landed feature command names while this chunk was
  being written, which removed a translation layer this track had started to build.

## Findings

- `workflows`' `timelineStateColors` (`scheduled|delivered|accepted|installed`) and `features`'
  `animation.timelineColors` (`pending|delivered|accepted|installed`) name different states and give
  the same state different colours. Section 5 row 5 says the colours come from `workflows`, so
  `delivery-timeline` colours through `appearance` from the workflow's palette rather than through
  the animation feature's own rules.
- `costs` publishes tables and no geometry at all, so `pricing-alternatives` has nothing to draw.
  It uses `tabularFixture` and says so on the page rather than borrowing a building.

## Tooling

| Check | Runs | Wall time | Real defects | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` (demos) | 3 | 100–130 s each | 1 (a private model export imported by name) | Slow under seven parallel tracks; had to background it | Keep; it caught the only compile-level defect |
| `vitest` (scoped) | 3 | 1.4 s | 2 (a stale recipe input key, read from a file another track had just changed) | none | Keep |
