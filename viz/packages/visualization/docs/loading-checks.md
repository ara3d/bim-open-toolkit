# Loading failure checks

The `loading-checks` gallery demo calls the public `loadBosModel` API with three small fault cases. It never submits returned bindings or model edits to the viewer, so the primary Snowdon scene remains loaded.

- HTML: fetch `/` from the actual same-origin gallery server. PASS requires `load-failed` and an HTML diagnostic; a missing route or network error cannot masquerade as this check passing.
- Truncated ZIP: pass four PK header bytes locally. PASS requires `load-failed`.
- Pre-aborted load: abort the signal before loading `/`. PASS requires `aborted`, without a successful result; the loader checks cancellation before fetching.

Buttons are disabled during a check. Unexpected acceptance, diagnostics or thrown exceptions produce a visible alert. The demo also checks that the scene group count stayed unchanged. Disposal aborts pending work and removes owned controls; late completion cannot update the removed panel. No large fixture is fetched again and no global fetch/progress mocks are installed.

Automated loader regressions remain in `test/loading.test.ts`. This small demo supplies an interactive actual-route check, not a substitute for the opt-in normalized Snowdon gate in `docs/snowdon-verification.md`.

Track checkpoint: owns only this document and `examples/features/loading-checks.ts`; G1.1 context unchanged. Scoped strict TypeScript compilation passed with ES2022/bundler resolution, unused checks and isolated modules. Coordinator owns registration and browser verification. No running processes or generated outputs; commit turn requested.
