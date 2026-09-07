# React door review

`reactReviewDemo` mounts a React application into the G1.1 feature panel. The existing host owns the model, canvas, loading, picking, camera and renderer lifetime. React owns the filtered/sorted door table, evidence details, coverage toggle, save name, selected-row presentation and error state. It consumes the same `adaptDoorSchedule`, `SelectionStore`, `composeAppearance`, `SceneStorage` and validated persistence APIs as the plain demos.

The source is the actual local Snowdon BuildingModel projection, checked against the loaded geometry fingerprint. Missing/conflicting values remain explicit, geometry-free/unresolved rows retain facts, and no compliance classification is inferred. Saved selections use new names rather than implicit overwrites. Network/storage errors are visible; unmount aborts pending operations, removes React subscriptions, disposes the demo bridge and removes its owned DOM root.

`SelectionStore.snapshot()` returns the same immutable array until an actual selection change. `useSyncExternalStore` consumes this stable snapshot and unsubscribes on unmount. The demo bridge sends one appearance update per actual selection change. Filter and sort update React rows only. Camera changes have no React subscription; model scene construction remains in the host. No fake React implementation or copied viewer internals are used.

This increment is a nontrivial single-view review application. A reusable comparison host, React-controlled model replacement, persisted camera/rules and full physical-device/performance acceptance remain later work. The gallery host already supports route/model navigation and resizing; that does not establish the complete proposed React release criteria. Dependencies are optional demo dependencies, managed and registered by the supervisor.

## Checkpoint

- Contracts: G1.1/V1 acknowledged; required skills applied.
- State: verified. Three focused bridge tests passed (`test/react-review.test.ts --maxWorkers=1 --cache=false`), checking stable snapshots, once-per-change updates, cleanup and immutable fact sorting/composition. Isolated strict source/TSX check passed with `--jsx react-jsx --noEmit`, ES2022/bundler, strict, noUncheckedIndexedAccess and exactOptionalPropertyTypes after React 18 dependencies were installed by supervisor. React rendering/browser behavior remains unverified by this track.
- Source commit: `1d0cb0a`; implementation ownership returned to the coordinator. This track owns only this checkpoint during acceptance review.
- Acceptance review: root unmount, external-store subscription cleanup, fetch/restore cancellation and explicit storage errors were inspected; no additional blocking defect found. Browser React mounting, interaction and repeated route-reset behavior still require supervisor verification.
- Broad gate: 25 files / 144 tests passed with `vitest run --exclude test/snowdon.integration.test.ts --maxWorkers=2 --cache=false` after persistence correction `c6c2cba` and the coordinator-confirmed replacement fix were stable. The excluded real-scene integration file remained owned by its active writer. This is test verification, not browser acceptance.
- Processes: none.
- Outstanding: supervisor browser/React lifecycle verification and real-scene integration gate.

## Final read-only review findings

- Plain `features/doors.ts` updates evidence details only from a table-row click. A later canvas pick or saved-selection restore updates colors/selected rows but leaves the prior evidence details visible. Derive details from selection changes, retaining an explicit focused row only for unresolved identities.
- `gallery/host.ts` disposes on every `pagehide` without handling persisted `pageshow`. If the browser restores the feature from its back/forward cache, the restored DOM can retain a disposed viewer/store. Handle persisted restoration or deliberately reload it. This is a source-level finding; browser reproduction was not performed by this track.
- React selection snapshots, abort cleanup and guarded revision-aware restores remain sound in the inspected flow. Controls reject concurrent mouse/touch ownership and release captures during disposal. No source changes were made during this review.
