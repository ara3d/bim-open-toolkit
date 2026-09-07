# Comparison checkpoint

V1/G1 read; Parallel Wave and Platonic Coder applied. Owned paths: `src/view-link.ts`, `test/view-link.test.ts`, `examples/features/comparison.ts`, and this checkpoint. State: verified by focused tests and strict scoped typecheck. No processes or shared build outputs.

`linkCameraViews(a, b, {initial?})` accepts renderer-independent read/write/subscribe endpoints. Camera updates propagate in both directions, suppress synchronous feedback and skip identical poses (including delayed echo events). Writes receive independent snapshots. Default initialization copies A to B; use `initial: 'b'` to reverse or `false` to retain initial poses. The returned unsubscribe is idempotent. Endpoints must report authoritative current poses and should not clamp them differently if exact linking is expected.

`comparisonDemo` adds/removes a second Viewer sharing borrowed source groups and mesh buffers, while owning separate GPU resources and controls. Each canvas occupies half the original viewport. Both cameras fit the model using the narrow viewport aspect. Cameras begin independent; explicit linking copies the first pose and then follows controls updates in either direction, including programmatic Fit. There is no animation loop or scene polling. Removing/resetting the feature disposes the second viewer, controls, observer and link listeners and restores the original width.

Limitations: this compares camera views of one model, not two revisions. Geometry data is shared; GPU mirrors are duplicated. Selection review remains in its separate feature. Actual two-context Snowdon rendering/memory and touch operation need the coordinator's browser gate.

Checks (September 7, 2026), package-local executable `../../node_modules/.bin/`: `vitest.cmd run test/view-link.test.ts --maxWorkers=1 --cache=false` passed 3 tests in 358 ms; `tsc.cmd --noEmit --strict --skipLibCheck --target ES2022 --module ES2022 --moduleResolution bundler --lib ES2022,DOM examples/features/comparison.ts` passed. Tests cover bidirectional updates, sync/delayed echo suppression, initialization modes, snapshots, unsubscribe and cleanup after initial write failure. Commit pending.
