# @bim-open-toolkit/testing

The things every other package needs in order to be tested: named scenes to test against, a clock a
test winds by hand, a viewer-core scene built without a browser, a browser runner, and the benchmark
protocol the product brief's performance section asks for.

Nothing here is used by shipped code. It depends on `model`, `synthetic`, `render` and
`@ara3d/viewer-core`, and on `playwright-core` and `three` only where it says so.

| Area | Import | What it is |
|---|---|---|
| Fixtures | `src/fixtures` | Three deterministic scenes and a content fingerprint |
| Clock | `src/clock.ts` | A fake clock with scheduled callbacks and animation frames |
| Headless scene | `src/headless` | viewer-core groups and picking from a `Geometry`, in Node |
| Browser runner | `src/browser` | One playwright-core browser run per call, always closed |
| Benchmark protocol | `src/bench` | Camera paths, frame times, percentiles, reports |
| Artifacts | `src/artifacts.ts` | Where screenshots and reports are written |
| Instance update study | `src/perf` | Track PERF's measurements; see `docs/instance-updates.md` |
| Columnar binding study | `src/bindings` | Track BIND's prototype; see `docs/normalized-bindings.md` |

## Fixtures

```ts
import { sceneFixture, fixtureFingerprint } from '@bim-open-toolkit/testing';

const fixture = sceneFixture('small-building');
fixture.model.objects.length;   // 150
fixture.triangleCount;          // 1476: triangles every instance draws
fixtureFingerprint(fixture);    // eight hex digits: pin it to prove nothing moved
```

Three names: `small-building` (150 objects, both schedules with gaps), `ten-thousand-objects`
(10,159 objects, the scale the bulk-update target is stated against) and `stress` (10,000 instances,
7,779,292 triangles, inside the ten million budget). Every fixture returns the same shape — `model`, `geometry`,
`tables`, `triangleCount` — so a benchmark, a headless test and a browser spec take a fixture rather
than a particular generator. `buildingFixture` and `stressFixture` take options of your own.

The fingerprint is FNV-1a over the typed arrays, object records and table columns. It is a change
detector, not a security hash. `checkFingerprint(fixture, 'eeb23dde')` fails with both values so a
pin is updated deliberately.

## Clock

```ts
const clock = fakeClock({ frameIntervalMs: 16 });
clock.after(100, () => done());
clock.frames((timeMs) => draw(timeMs));
clock.advance(200);   // runs both, at their own times
```

Callbacks run at their due time, not at the time advanced to, and in scheduling order when due
together. `frames` has the shape interact's `FrameScheduler` requires, so `attachNavigation` and any
`CameraFlight` can be driven from a test with no timers and no waiting. A callback that reschedules
itself without delay throws instead of hanging the run.

## Headless scene

```ts
const built = headlessScene(fixture.geometry);
built.groups.length;                    // one InstancedGroup per drawn mesh
rowOfInstance(built, 0, 3);             // which instance row that is
colorInScene(built, row);               // what is actually in the buffer
boundsOfScene(built);                   // world bounds

const mirror = headlessMirror(built, fixture.geometry);
mirror.hits([0, 0, 1000], [0, 0, -1]);  // nearest first, as rows and object indices
mirror.dispose();
```

viewer-core and three only touch the GPU when a renderer draws, so counts, bounds, buffer contents
and picking can all be asserted in Node. Rows with no geometry keep their place in the mapping and
are drawn by nothing.

## Browser runner

```ts
const availability = await browserAvailability();
if (!availability.available) return skip(availability.reason);

const result = await runInBrowser({
  url: dataUrlPage('<!doctype html>…'),
  readyExpression: 'globalThis.pageReady === true',
  script: frameTimeProbeScript(path, { measuredFrames: 60 }),
  screenshotPath: join(artifactsFor(import.meta.url, 'browser'), 'run.png'),
  collectGraphics: true,
});
```

`playwright-core` ships no browser of its own, so a run uses one already installed, tried in order
(`msedge`, `chrome`, then playwright's own). Ask `browserAvailability` first and skip with its
reason rather than failing on a machine that has none. One browser process per call, closed in a
`finally`. Software WebGL is on by default: correct pictures, not representative frame rates.

Output goes under `viewer/artifacts/testing`, which git ignores; `artifactsFor(import.meta.url)`
finds it from anywhere in the package.

## Benchmark protocol

```ts
const path = orbitCameraPath('orbit', boundsOfScene(built));
const probe = parseFrameProbeResult(result.value);
const frames = frameReport(probe.value.samples);
await writeReport(artifactsFor(import.meta.url), {
  name: 'Stress scene orbit', recordedAt: new Date().toISOString(),
  device: nodeDevice(), browser, method, scene: sceneInfoOf(fixture),
  frames, load, memory, operations,
});
```

A camera path is camera states with timestamps, recorded from a session or generated as a
repeatable orbit around a box; playback draws one recorded view per frame, so the frames measured
are the frames recorded. Two numbers are kept per frame: the interval a viewer sees and the time the
measured work cost. `timingStats` gives median, 95th percentile and how many values missed the
budget; the budgets are `targetFrameBudgetMs` (33.3) and `bulkUpdateBudgetMs` (1,000).

Every report carries device, browser and method beside the numbers, and names its scene by fixture
fingerprint. A figure nobody could measure is `undefined` with a note saying why, never a plausible
substitute.

## Running

```
npm test -w @bim-open-toolkit/testing      # everything here, no browser except the runner's own test
npm run perf -w @bim-open-toolkit/testing  # the PERF and BIND studies; slow, run on a quiet machine
```
