# Checkpoint T — testing package

State: verified. Contract revision M1 (with M1.1). Fence: `packages/testing/src/**` and `test/**`
minus the PERF (`src/perf`, `test/perf`) and BIND (`src/bindings`, `test/bindings`) areas, plus
`docs/CHECKPOINT-T.md` and `README.md`. Nested sub-agents used: none.

## Delivered

| Area | Files | Behaviour |
|---|---|---|
| Fixtures | `src/fixtures/{fingerprint,scene-fixture,catalog,index}.ts` | Three deterministic scenes over `synthetic`: `small-building` (150 objects, 1,476 triangles), `ten-thousand-objects` (10,159 objects, 97,068 triangles), `stress` (10,000 instances, 7,779,292 triangles). Each returns `ModelData`, `Geometry` and named tables in one shape, plus `triangleCount`. FNV-1a fingerprint over typed arrays, object records and table columns as eight hex digits; `checkFingerprint` names both values when it moves. `buildingFixture`/`stressFixture` take options. |
| Fake clock | `src/clock.ts` | `now`, `advance`, `advanceTo`, `runPending`, `at`, `after`, `frames`, `pending`, `nextDueMs`. Callbacks run at their due time and in scheduling order when due together; `frames` matches interact's `FrameScheduler`; runaway self-rescheduling throws instead of hanging. |
| Headless scene | `src/headless/{scene,picking,index}.ts` | `headlessScene` builds one `InstancedGroup` per drawn mesh from a `Geometry`, in one counted pass, keeping group-of-row, index-in-group, row-of-instance and object-of-row. `boundsOfScene`, `transformInScene`, `colorInScene` read it back. `headlessMirror` mirrors into three.js and answers rays as rows and object indices. No GL context anywhere. |
| Browser runner | `src/browser/{runner,index}.ts` | `browserAvailability` then `runInBrowser`: one process per call, closed in a `finally`, channels `msedge`, `chrome`, `bundled`, software WebGL by default, readiness expression, console and page errors, page-side script, screenshot, graphics probe. `dataUrlPage` needs no server. |
| Benchmark protocol | `src/bench/{camera-path,timings,measurements,report,page-script,index}.ts`, `src/artifacts.ts` | `CameraPath` as stamped `ViewState`s, recorded or generated as a repeatable orbit; frame collection keeping interval and cpu time separately; `percentile`, `timingStats`, the 33.3 ms and 1,000 ms budgets; load timed phase by phase; memory readings that report an unmeasurable figure as `undefined` with a reason; `BenchmarkReport` carrying device, browser and method beside the numbers, identifying its scene by fixture fingerprint, written as JSON plus markdown. `frameTimeProbeScript` is the page-side collector; `parseFrameProbeResult` checks what comes back. |

`README.md` covers all of it with worked examples. `docs/testing.md` was not written: the README
says the same thing and the 2026-09-08 review counted duplicate prose as waste.

## Commands and results

From `viewer/`, after every chunk and again at the end:

- `npx tsc --noEmit -p packages/testing/tsconfig.json` — clean.
- `npx eslint packages/testing` — clean. Zero `any`, `as`, non-null assertions or directives added.
- `npm test -w @bim-open-toolkit/testing` — 15 files, 133 tests, all passed, 6.8 s on a quiet
  machine (the browser cases are 2 of those tests and about 4 s of it).
- Browser run really happened: `viewer/artifacts/testing/browser/runner.png`, msedge 152.0.4191.66,
  software WebGL, twelve measured frames turned into frame statistics.

`npm run perf` not run: other tracks were compiling throughout, and the plan says its relationships
fail under load. The PERF and BIND areas were not touched.

## Chunk commits

`41c42ef` fixtures and fingerprint · `65d38d7` fake clock · `058603d` headless scene and picking · `5ccd617` benchmark protocol · `b22ab8b` browser runner · plus this checkpoint and the README.

## Requests

- `src/index.ts` (supervisor-owned) needs these export lines added under the existing bindings line:
  ```ts
  // Named, deterministic scenes and the fingerprint that proves one did not change.
  export * from './fixtures/index.js';
  // A clock a test winds by hand, for animation and frame-scheduled work.
  export * from './clock.js';
  // A viewer-core scene built from model geometry in Node, and picking against it.
  export * from './headless/index.js';
  // A browser run on playwright-core: one process per call, always closed.
  export * from './browser/index.js';
  // The benchmark protocol: camera paths, frame times, percentiles, reports.
  export * from './bench/index.js';
  // Where screenshots and benchmark reports are written.
  export * from './artifacts.js';
  ```
  No name collides with `bindings`. Until this lands, other tracks must import from
  `@bim-open-toolkit/testing/src/...` paths, which is why it matters.
- `package.json` (supervisor-owned) needs two `devDependencies`: `playwright-core` (imported by
  `src/browser/runner.ts`) and `@bim-open-toolkit/interact` (imported by `test/clock.test.ts`,
  which drives a real `CameraFlight`). Both resolve today only through workspace-root hoisting and
  the tsconfig path map.

## Findings

- `playwright-core` 1.63.0 has no bundled browser here (`chromium_headless_shell-1243` absent).
  `msedge` 152.0.4191.66 and `chrome` 152.0.7977.78 both launch. The runner tries channels in order
  and reports why none did; the tests skip on that reason rather than failing.
- Browser launch time is dominated by machine load, not by the runner: the same two browser cases
  took 147 s while five tracks were compiling and 4 s on a quiet machine. Wave 3's Track P should
  not share a machine with compiling tracks.
- `model/math.ts` has no three-dimensional cross product, so `src/bench/camera-path.ts` has a local
  one. This is the same gap Track I already reported (its `cross`, `dot` and `unitSlerp` belong in
  `model/math.ts`); a third copy now exists.
- A building of 45 storeys by 45 rooms is the cheapest way the `building` generator reaches ten
  thousand objects (about five objects per room). It is a scale fixture, not a plausible building,
  and its description says so.
- `SceneObject.raycast` returns one hit per triangle a ray meets, so a ray along the shared diagonal
  of a two-triangle quad reports two hits at the same point. Not a defect, but a picking test that
  aims at the middle of a face will double-count.

## Blockers

None.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` per package | 8 | 4 to 12 s each | 3: an unused import, an unchecked index in a test, a wrong playwright type on the launched browser | none | keep |
| `eslint packages/testing` | 8 | about 4 s | 0 beyond what tsc caught | duplicates tsc so far in this package; its value here was the ban on `any` and `as`, which changed a design (the probe result got a schema instead of a cast) | keep |
| `npm test -w` | 9 | 1.5 to 7 s (147 s once, under load) | 5: a false claim in a hash comment, a fingerprint pinned before it was measured, a picking ray on a triangle seam, an orbit assertion that proved nothing, a probe result read without checking it | none | keep |
| Nested Sonnet sub-agents | 0 | — | — | every piece needed a design decision; none was mechanical enough to hand over | not needed |
