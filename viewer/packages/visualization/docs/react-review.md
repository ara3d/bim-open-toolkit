# React door review

`reactReviewDemo` mounts a React application into the G1.1 feature panel. The existing host owns the model, canvas, loading, picking, camera and renderer lifetime. React owns the filtered/sorted door table, evidence details, coverage toggle, save name, selected-row presentation and error state. It consumes the same `adaptDoorSchedule`, `SelectionStore`, `composeAppearance`, `SceneStorage` and validated persistence APIs as the plain demos.

The source is the actual local Snowdon BuildingModel projection, checked against the loaded geometry fingerprint. Missing/conflicting values remain explicit, geometry-free/unresolved rows retain facts, and no compliance classification is inferred. Saved selections use new names rather than implicit overwrites. Network/storage errors are visible; unmount aborts pending operations, removes React subscriptions, disposes the demo bridge and removes its owned DOM root.

`SelectionStore.snapshot()` returns the same immutable array until an actual selection change. `useSyncExternalStore` consumes this stable snapshot and unsubscribes on unmount. The demo bridge sends one appearance update per actual selection change. Filter and sort update React rows only. Camera changes have no React subscription; model scene construction remains in the host. No fake React implementation or copied viewer internals are used.

This increment is a nontrivial single-view review application. A reusable comparison host, React-controlled model replacement, persisted camera/rules and full physical-device/performance acceptance remain later work. The gallery host already supports route/model navigation and resizing; that does not establish the complete proposed React release criteria. Dependencies are optional demo dependencies, managed and registered by the supervisor.

## Checkpoint

- Contracts: G1.1/V1 acknowledged; required skills applied.
- State: verified. Three focused bridge tests passed (`test/react-review.test.ts --maxWorkers=1 --cache=false`), checking stable snapshots, once-per-change updates, cleanup and immutable fact sorting/composition. Isolated strict source/TSX check passed with `--jsx react-jsx --noEmit`, ES2022/bundler, strict, noUncheckedIndexedAccess and exactOptionalPropertyTypes after React 18 dependencies were installed by supervisor. React rendering/browser behavior remains unverified by this track.
- Owned: `examples/react-review/`, `test/react-review.test.ts`, this document.
- Processes: none.
- Outstanding: scoped verification, coordinated commit, supervisor browser/React lifecycle verification.
