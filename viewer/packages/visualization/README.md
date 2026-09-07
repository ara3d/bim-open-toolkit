# BIM Open Toolkit Visualization

`@bim-open-toolkit/visualization` is an alpha, composable review layer over the existing Ara viewer. Its data API has no DOM, Three, Gratify or React imports. The opt-in `/render` adapter connects object identities and effective state to instanced geometry. This increment is not the complete product brief or a V1 release.

## Run

From `viewer/`:

```sh
npm install
npm run build
npm test
npm run demo:check
npm run demo:build
npm run demo
```

Open `http://127.0.0.1:5173`. The demo uses local modules with no CDN or external model. Two generated models deliberately reuse local IDs. Select a table row or a visible object, color/hide/move a selection, undo/redo, enable a numeric heat map, save and reload. Ctrl/Cmd-click toggles table or canvas selection. Search is a host concern; the table shows at most 100 matching records. Reset restores the 100-object fixture. The stress button creates 10,000 boxes (120,000 displayed triangles).

The UI uses accessible HTML buttons to demonstrate framework independence. It is not the planned Gratify shell, React application, or a validated mobile implementation. Orbit controls are reused; touch gestures and pointer-cancellation recovery remain upstream work.

## Data first

```ts
import {
  SelectionStore, composeEdits, composeAppearance,
  createEditHistory, commitEditHistory, undoEditHistory,
} from '@bim-open-toolkit/visualization';

const selection = new SelectionStore();
const unsubscribe = selection.subscribe(refs => hostTable.select(refs));
selection.replace([{ modelId: 'building@r1', objectId: 'door-12' }]);

const history = commitEditHistory(createEditHistory(), [{
  id: 'review-change', enabled: true,
  operations: [{ kind: 'style', ref: selection.snapshot()[0], style: { opacity: 0.25 } }],
}]);
const edits = composeEdits(baseObjects, history.present);
const effective = composeAppearance(edits.objects, {
  selection: selection.snapshot(), selectionColor: [0, 1, 0.6],
});
// hostRender.applySnapshot(effective)
// undoEditHistory(history) returns the previous complete layer transaction.
unsubscribe();
selection.dispose();
```

`baseObjects`, `hostTable` and `hostRender` above are supplied by the host. Pure functions return data; stores own mutable subscriptions/indexes. `ModelRegistry` copies and freezes input records, permits geometry-free objects, and indexes source IDs in both directions. A model ID must denote one loaded revision. `objectKey` encodes `[modelId, objectId]` without delimiter collisions. Reusing source IDs across models is safe. Do not replace identity with array positions.

See [identity and selection](docs/identity.md), [appearance and edits](docs/appearance.md), and [saved documents](docs/persistence.md) for independent API examples. Type declarations and declaration maps are generated into `dist/` by the build.

## Rendering boundary

```ts
import { RenderBinding } from '@bim-open-toolkit/visualization/render';

const render = new RenderBinding(viewer.scene, () => viewer.requestRender());
const result = render.addModel('building@r1', [{
  ref: { modelId: 'building@r1', objectId: 'door-12' },
  representationId: 'body', group, instanceIndex: 0,
}]);
if (!result.ok) showDiagnostics(result.diagnostics);
render.update(changedObjects);         // patch only these objects
render.applySnapshot(effectiveScene); // absent bound objects become invisible
const hit = render.pick(viewer.objects, viewer.camera, ndcX, ndcY);
render.removeModel('building@r1');
render.dispose();
```

The host supplies the existing `Viewer`, `InstancedGroup` and normalized device coordinates. Every instance in an added group must be bound; one group belongs to one model. Groups already in the scene are rejected atomically. Borrowed groups must remain stable in membership/count while bound. To change membership, remove the model and rebind. The host owns geometry buffers and must not mutate shared mesh data.

Object transforms are absolute column-major matrices in the common render coordinate system. Every representation of an object receives that object's matrix; representations requiring different local offsets must have those offsets normalized into their mesh coordinates before binding. Units/up/registration metadata is explicit data, **not automatic coordinate conversion**. The adapter does not normalize source loader output for you.

