# Checkpoint V — viewer composition

Track V, fence `viewer/packages/viewer/**` (not `package.json`, `tsconfig*.json`, `vitest*.ts`).
Contract revision: M1 with the M1.1 and M1.2 additions.

## State

**Headless session landed.** FA, FB and FC can switch from `features/test/support/fake-session.ts`
to `createSession` from `@bim-open-toolkit/viewer`. It satisfies M1's `Session` exactly and adds a
slice registry, a command bus, diagnostics and disposal.

| Chunk | State | Files |
|---|---|---|
| 1 session, bus, host | verified | `src/{session,command-bus,features,services,index}.ts`, `test/{session,command-bus,features}.test.ts`, `test/support/fixtures.ts` |
| 2 scene document | not started | `src/document.ts` |
| 3 adapters, view, createViewer, multi-view | not started | `src/adapters/**`, `src/{view,create-viewer,multi-view}.ts` |
| 4 browser smoke | not started | |
| 5 README, `docs/viewer.md` | not started | |

## What chunk 1 delivers

- `createSession(options)` → `Result<ViewerSession>`: M1 `Session` (`read`, `write`, `dispatch`,
  `subscribe`) plus `commands`, `sliceRegistry`, `register`, `forget`, `stored`, `diagnostics`,
  `disposed`, `dispose`.
- `commandBus(commands)` → `Result<CommandBus>`: M1's immutable `CommandRegistry` rebuilt as
  features add and remove commands; `run`, `describe`, `describeOne` over it.
- `featureHost(session)`: install in `installOrder`, dependencies satisfied across separate installs,
  all-or-nothing rollback when an install hook throws, `remove` refusing a feature something depends
  on, `dispose` in reverse order.
- `service<T>(id)`: a live capability (renderer, view) a session carries beside its slices, stored
  in the key object's own `WeakMap`, so `get` is typed with no cast and no runtime check.

Decisions a caller can rely on:

- **A read validates** against the slice's own schema, because a stored value may have come from a
  document. A value that does not check reads as the default and records a diagnostic. Cost: one
  schema walk per read; a feature reading a large slice per frame should hold the value and
  subscribe instead.
- **A commit is the outermost dispatch.** A command that dispatches another publishes one event,
  naming every slice that changed across the whole run. Subscribers never see a half-applied
  command.
- **A write outside a command publishes at once**, under the command name `viewer/write`
  (exported as `directWrite`).
- **Reading and writing never register a slice.** A document is the composition of registered
  slices, so a stray write is held but never saved.
- **Disposal keeps the values.** A disposed session refuses commands and drops its listeners, but
  can still be saved.

## Commands and results (from `viewer/`)

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/viewer/tsconfig.json` | clean |
| `npx eslint packages/viewer` | clean |
| `npx eslint --config eslint.typed.config.js packages/viewer` | clean |
| `npm test -w @bim-open-toolkit/viewer` | 4 files, 37 tests passed, 420 ms |

## Requests

- **To the supervisor (manifest).** Chunk 3 needs `three` and `@ara3d/viewer-core` declared as
  dependencies of `@bim-open-toolkit/viewer`, and `@bim-open-toolkit/testing` as a dev dependency.
  Both resolve from the workspace today, so work continues.
- **To the model package (additive).** A feature cannot reach a renderer or a camera through
  `Session`, and `features` cannot import `viewer` (the dependency runs the other way). Proposal: a
  service vocabulary in `model` — a `Service<T>` key type and an optional `services` lookup on
  `Session` — so a feature can ask for a capability by a key both packages can name. Until then the
  viewer holds the keys and installs the features that need them.

## Findings

- `installFeatures` in the model package does not guard an install hook that throws, so the host
  runs the hooks itself in order to roll back. Not a defect in M1; noted so nobody re-implements it.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction | Verdict |
|---|---:|---:|---|---|---|
| `tsc --noEmit` | 3 | 6 to 9 s | 3 (`readonly string[]` has no `sort`, a `Disposable` shape mismatch) | none | keep |
| `eslint` untyped | 1 | 3 s | 0 | none | keep, cheap |
| `eslint` typed | 1 | 12 s | 0 so far (no I/O yet) | none | keep for chunk 3 |
| `npm test` | 4 | 0.4 to 0.8 s | 3 (all three were wrong expectations of my own, which is the point) | none | keep |
