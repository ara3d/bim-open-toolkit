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

Resolution belongs to the host: this module does not fetch, store credentials, access browser globals on import, or own mesh buffers. Resolvers run concurrently; diagnostics follow saved model order. Missing models and resolver failures produce `missing-model`; changed revisions produce `revision-mismatch`; unmatched object references produce deduplicated `unresolved-object` diagnostics. Added edit objects count as available only when their layer is enabled. A selection referencing an object added solely by a disabled layer remains unresolved. Restore preserves unresolved saved references for host repair instead of dropping them. It returns success with diagnostics for partial restoration; malformed data and cancellation return failure. Cancellation returns promptly even for a resolver that ignores the signal; the host remains responsible for stopping its own work and releasing its resources.

Source strings are host-defined identifiers and must not contain credentials. The separate [storage adapter](storage.md) provides explicit validated save/load/list/delete actions with injected storage. The [React review example](react-review.md) uses it to save selections against the loaded source revision. Neither example establishes complete scene restoration.

Schema V1 contains model references, named sets, view selections/style rules, camera position/target/up/projection/zoom and edit layers. `restoreSceneDocument` validates and resolves data; the host must apply views and compose edits. It does not reopen a complete running application. Source geometry, source metadata and coordinates are supplied by the resolver. Camera field of view, clipping distances and orthographic extents are absent. Clipping planes, annotations, environment/lights, animation, layouts, comparison synchronization and application UI state are also absent. Annotations use their own versioned document. No generalized migration engine, resolver retry policy or geometry serialization is included.

## Track checkpoint

- Contract: V1 acknowledged; shared checkout inspected clean before creating owned files.
- State: verified, including numeric-domain, large-reference and disabled-addition follow-ups; full-scene persistence remains incomplete as described above.
- Owned files: `src/persistence.ts`, `test/persistence.test.ts`, `docs/persistence.md`.
- Checks: latest focused `../../node_modules/.bin/vitest.cmd run test/persistence.test.ts --maxWorkers=1 --cache=false`: 27 passed, including a 150,000-member set, selection and rule, plus enabled/disabled added-object resolution. Earlier standalone strict `tsc --noEmit` passed. A later stable broad gate passed 144 tests across 25 files, excluding the separately owned real-scene integration file. No tests were repeated for this documentation update.
- Processes: none.
- Source commits: `863f5cd` (initial persistence), `cfba29e` (numeric domains/large references), `c6c2cba` (disabled additions).
- Outstanding: supervisor integration.
- Blockers: none.