Appearance channels and opacity are finite `[0,1]` values, colors are linear RGB. Updates validate the batch before writing, update all representations of a reference, and request one frame. Unknown/geometry-free references produce `unbound-object` diagnostics. The returned count is updated render instances. Completion means **CPU submission**, not a displayed or GPU-completed frame. Existing core buffers still perform full attribute uploads when marked dirty; changed-range uploads remain deferred.

Hidden records use alpha zero. Effective edits/rules cannot resurrect tombstones, and selection cannot resurrect a hidden object. Picking checks visibility, alpha and material clipping, retains ghosted objects, and returns model/object/representation identity plus a world-space point. Apply clipping only when the viewer's local clipping is enabled; the adapter assumes material planes are active. Root transforms and foreign scene mutations are outside this adapter's ownership.

Removing a model schedules a scene synchronization. The existing `SceneObject` disposes removed GPU mirrors on the next render/sync. Dispose the owning Viewer when its canvas is removed; it releases the renderer and remaining mirrors. Dispose input controls, resize observers and selection subscriptions as demonstrated in [main.ts](examples/main.ts). Multiple views require separate borrowed groups or a future shared-resource adapter; this wave does not claim multi-view support.

## Saved state and resolution

```ts
import { serializeSceneDocument, parseSceneDocument, restoreSceneDocument } from '@bim-open-toolkit/visualization';

const text = serializeSceneDocument(sceneDocument);
const parsed = parseSceneDocument(text);
if (parsed.ok) {
  const result = await restoreSceneDocument(parsed.value, resolveModel, { signal });
  // Inspect diagnostics before applying state. ResolveModel owns resources and cleanup.
}
```

Schema v1 stores model references, selection/named sets, perspective/orthographic camera data, appearance rules and edit layers. It does not store meshes, properties, credentials, clipping, lighting, overlays or annotations. Strict validation rejects malformed documents, unknown fields and unsupported versions. Missing models/revisions/object references remain explicit diagnostics. Resolver cancellation can end the wait promptly; a resolver that ignores its signal remains responsible for releasing late resources. The demo's localStorage adapter restores only its deterministic fixture revisions.

## Current scope

| Feature | Implemented increment | Remaining |
|---|---|---|
| F01 | Scoped identity, source lookup, geometry-free records, model removal | Source normalization, snapshot correspondence, independent model transforms |
| F03/F06 | Batch bindings, hidden/clipped picking, representation identity | GPU completion, replacement geometry, context recovery, accelerated picking |
| F07/F08 | Sets/events, linked table, color maps/missing legends, visibility precedence | Query sets, outlines, richer styles and host adapters |
| F15/F17 | Pure layers, tombstones, transaction undo/redo, validated schema/resolution | Rendered additions/replacements, history bounds, full scene state/storage adapters |
| F04/F10/F27 | Reused perspective orbit/basic lighting; runnable demo, docs/tests | Other camera modes, generated reference site, feature demo gallery |
| F02 | Existing workspace BOS and GLB loaders retained | Public normalized loading composition, cancellation, geometry-first properties, GLTF/OBJ/STL coverage |

F05, F09, F11–F14, F16, F18–F26 remain follow-up work (mobile, UI, navigation aids, slicing product API, layouts, multi-view, geometry editing, overlays/markup, screenshots, animation, maps, MCP, advanced lighting, voxels and BuildingModel recipes). Existing low-level sectioning does not establish full F12. Gratify remains a pinned independent submodule with no changes; its release/distribution choice is unresolved.

## Verification and extension

See [plan](docs/PLAN.md) for contracts/ownership and [findings](docs/FINDINGS.md) for actual gates and limits. Tests are headless unless explicitly recorded as browser checks. The demo's CPU benchmark uses five warmups and twenty samples with nearest-rank p50/p95; it is not a 10-million-triangle, Snowdon, FPS or end-to-end display benchmark.

Keep new formats behind normalizers, UI behind public operations, and host storage/network permissions outside the core. Add serializable state deliberately with a schema version policy. Prefer extending this layer over copying demo state into another UI framework. Three remains a peer dependency; MIT notices are preserved in the package license. No private Snowdon fixture is redistributed.
