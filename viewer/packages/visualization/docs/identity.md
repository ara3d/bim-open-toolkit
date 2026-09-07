# Identity and selection

`ModelRegistry` indexes loaded revisions by model ID and objects by the full model/object pair. `findBySource(modelId, sourceId)` returns every matching object reference; `getSource(ref)` returns the reverse source ID. Geometry is unnecessary. Registration copies and freezes records, rejects duplicate model/object IDs and mismatched model ownership atomically, and leaves caller data untouched. Remove a model before loading a replacement revision. Lookup is constant-time apart from returned result size; registration is linear in objects. `remove` drops all indexes for a model. `dispose` releases all models and prohibits further registration.

```ts
const registry = new ModelRegistry();
registry.add(model);
const selection = new SelectionStore(registry.findBySource(model.ref.id, 'source-id'));
const unsubscribe = selection.subscribe(refs => hostHighlight(refs));
selection.toggle([{ modelId: model.ref.id, objectId: '42' }]);
const savedSet = createNamedSet('review', 'Review', selection.snapshot());
unsubscribe();
selection.dispose();
registry.dispose();
```

`uniqueRefs`, `unionRefs`, `intersectRefs`, and `subtractRefs` return frozen, deduplicated snapshots using structural reference equality, preserving first occurrence order. `createNamedSet` adds an ID and name. Set operations are linear in input sizes. They retain unresolved references so persistence and model loading can remain independent.

`SelectionStore` supports `snapshot`, `replace`, `add`, `remove`, `toggle`, `subscribe`, and `dispose`. Mutation methods return whether membership changed. Duplicate toggle inputs toggle only once. Reordering alone does not change selection or emit. Each actual change sends one immutable snapshot synchronously to each subscriber. Listener exceptions propagate; listeners should not throw. Disposal silently clears state and subscriptions and prevents subsequent updates/subscriptions. Registry removals do not implicitly change independent selections; the host chooses a reconciliation policy.

## Track checkpoint

- State: verified; contract V1 acknowledged.
- Owned files: `src/identity.ts`, `src/selection.ts`, `test/identity.test.ts`, `test/selection.test.ts`, this document.
- Checks: `../../node_modules/.bin/vitest.cmd run test/identity.test.ts test/selection.test.ts --maxWorkers=1 --cache=false` passed, 2 files / 6 tests, September 7, 2026.
- Covered: model-scoped identity and source lookups, atomic rejection, immutable ownership, removal/disposal, set algebra, collision-safe keys, event counts and duplicate toggle handling.
- Processes: none running. No installs, builds, shared cache writes, or generated output.
- Outstanding: supervisor export wiring and integrated TypeScript build; commit turn requested. Commit hash will be reported to the supervisor after commit (a commit cannot embed its own hash).
- Deferred: named-set CRUD/history and automatic stale-ref reconciliation; plain immutable named sets compose with host state today.
