# Persistence

`serializeSceneDocument(document)` writes schema-v1 JSON. `parseSceneDocument(json)` and `validateSceneDocument(unknown)` return a `Result<SceneDocument>` with detached plain data. Invalid versions, missing fields, unknown fields, runtime objects, malformed tuples, nonfinite numbers and duplicate top-level IDs are rejected. Color channels and opacity must lie in [0, 1]; camera zoom must be positive. Serialization throws on invalid data so callers cannot accidentally replace a valid save with a malformed save.

```ts
const parsed = parseSceneDocument(savedJson);
if (parsed.ok) {
  const restored = await restoreSceneDocument(parsed.value, async (reference, signal) => {
    return hostModels.load(reference, signal);
  }, { signal: controller.signal });
  // Inspect restored.diagnostics before presenting the restored scene.
}
```

Resolution belongs to the host: this module does not fetch, store credentials, access browser globals on import, or own mesh buffers. Resolvers run concurrently; diagnostics follow saved model order. Missing models and resolver failures produce `missing-model`; changed revisions produce `revision-mismatch`; unmatched object references produce deduplicated `unresolved-object` diagnostics. Added edit objects count as available. Restore preserves unresolved saved references for host repair instead of dropping them. It returns success with diagnostics for partial restoration; malformed data and cancellation return failure. Cancellation returns promptly even for a resolver that ignores the signal; the host remains responsible for stopping its own work and releasing its resources.

Source strings are host-defined identifiers and must not contain credentials. No generalized migration engine, storage adapter, resolver retry policy, or geometry serialization is included.

## Track checkpoint

- Contract: V1 acknowledged; shared checkout inspected clean before creating owned files.
- State: verified, including numeric-domain and large-reference follow-up.
- Owned files: `src/persistence.ts`, `test/persistence.test.ts`, `docs/persistence.md`.
- Checks: `../../node_modules/.bin/vitest.cmd run test/persistence.test.ts --maxWorkers=1 --cache=false`: 25 passed (948 ms), including a 150,000-member set, selection and rule; standalone `tsc --noEmit` against `src/persistence.ts` with the package strict compiler flags passed. No build output or shared cache written.
- Processes: none.
- Commit: `863f5cd` (`feat(scene): add validated scene persistence`); index clear after commit. This checkpoint update remains for the supervisor integration commit.
- Outstanding: supervisor integration.
- Blockers: none.
