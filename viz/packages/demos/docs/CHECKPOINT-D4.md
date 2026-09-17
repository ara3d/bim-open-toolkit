# Checkpoint D4 — workflow demos 17 to 21

Fence: `demos/{src,test}/demos/{valve-isolation,access-coordination,asset-handover,material-carbon,portfolio}/**`,
`demos/thumbnails/<those ids>.png`, this file, plus **one extension**: `demos/test/demos/_d4-support/**`,
a test-only directory holding the recording session and the headless panel probe all five demo tests
share. Namespaced so no other track collides; the alternative was five copies of the same file.

Contract revision: G1 at `39a01b5` (`demos/src/gallery/contracts.ts`, `ui-gratify/src/contracts.ts`).
Consumes Track D3's `_workflows` helper at `508ec08`.

## State per demo

| Demo | State | Notes |
|---|---|---|
| `portfolio` | verified | commit `968a675`; 17 tests |
| `material-carbon` | working | |
| `valve-isolation` | queued | |
| `access-coordination` | queued | |
| `asset-handover` | queued | |

## Files

- `src/demos/portfolio/{city,readings,panels,inspector,index}.ts`, `README.md`
- `test/demos/portfolio/demo.test.ts`
- `test/demos/_d4-support/{fake-session,panel-probe}.ts`

## Delivered behaviour

`portfolio`: the synthetic estate opens with `runPortfolioDrillThrough` applied through D3's
`applyWorkflowResult`. One card per building over the top of its mass, carrying the figure that
resolved for it, the outcome the result coloured it by and whether anybody surveyed it. Activating a
card isolates that building, selects it and frames its box; activating it again returns to the
estate, and the other cards report no world point meanwhile. The sheet lists every document by name
with what it maps to — one building, a disagreement naming several, or nothing at all — plus the
drill-through, rollup and exceptions tables. The unfiled survey and the campus report naming two
buildings stay visible as such; the site with no resolved contributor gets no rollup row.
Everything shown is read back off the workflow result rather than derived again.

## Commands, with results

- `npx tsc --noEmit -p packages/demos/tsconfig.json`: clean for D4's files. Pre-existing errors from
  other tracks' in-progress files (`feature-demos/show-by/groups.ts` TS7022; `point-and-read/panels.ts`
  exports mid-edit) are not D4's and were not touched.
- `npx vitest run --root packages/demos test/demos/portfolio`: 17 passed, 2.4 s.

## Chunk commits

- `968a675` portfolio demo, plus the two shared test-support files.

## Remaining work

Demos 17 to 20; thumbnails for all five (GAL's `gallery:smoke` on port 5194 with `THUMBNAILS=1` does
not exist yet, so no thumbnail has been captured and none is claimed).

## Blockers

None.

## Requests

- **UG**: the widget kit. `portfolio` draws its cards from Gratify's `Stack`, `Row` and `Label`;
  `Card`, `Chip`, `Tag` and `Legend` would replace `panels.ts`'s local part. Also useful in the kit:
  a model `Color` (0..1) to painter `Color` (0..255) conversion — every demo that shows an analytical
  colour needs it and each one writes it again.
- **S / W**: a reader that rebuilds an `Observation` from `synthetic`'s `quantityColumns` output
  (`foo`, `fooState`, `fooUnit`, `fooConflict`, `fooMissingReason`). It is the inverse of a function
  `synthetic` already exports, and it is written by hand in four of the workflows' own generated
  tests and again in `portfolio/city.ts`.
- **GAL**: a `demos/test/demos/_shared/**` for test support the demo tracks share, so `_d4-support`
  and D2's `_d2-support` can go.
- **D3**: nothing. `applyWorkflowResult`, `exceptionsSheet` and `textTable` fit this track's demos
  as they stand.

## Findings

- Gratify's headless `Runtime` drives a panel end to end without a canvas: `key('Tab')` then
  `key('Enter')` runs the real `Focusable` and `Press` interactors and commits the doc, so a panel's
  command path is testable in node. `semanticsTree()` comes back populated, which is what the DOM
  mirror will read.
- G1's `AnyHudPanel.host(mount)` is enough to reach a panel's typed spec from a test without a cast:
  the mount callback is generic, does its work inside, and returns a failure instead of a `Hosted`.

## Tooling

| Check | Runs | Wall time | Defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit -p packages/demos` | 3 | 12 to 18 s | 0 in D4's own files | Reports other tracks' in-progress files, so the output has to be filtered by path every time | Keep, but a per-directory typecheck would be worth more here |
| `vitest run test/demos/portfolio` | 2 | 2.5 s | 0 (all 17 passed first run) | none | Keep |
