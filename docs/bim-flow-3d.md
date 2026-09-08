# BIM Flow 3D integration

BIM Flow uses the V2 visualization packages through their public entry points.
The **Snowdon graph demo** at `/3d.html` opens an editable graph on the left and
its 3D result on the right. It uses the original editor, with Snowdon opened and
category colors selected automatically. The divider resizes the two panes.

Select a node or use **Preview** to see its result. Edit the fields inside nodes,
drag nodes to rearrange them, and drag between sockets to connect them. Edits
autosave and re-evaluate on the host. **Fit graph** frames the whole graph;
**Nodes** opens the catalog to add nodes. The flow picker switches graphs.
Clearing graph selection keeps the preview visible. Recipe branches reuse the
loaded model. These are edits to the stored flow, retained after reload.

The button-based examples and local-file picker remain at `/showcase.html`.
Both pages share the same pane, loader, renderer and recipe runner.

## Nodes and composition

Start with `view3d.scene`, then connect its `view` output to another recipe
node's `view` input. Branch freely to compare presentations. Every result is a
complete recipe, so selecting a node reproduces its upstream presentation.

| Node | Parameters | Useful example |
|---|---|---|
| `view3d.scene` | `path` | Snowdon model overview |
| `view3d.categoryStyle` | `opacity` 0–1 | Source categories with a legend; unknown categories are gray |
| `view3d.section` | axis x/y/z; fraction 0–1 | Horizontal floor cutaway or vertical inspection |
| `view3d.sectionBox` | fraction 0.01–1 | Centered interior region, expressed relative to model bounds |
| `view3d.explode` | strength 0–5 | Fan source categories apart |
| `view3d.projection` | perspective / orthographic / plan | Fixed overhead section inspection |
| `view3d.environment` | light / dark; grid | Ghosted review against a dark background |

The [Snowdon graph](../samples/snowdon-analyses/snowdon-toolkit.json) has nine nodes,
including composed category/cutaway/plan and ghost/environment branches.
The existing instance, color, isolation, offset and box-table nodes continue to
use their existing table conventions. Recipe tables use two text columns,
`operation` and JSON `input`, with one scene row followed by up to 63 steps.
They carry neither mesh bytes nor arbitrary executable commands. The browser
validates the complete recipe before applying it.

Fit, reset, reapply, retry and PNG capture are available in both hosts.
Reset restores source placement, per-placement colors, camera and environment.
The category legend counts source objects, including records without geometry.
Object picking preserves the selected graph node.

## Run locally

Install dependencies in both `viewer` and `bimopenflow/web`; build the existing
viewer-core, controls and loaders with `npm run build` in `viewer`.
BIM Flow's Vite and TypeScript configuration resolves the V2 packages to source,
so it does not depend on stale V2 `dist` files.

For the graph editor, start `src/BimOpenFlow.Host` with `--profile bim`.
On an empty store, Snowdon is seeded when either `BIMOPENFLOW_SNOWDON` points to
an existing BOS file, or the file exists at
`Documents/BIM Open Schema/Snowdon Towers Sample Architectural.bos`.
Its directory is also registered as a model catalog root. An existing store is
left intact: import the sample through `PUT /api/analyses/snowdon-toolkit`,
replacing `{SNOWDON}` with the actual model path, or use a separate empty store.

The standalone examples at `/showcase.html` use one prepared local BFAST file.
The graph demo loads through the BIM host's model catalog. From the repository root:

```powershell
New-Item -ItemType Directory -Force artifacts/bim-flow
node viewer/packages/loaders/scripts/bos-to-bfast.mjs "C:/path/Snowdon.bos" artifacts/bim-flow/snowdon.bfast
```

The converter preserves original BIM tables and refuses to overwrite an
existing file. Alternatively set `BOF_SNOWDON_BFAST` to an existing prepared file.
The lab also accepts a local BOS or BFAST file through its file picker.
The fixture endpoint is development-only; production hosting must supply a
model endpoint or use the file picker. Private model bytes are not committed.

From `bimopenflow/web`, run `npm run dev -w @bimopenflow/app`.
The default editor port is 5300 and the host proxy defaults to 5214.
Set `BOF_HOST` to change the backend. The build includes the editor, graph demo,
and standalone examples.

## Verification on 2026-09-08

- Graph demo follow-up: `node scripts/check-bim-flow-graph.mjs` checks automatic
  Snowdon selection, both panes fitting the viewport, inline parameter editing
  through autosave/evaluation to changed rendered pixels, one model load across
  recipe branches, persistent preview, catalog toggling, and graph fitting.
  Use an isolated BIM-profile host: the check edits the Snowdon flow and restores
  its original document in `finally`. Evidence is in `artifacts/bim-flow/graph-browser`.

- Geometry node suite: 84 passed, including ten recipe cases.
- Snowdon graph: all nine nodes evaluate successfully without reading private
  geometry during graph evaluation.
- Pane suite: 97 passed. Editor suite: 108 passed. Both TypeScript checks and the
  production build pass.
- `node scripts/check-bim-flow-3d.mjs` exercises actual Snowdon rendering, all six
  presentation examples, reset against original canvas pixels, source-ID
  picking, PNG capture, HTML fallback rejection, retry and responsive resize.
  It also checks the real editor's graph output, pane sizing and object picking.
  Set `BOF_DEMO_URL` to the running editor URL (default 5302); the host must have
  the seeded graph. Evidence and screenshots go to `artifacts/bim-flow/browser`.
- Prepared fixture: 111,630,208 bytes; SHA-256
  `313c247e01a9aeee10d373b8d8ddfb9c13fc5ebb709945e75defcd763f33465b`.
  The HTTP response is checked byte-for-byte against that local file.
  Source BOS: 9,362,255 bytes; SHA-256
  `fc31c4463d9eb958ae8de3d853cfc8224b9469477b419857fbc929956c9cc51d`.
- Headless Edge 152.0.4191.66, 1440×1000 lab viewport; 1680×1100 editor viewport.
  These are functional observations, not GPU performance or mobile qualification.

The integration exercises F01/F02 identity/loading, F03/F06 rendering/picking,
F04 cameras, F08 appearance, F10 environment, F12 clipping, F13 layouts and F20
capture from the [original visualization brief](plans/visualization/PRODUCT-BRIEF.md).
It does not close the toolkit's outstanding release acceptance gates.

## Limits and integration decisions

Source-hidden placements are excluded from the render binding so they cannot
inflate the fitted bounds or reappear after styling. Object records and identity
remain available. The adapter keeps a separate mesh-index column; source bytes,
geometry buffers and object records are unchanged. Source colors are restored
per placement because a single object can have several different materials.

Sections are uncapped; category layouts change presentation only. Fractions
refer to original visible model bounds. Ghosting uses the toolkit's approximate
transparency. The lab does not infer storeys, compliance or measurements from
geometry. Category colors are stable for the same category inventory.

Spatial tables load all pages (up to one million rows), checking continuity and
stopping when the active node changes. The ordinary table pane remains paged.
Recipe nodes avoid large instance-table transfers for common review actions.
Loading reports a visible status and error, with retry; synchronous conversion
and metadata parsing still cannot be interrupted mid-call.

The production viewer chunk is about 1 MB before gzip (about 322 KB gzip).
This integration adds no hardware-performance claim or remote deployment.
