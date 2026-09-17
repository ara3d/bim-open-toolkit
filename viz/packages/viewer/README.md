# @bim-open-toolkit/viewer

Three lines.

```ts
import { createViewer } from '@bim-open-toolkit/viewer';

const viewer = createViewer(canvas);
await viewer.open('/models/building.bfast');
viewer.run('view.fit', {});
```

That is a renderer on the canvas, a model loaded and drawn, navigation on the pointer, click to
select, a frame loop that draws only when something changed, a resize observer, and one `dispose()`
that leaves nothing behind.

Colouring objects is the same door — a command:

```ts
import { styleRule } from '@bim-open-toolkit/model';

viewer.apply(styleRule('unrated', 'Unrated doors', unratedDoorKeys, { color: [1, 0, 0] }));
```

and saving what you are looking at is one more:

```ts
const scene = viewer.save();          // Result<SceneDocument>: every installed slice, versioned
viewer.load(document);                // refused if it was saved against a different model
```

## What it composes

| Part | What it is |
|---|---|
| `createSession` | M1's `Session` — read a slice, write a slice, dispatch a command, subscribe — over a slice store with change events |
| `commandBus` | M1's immutable `CommandRegistry`, rebuilt as features add and remove commands |
| `featureHost` | Install in dependency order, all or nothing, and disposal that undoes exactly what installing did |
| `saveScene` / `loadScene` | The scene document: the composition of the installed slices, each migrated on its own, with a fingerprint of the models |
| `src/adapters` | The render package's six interfaces over `@ara3d/viewer-core` and three. The only place here that imports three |
| `createView` | One canvas: a camera, the interact DOM adapter, the frame loop, the size, disposal |
| `viewSet` | Several canvases over one session, sharing one set of instanced groups, with independent or linked cameras |

Three features come with it, because line three needs a command to run and a saved scene needs
something to restore: `viewer.models` (what is open), `viewer.view` (where each view looks, the
navigation mode, whether the views are linked) and `viewer.appearance` (colour rules, selection,
filter). They are ordinary features with no privileged access, so a host that wants richer ones
passes its own list:

```ts
const viewer = createViewer({ canvas, features: [...defaultFeatures(), myFeature] });
```

## Adding a capability

A feature is one module: an id, a state slice, its commands, and an optional install hook. Nothing
central changes when you add one — persistence, the command list and the MCP descriptors all follow
from the slice and the schemas.

```ts
const feature = feature('notes', notesSlice, [addNoteCommand]);
viewer.features.install([feature]);   // its slice is now in every saved scene
```

A command that needs the renderer or the camera — not plain data, so not a slice — asks for the
viewer's live access:

```ts
import { viewerAccess } from '@bim-open-toolkit/viewer';

const reach = viewerAccess.get(session);   // undefined in a headless session, which is the honest answer
reach?.views.setCamera('main', savedView.view, 600);
```

## Two things worth knowing

**A read validates.** `session.read(slice)` checks the stored value against the slice's own schema,
because it may have come from a document written by an older version. That costs a schema walk per
read, so a feature reading a large slice every frame should keep the value it was given and
subscribe to changes instead.

**A commit is the outermost dispatch.** A command that dispatches another publishes one change
event naming every slice that changed across the whole run. Subscribers never see a half-applied
command, and the renderer redraws once.

## What is not here

- **Any user interface.** No panels, no toolbar, no HUD. `viewer.hud()` returns the data one would
  read; drawing it belongs to `ui-gratify` and `ui-react`.
- **Any capability beyond the three above.** Clipping, sections, edit layers, overlays, annotations,
  comparison and animation are features in `@bim-open-toolkit/features`.
- **Its own renderer.** `ViewRenderer` is five methods and six adapters; the default is viewer-core
  and three, and another one is another file of that shape.
- **A file dialogue, a server, or a fetch policy.** `open` takes whatever
  `@bim-open-toolkit/formats` reads, and a document that names a file it does not contain reaches a
  resolver the host supplies.
- **Undo.** `History<S>` is in the model package and belongs to the feature that owns the state.

## Checks

From `viewer/`:

```
npx tsc --noEmit -p packages/viewer/tsconfig.json
npx eslint packages/viewer
npx eslint --config eslint.typed.config.js packages/viewer
npm test -w @bim-open-toolkit/viewer
```

The suite is 95 tests. Ninety-four run in Node against a renderer that counts what it was asked to
do; one opens a real browser through `@bim-open-toolkit/testing`, runs the three lines on a real
canvas and asserts a drawn frame and an empty console. It skips, printing the reason, where no
chromium channel can be launched.

## Zero escape hatches

No `any`, no `as` cast other than `as const`, no non-null assertion, no compiler or lint directive
in `src` or `test`. `docs/viewer.md` records what that cost and what it caught.
