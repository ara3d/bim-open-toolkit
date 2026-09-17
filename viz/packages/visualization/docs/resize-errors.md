# Resize error regression — 2026-09-07

The gallery's canvas could retain its intrinsic minimum height inside the grid:
the pre-fix browser regression measured a 602px viewport after the browser height
shrank to 400px. The viewport now has `min-height: 0`. Drawing-buffer writes from
resize observers run in one coalesced animation frame after observer delivery;
teardown disconnects observation and cancels pending work. Gallery, comparison,
and the original review example share this scheduling helper.

Runtime alerts remain visible at the bottom, with bounded height and scrolling.
They do not cover the gallery navigation. Errors are not suppressed or filtered.

The browser harness collects window `error` and `unhandledrejection` events as
well as Playwright page errors and console errors. Browser-generated observer
errors can bypass Playwright's page-error event. Collected messages fail ordinary
scenarios and appear in JSON failure output, including when an earlier assertion
fails. There is no automatic connection from a user's open browser to a coding
task: an agent must run the harness or inspect the browser.

Verification on Edge 152 with software WebGL:

- Focused `test/observe-resize.test.ts`: deferred/coalesced writes and cancellation
  after disposal pass. Unit tests do not simulate browser layout.
- `BIM_BROWSER_CASE='Resize stability' npm run demo:browser`: small and Snowdon
  pass at 2x pixel density across desktop, narrow and short viewports, including
  adding/removing the second view. The small test failed before the CSS fix.
- `BIM_BROWSER_CASE='ResizeObserver browser' npm run demo:browser`: an intentionally
  induced native observer loop is captured and displayed; navigation still works.
- `BIM_BROWSER_CASE='Runtime error preserves' npm run demo:browser`: injected error
  and long mobile banner preserve clickable gallery navigation.
- `npm run demo:check`, `npm run demo:build`, and `npm run demo:snowdon` pass.
  Snowdon bytes: 9,362,255; SHA256
  `fc31c4463d9eb958ae8de3d853cfc8224b9469477b419857fbc929956c9cc51d`.

These are focused functional checks, not hardware performance qualification or
a claim that all possible third-party resize loops are fixed.
