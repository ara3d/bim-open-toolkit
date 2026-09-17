# Ara 3D Viewer

A general-purpose WebGL viewer for the web, built on [three.js](https://threejs.org/).
Successor to `@ara3d/ara3d-webgl`. BIM-free: it knows nothing about IFC, BOS, or
any other file format.

This is an npm workspace with seventeen packages, split so they can be developed
independently.

## Foundation

| Package | Role |
|---|---|
| [`@bim-open-toolkit/model`](packages/model/) | Pure data contracts and operations: identity, coordinates, sets, style rules, edits, view state, document slices, schema combinators, `Result`, facts, `Table`, mesh POD, and the `Feature` / `Command` / `StateSlice` / `Event` contracts. No runtime dependencies at all — no three.js, no renderer, no browser API, no other package here — so it runs unchanged in a test, in Node, in a browser, and in an MCP server. |

## Renderer

| Package | Role |
|---|---|
| [`@ara3d/viewer-core`](packages/core/) | Renderer: scene management, instanced drawing, materials, per-instance color, frame loop |
| `@ara3d/viewer-loaders` | Ingestion: GLB and BOS loading into viewer-core scene structures, with incremental progress reporting |
| `@ara3d/viewer-controls` | Interaction: orbit camera navigation, picking and selection with typed events, section planes. Owns no scene content. |

## Composition

| Package | Role |
|---|---|
| `@bim-open-toolkit/render` | The instance table bound to viewer-core groups, representation registry, picking, clipping, environment, overlay primitives, capture and frame timing |
| `@bim-open-toolkit/interact` | Camera state math, orbit / first-person / overhead navigation, configurable bindings, touch, and interruptible camera animation |
| `@bim-open-toolkit/formats` | BOS, BFAST, GLB, GLTF, OBJ and STL adapters producing one normalized `LoadedModel` with a columnar representation table — reporting their failures instead of raising them |
| `@bim-open-toolkit/features` | One Feature module per capability — appearance, clipping, annotations, animation, comparison, edits, environment, HUD, layouts, capture — each owning its commands, state slice, schema and optional render hook |
| `@bim-open-toolkit/workflows` | Pure result adapters and recipes for the review workflows: input tables in; typed results, rules, sets, overlays and views out |
| [`@bim-open-toolkit/viewer`](packages/viewer/) | The default composition: `createViewer`, the command bus, feature host, slice persistence and multi-view |

## User interface

| Package | Role |
|---|---|
| `@bim-open-toolkit/ui-react` | React bindings — `useViewer`, `useSelection`, `useSlice` — and the review application |
| `@bim-open-toolkit/ui-gratify` | The Gratify layer: in-canvas panels, the sidebar property inspector, widget kit, theme bridge and semantics mirror |
| [`@bim-open-toolkit/visualization`](packages/visualization/) | Composable model identity, review state, appearance/edit layers, persistence and renderer bindings |

## Fixtures, testing and hosts

| Package | Role |
|---|---|
| `@bim-open-toolkit/synthetic` | Seeded generators for buildings, networks, schedules, revisions, facts with gaps, stress scenes and mesh primitives |
| `@bim-open-toolkit/testing` | Fixture builders, fake clocks, headless scene helpers, the browser runner and the benchmark protocol |
| `@bim-open-toolkit/demos` | Gallery host, feature demos, workflow demos, fixture server and browser specs |
| `@bim-open-toolkit/mcp` | Node bridge exposing viewer commands as MCP tools over a WebSocket to a browser session |

## Using it

The facade is three lines:

```ts
import { createViewer } from '@bim-open-toolkit/viewer';

const viewer = createViewer(canvas);
await viewer.open('/models/building.bfast');
viewer.run('view.fit', {});
```

That is a renderer on the canvas, a model loaded and drawn, navigation on the pointer,
click to select, a frame loop that draws only when something changed, a resize observer,
and one `dispose()` that leaves nothing behind. Changing appearance goes through the same
door — a command — rather than a second API:

```ts
import { styleRule } from '@bim-open-toolkit/model';

viewer.apply(styleRule('unrated', 'Unrated doors', unratedDoorKeys, { color: [1, 0, 0] }));
```

Design requirements carried over from the previous viewer's lessons:

- `three` is a **peer dependency** of every package — the host application picks
  the version, and only one copy of three ever loads.
- All numeric parameters are floats (plain `number`); no integer-quantized APIs.
- Per-instance color is a first-class API, changeable after creation.
- Scene structures support incremental population, so loaders can stream
  geometry in and report progress.

This workspace is a candidate to move to its own repository once stable.

The visualization alpha includes 23 independent feature demos, primarily using the local
Snowdon fixture. After installing and running `npm run build`, use `npm run demo`.
`npm run demo:snowdon`, `npm run demo:normalized` and `npm run demo:browser` check the
served fixture, normalized geometry and browser behavior. See the
[package README](packages/visualization/README.md) for setup, evidence and remaining scope.

## Developing

```
cd viewer
npm install
npm run -w @ara3d/viewer-core build
npm test -w @ara3d/viewer-core
```

Unit tests run under Node with vitest and never require a WebGL context: the
three.js object-graph logic is kept separate from the `WebGLRenderer` so it is
testable headless.
