# Track W checkpoint: backend availability

State: W1, W2, W3 done (2026-09-18). No processes left running.

## Design

- `bimopenflow/web/packages/app/src/hostStatus.ts`: DOM-free. A pure reducer
  `reduceHostStatus(state, event)` over `success | failure` events with states
  `connected | reconnecting | offline` (offline after two consecutive
  failures; the first result decides the start state). `createHostStatus`
  wraps it with a reporting `fetch` (TypeError and 5xx are failures; 4xx
  means reachable), subscribers, `reportFailure` for the SSE `onerror`, and a
  probe timer: an immediate probe on `start`, then `probeIntervalMs`: 5 s
  while not connected, 15 s while connected. `watchHost(make)` builds the
  ApiClient on the reporting fetch and probes with `listModels`.
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
- `duckdbDemo.ts`: builds its ApiClient through `watchHost`, mounts the banner,
  routes the Ask requests through `host.fetch`, passes `host` to `createApp`,
  and retries `start()` on reconnect while the app has not been created.
  The demo's own error line is shown only when the host was connected.
- `showcase.ts`: probe-only status and banner (the page does not call the API).
- `packages/api-client/test/apiClient.test.ts`: reads `contracts/contracts.json`
  and, for every fetch-backed endpoint, asserts the verb and the filled path
  (with encoded parameters); also the JSON body header, optional query
  parameters, the model-bytes url, and the error message
  `GET /api/analyses/an%201 -> 404: {"error":"missing"}`. A first test fails
  if an endpoint is added to the contract without a case here.

## Files touched
- packages/app/src/hostStatus.ts (new), packages/app/test/hostStatus.test.ts
  (new; placed under `test/` like every other app test instead of `src/`)
- packages/app/src/{topbar.ts, app.ts, main.ts, graphDemo.ts, duckdbDemo.ts, showcase.ts, styles.ts}
  (styles.ts holds the app's injected CSS; treated as "the app's css files")
- packages/state/src/sync.ts, packages/state/test/sync.test.ts
- packages/api-client/{package.json, tsconfig.json (new), vitest.config.ts (new), test/apiClient.test.ts (new)}
  The package.json is hand-maintained (generate.mjs emits only src/index.ts),
  so `test`/`typecheck` scripts and vitest/typescript devDependencies went
  there, matching packages/state. `npm install` then recorded them in
  bimopenflow/web/package-lock.json (four added lines); the lockfile is
  outside the fence but is the mechanical consequence of that edit.
- gates/web-smoke.mjs: api-client test step before viz.

## Chunks
- W1: 83c5670
- W2: 50dad3b
- W3: ee9d0fe

## Checks run
- `npx vitest run --root packages/app test/hostStatus.test.ts`: 12 passed.
- `npm test -w @bimopenflow/state`: 51 passed (one new: onStreamError).
- `npm test -w @bimopenflow/app`: 172 passed.
- `npm test -w @bimopenflow/api-client`: 17 passed.
- `npx tsc -p packages/app --noEmit` and `-p packages/api-client`: clean.
- `node gates/web-smoke.mjs` (with the api-client step): WEB SMOKE: PASS.
- Browser, Vite on 5313 with `BOF_HOST=http://127.0.0.1:5999` (nothing
  listening): index.html and 3d.html both show the red banner "Host not
  reachable at http://127.0.0.1:5313/api. Start it and it will reconnect."
  and "offline" in the topbar within about 3 s; duckdb.html within 2 s;
  showcase.html shows "Reconnecting…" at 1 s and the red banner by 6 s.
- Reconnect cycle on index.html with the host built into artifacts/agent-w
  (`--profile tables --models samples/tables`, port 5999): banner cleared and
  the topbar read "connected" within 8 s of the host starting, with the
  catalog and the sample analyses loaded. Killing the host while idle
  produced the red banner and "offline" within about 20 s (see Findings).
  Restarting it cleared the banner within 8 s and the open analysis
  `category-mix` re-established its events stream and refetched suggestions.
- Screenshots were taken with the browser pane; they are not saved to disk.

## Running processes
- None. Vite (PID 8600) and both host instances were stopped; ports 5313 and
  5999 confirmed free.

## Blockers
(none)

## Findings
- The Vite proxy answers 500 when the target refuses the connection, so a
  5xx must count as a host failure; a 4xx is treated as reachable.
- When the host dies while the page is idle, the EventSource `onerror` did
  not fire promptly; the first failure came from the 15 s probe, so the
  banner took about 20 s to appear. Lowering the connected cadence to 10 s
  would make it about 15 s; active use (any fetch) reports immediately.
- `graphDemo.ts` was changed under me by the 3D track (commit 58f029e, boot
  guarded by `if (root)`); my edit was rebased onto that version by hand.
- `showcase.ts` does not call the host API at all (the model comes from the
  Vite fixture at `/__bimflow/snowdon.bfast`), so its banner is a
  probe-only status.
- Only `showcase.ts` disposes its status on `pagehide`; `main.ts` and
  `graphDemo.ts` never dispose (page lifetime), which matches how they treat
  the app itself.

## Requests
(none)
