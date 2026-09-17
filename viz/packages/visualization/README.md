# BIM Open Toolkit Visualization

`@bim-open-toolkit/visualization` provides composable review state and optional adapters over the Ara viewer. Its root data API has no DOM, Three, Gratify or React imports. Rendering, loading and UI live in explicit subpaths. This is an incremental alpha; [the plan](docs/PLAN.md) distinguishes implemented subsets from the full product brief.

## Run the feature gallery

From `viewer/`:

```sh
npm install
npm run build
npm test
npm run demo:check
npm run demo:build
npm run demo
# In a second terminal, with the server running:
npm run demo:snowdon
npm run demo:normalized
npm run demo:browser
```

Open http://127.0.0.1:5173. Each gallery card opens one feature in one viewer, using Snowdon by default. A 24-box deterministic fixture supplements testing. Each page includes reset controls and source/test links. The former combined sample is retained at `/review.html`.

The local dev server reads `%USERPROFILE%/Documents/BIM Open Schema/Snowdon Towers Sample Architectural.bos`, or `SNOWDON_BOS_PATH`. It serves only explicit fixture endpoints. The model and prepared workflow projection are not copied into the package or production build. Production hosts must supply their own authorized model resolver/endpoints. `demo:snowdon` rejects HTML fallbacks, validates the archive signature, matches the original bytes/hash and metadata, and decodes geometry.

Development builds the pinned Gratify submodule before the workspace packages. `/gratify` is optional for consumers; its compatible published dependency must be supplied separately. No Gratify source modifications are required. The pinned Gratify package is browser-bundler qualified; native Node imports currently fail on its upstream directory exports.

The browser smoke command uses an isolated installed Edge process with software WebGL and saves ignored screenshots/results. It tests functionality, not hardware frame-rate performance. Override the browser channel with `BROWSER_CHANNEL` or choose one scenario with `BIM_BROWSER_CASE`.

## Use the data API

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
const edited = composeEdits(baseObjects, history.present);
const effective = composeAppearance(edited.objects, {
  selection: selection.snapshot(), selectionColor: [0, 1, 0.6],
});
hostRender.applySnapshot(effective);
// undoEditHistory(history) returns the previous complete transaction.
unsubscribe();
selection.dispose();
```

Hosts supply `hostTable`, `baseObjects` and `hostRender`. Model IDs identify revisions; `objectKey` encodes the model/object pair without collisions. Geometry-free objects remain valid records. Unknown units, registration and BuildingModel facts stay explicit. Pure functions return data; mutable stores expose subscriptions and disposal.

## Optional rendering and loading

```ts
import { RenderBinding } from '@bim-open-toolkit/visualization/render';
import { loadBosModel } from '@bim-open-toolkit/visualization/loading';

const loaded = await loadBosModel(source, modelRef, { sourceUp: 'Z', signal, onProgress });
if (loaded.ok) {
  const binding = new RenderBinding(viewer.scene, () => viewer.requestRender());
  binding.addModel(loaded.value.model.ref.id, loaded.value.bindings);
  binding.update(changedObjects);          // patch
  binding.applySnapshot(effectiveScene);   // absent objects become invisible
  const hit = binding.pick(viewer.objects, viewer.renderCamera, ndcX, ndcY);
  // On unmount: binding.dispose(); viewer.dispose();
}
```

Every bound instance retains model/object/representation identity. An optional representation-local transform and color factor preserve source offsets/materials under logical object edits. Matrices are column-major and colors linear RGB. The BOS adapter performs explicit source-up conversion; arbitrary model metadata does not imply automatic coordinate normalization.

Large scenes use bounded BatchedMesh mirrors; the Snowdon fixture displays 456,598 instances and 6,185,680 triangles. Geometry membership stays stable while bound. Hosts own borrowed buffers. Appearance/transform patches do not rebuild geometry. Unknown/geometry-free references return diagnostics; hosts can distinguish expected unbound records from errors. Completion is CPU submission, never guaranteed display completion.

Picking checks visibility, alpha and clipping and supports separate replacement overlays. Removing bindings schedules mirror disposal on synchronization. Dispose viewers, controls, observers, overlays and subscriptions when removing a host. Two-view examples share immutable source geometry and use independent GPU mirrors.

## Feature modules

| Area | Modules and examples |
|---|---|
| Identity, selection, edits, styling | [identity](docs/identity.md), [appearance](docs/appearance.md), independent selection/appearance/edits demos |
| Loading and large rendering | [loading](docs/loading.md), [batching](docs/batching.md), [formats](docs/formats.md), [benchmarks](docs/performance.md) |
| Camera and spatial presentation | [camera](docs/camera.md), [clipping/layouts](docs/spatial-features.md), [comparison](docs/comparison.md), environment/navigation demos |
| Persistence and replacement | [saved documents](docs/persistence.md), [replacement](docs/replacement.md) |
| Notes, capture and animation | [annotations](docs/annotations.md), [animation](docs/animation.md) |
| UI and actual BIM workflows | [Gratify](docs/gratify.md), [door review](docs/door-review.md) |

SceneDocument schema1 stores model references, named sets, selection, cameras, rules and edit layers. It excludes geometry buffers, clipping, environment and annotation data. Notes use a separate validated schema. Replacement geometry currently uses a separate ephemeral transaction. These limits are deliberate and documented; no full saved-scene fidelity is claimed.

The BuildingModel door recipe validates the projection's source fingerprint before joining exact Snowdon identities. It preserves evidence and missing reasons. Nominal width is never presented as clear width or as a compliance decision.

## Verification and extension

[The plan](docs/PLAN.md) records current scope, ownership and required gates; [findings](docs/FINDINGS.md) records measured evidence. Unit tests are headless unless a browser check is explicitly identified. The performance mini demo measures 10,000 distinct represented objects with 5 warmups/20 samples and separates CPU submission from command-to-next-animation-frame timing. GPU/presentation timing is unavailable, so these observations do not establish a display-latency guarantee.

Keep UI behind typed host operations and storage/network authority in host adapters. Add serializable state with an explicit version policy. Extend these public modules rather than copying state logic into another framework. Three remains a peer; MIT notices remain in the package license.
