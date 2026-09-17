# Explicit saved scene storage

`SceneStorage` accepts an injected `StorageLike` with synchronous key/value and enumeration methods. Browser `localStorage` and simple in-memory implementations fit the interface. Importing the module does not access browser globals. Keys use a caller-owned namespace, schema-version suffix and encoded scene IDs; other namespaces/versions remain untouched.

`save(id, document)` validates and serializes through the public scene API. Existing entries are refused unless `{ overwrite: true }` is explicitly supplied. `load`, `list` and `remove` return typed Results; absent saves, corrupt documents/keys, quota failures and access errors produce diagnostics. A missing removal returns false. Corrupt data is never silently deleted or overwritten. The supplied backend is responsible for atomic individual writes; the existence check and write are not a cross-tab transaction. Hosts needing concurrent writers should serialize saves or provide transactional storage externally.

The `storageDemo` saves camera/selection with the loaded model reference, lists names, reloads with host resolution, and exposes explicit new-save, replace and delete actions. Failed/corrupt/quota operations remain visible in an alert. Viewer reset retains saved entries. Storage acquisition is guarded because browsers may deny access. There is no autosave, network service or storage migration engine. Source model geometry, credentials and runtime handles are never saved.

## Checkpoint

- Contracts: G1.1/V1 unchanged; both required skills applied.
- State: verified. Five focused tests passed (`test/storage.test.ts --maxWorkers=1 --cache=false`); isolated strict source/demo TypeScript check passed (`--noEmit`, ES2022/bundler, strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes). Initial demo typecheck caught a local DOM-name shadow, corrected before verification.
- Owned: `src/storage.ts`, `test/storage.test.ts`, `examples/features/storage.ts`, this document.
- Processes: none.
- Outstanding: focused verification, coordinated commit, supervisor browser check.
