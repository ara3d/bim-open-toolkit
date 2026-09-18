# Track W checkpoint: backend availability

State: W1 done, W2 and W3 pending (2026-09-18).

## Design

- `bimopenflow/web/packages/app/src/hostStatus.ts`: DOM-free. A pure reducer
  `reduceHostStatus(state, event)` over `success | failure` events with states
  `connected | reconnecting | offline` (offline after two consecutive
  failures; the first result decides the start state). `createHostStatus`
  wraps it with a reporting `fetch` (TypeError and 5xx are failures; 4xx
  means reachable), subscribers, `reportFailure` for the SSE `onerror`, and a
  probe timer: `probeIntervalMs` is 5 s while not connected, 15 s while
  connected. `watchHost(make)` builds the ApiClient on the reporting fetch and
  probes with `listModels`.
- `topbar.ts`: `setConnection(HostStatus)` and `mountHostBanner(doc, host)`, a
  fixed strip along the bottom of the page (amber while reconnecting, red when
  offline) naming the API url and the recovery hint. It is page-level so the
  same call works inside and outside the app shell (showcase has no shell).
- `app.ts`: takes `options.host`; the topbar follows it; boot and open no
  longer set the status themselves; on a transition to connected the app
  re-reads the analysis list and reopens the current analysis, or retries a
  boot that never completed. Error toasts are shown only for failures that
  happened while the host was connected (the banner covers the rest).
- `state/src/sync.ts`: `ConnectOptions.onStreamError` is passed to
  `analysisEvents`.

## Files touched
- packages/app/src/hostStatus.ts (new), packages/app/test/hostStatus.test.ts
  (new; placed under `test/` like every other app test instead of `src/`)
- packages/app/src/{topbar.ts, app.ts, main.ts, graphDemo.ts, styles.ts}
  (styles.ts holds the app's injected CSS; treated as "the app's css files")
- packages/state/src/sync.ts, packages/state/test/sync.test.ts

## Chunks
- W1: (hash below)

## Checks run
- `npx vitest run --root packages/app test/hostStatus.test.ts`: 12 passed.
- `npm test -w @bimopenflow/state`: 51 passed (one new: onStreamError).
- `npm test -w @bimopenflow/app`: 172 passed (before graphDemo test landed).
- `npx tsc -p packages/app --noEmit`: clean.
- Browser, Vite on 5313 with `BOF_HOST=http://127.0.0.1:5999` (nothing
  listening): index.html and 3d.html both show the red banner "Host not
  reachable at http://127.0.0.1:5313/api. Start it and it will reconnect."
  and "offline" in the topbar within about 3 s. Screenshots were taken with
  the browser pane (not saved to disk).

## Running processes
- Vite dev server, port 5313, PID 8600 (to be stopped at the end).

## Blockers
(none)

## Findings
- The Vite proxy answers 500 when the target refuses the connection, so a
  5xx must count as a host failure; a 4xx is treated as reachable.
- `graphDemo.ts` was changed under me by the 3D track (commit 58f029e, boot
  guarded by `if (root)`); my edit was rebased onto that version by hand.
- `showcase.ts` does not call the host API at all (the model comes from the
  Vite fixture at `/__bimflow/snowdon.bfast`); W2 gives it probe-only status.

## Requests
(none)
