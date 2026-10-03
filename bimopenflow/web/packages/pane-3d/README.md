# @bimopenflow/pane-3d

The editor's 3D pane over the BIM Open viewer (`deps/bim-open-viewer`), kept
out of `@bimopenflow/panes` so the generic editor packages never depend on
the viewer. `view3dPane` is its registration for an editor that takes panes
(`PaneRegistration` in `@bimopenflow/client`): it is offered for `view3d.*`
nodes and nodes with an `instances` or `boxes` table, loads the node's model
once per pane, feeds the live view recipe (`buildLiveViewRecipe`) or the
node's complete table, and keeps its pane across recipe branches of one
model. The toolkit's pages (`packages/studio-web`) register it with
`bootEditor({ panes: [...genericPanes, view3dPane] })`.

## ViewPane3D — `createViewPane3D(options?)`

A `@bim-open-viewer/core` Viewer with `OrbitControls` and `PickControls` on a
canvas. Scene/color/mapping logic is pure and viewer-free
(`src/instanceTable.ts`); `src/viewerDeps.ts` is the thin real wiring, and
`options.deps` swaps it for a fake in headless tests. Without a WebGL context
(e.g. jsdom) the renderer is never attached but the pane still mounts.

- Accepts:
  - `model`: loads via `ctx.resolveAsset(url)`; format inferred from the URL
    (`.bos` → BOS, else GLB) unless `format` is given.
  - `instances`: an instance table per
    `src/BimOpenFlow.Nodes.Geometry/README.md` — keyed by `entityId` (else
    `instanceIndex`); rows present define the visible set (absent instances
    are hidden via alpha 0), and `r`/`g`/`b`/`a` columns (0..1 floats), when
    all four are present, recolor. Arriving before the model finishes
    loading, it is held and applied afterwards. When the rig has no recipe
    legend, the legend strip lists the table's distinct `verdict` (else
    `category`) values with their colours and counts, capped at 12 with an
    "and N more" row (`src/instanceLegend.ts`).
- Emits:
  - `selection` with `source: "view3d"` and `ids: [entityId]` on pick, using
    the BOS loader's `groupEntities` mapping. GLB models carry no mapping,
    so picks emit nothing.
  - `action` `modelLoaded` / `loadError` with `{ url }` payloads.
- Property panel: a pick also calls `ctx.requestEntityProperties(modelUrl,
  localId)` — when the context supplies it — and renders the entity's name,
  category, GlobalId, and one section per property set in a scrollable panel
  under the status line (`src/entityProperties.ts`). A failed fetch shows one
  line there and leaves the view alone; a later pick supersedes an in-flight
  request, and loading a model clears the panel.

## Development

`@bim-open-viewer/*` are aliased to their `src/index.ts` in `tsconfig.json`
(through `../../viewer.tsconfig.json`) and `vitest.config.ts`
(`viewerAlias`). Tests use `@bimopenflow/panes/testing`.

```sh
npx tsc -p . --noEmit   # typecheck
npx vitest run          # tests (jsdom)
```
