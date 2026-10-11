# Research: which chart spec sits between tables and renderers?

> Investigation, 2026-10-11, by a research subagent of Claude Fable 5.1 for Christopher Diggins, with the `platonic:investigate` skill. Compares Vega-Lite, Vega, Mosaic/vgplot, a clean-room JSON spec for AEC (architecture, engineering, construction), and a hybrid, as the format that turns a result table into a chart, drawing, 3D overlay, or map in BIM Open Toolkit. The companion `docs/proposals/mosaic-for-notebook.md` covers Mosaic's DuckDB dependency in depth. Evidence labels: **docs** (official documentation), **source** (code read), **report** (third party), **inferred** (reasoned, with the basis); figures from package-index sites are approximate. Status: recommendation made, not decided; the fact that would change it is named under Recommendation. Suggested next step: a half-day spike in which Claude writes ten chart tasks from the sample notebooks both as Vega-Lite and in a draft of the proposed `chart2d` shape, scored for validity and correctness.

## Comparison table

Legend: yes / part (approximates) / no / build (we write it).

| Row | A Vega-Lite | B Vega | C Mosaic/vgplot | D Own spec | Hybrid |
|---|---|---|---|---|---|
| 2D statistical charts | yes | yes | yes (Plot marks, DuckDB aggregation) | build (bar, line, scatter, pie first) | yes via A or Plot |
| 3D bars, surfaces, charts in model space | no | no | no | build on three.js viewer | build |
| Maps, georeferenced model | part (geoshape, projections, no tiles) | part (same, plus custom projections) | part (`geo` mark, DuckDB spatial, no tiles) | build (deck.gl/MapLibre or own tile layer) | build |
| Plan, section, elevation cut from geometry, coloured by data | no (would take pre-cut polygons as data) | no (same) | no (same) | build (viewer's clipping and section code, a 2D projection mark) | build |
| Themes: brand fonts, colours, print, slides | yes (`config`, `font`, `range`, styles) | yes (`config`) | part (Plot style options; no theme object in spec) | build (one theme object shared by all renderers) | theme compiled into `config` for the 2D subset |
| Interactivity (hover, select, brush) | yes (`params`, point and interval selections, `bind`) | yes (signals, event streams) | yes (interactors: toggle, nearestX, intervalXY, panZoom, highlight) | build | 2D via A; cross-view via own selection bus |
| Linked selection to table and 3D view | part (read a signal with `addSignalListener`, push with `view.signal`) | part (same API, finer control) | yes (Selection and Param objects any client can join) | build, native | build, bridged |
| Transitions and animation | no (not in grammar) | part (signals plus a timer; hand-built) | no | build (Gratify channels, viewer `animation.ts`) | build |
| Authoring by a model | yes (strong: schema, many examples in training) | part (verbose, low-level) | part (small spec, few examples) | part (needs our schema in the prompt) | yes for 2D; part elsewhere |
| Hashable artifact for run records | yes (JSON) | yes | yes (JSON, but result depends on database state) | yes | yes |
| Export (SVG, PNG, PDF, headless) | yes (`toSVG`, `toCanvas`, `vg2png`, `vg2pdf`) | yes | part (Plot renders SVG; needs JSDOM in Node) | build (2D SVG exists; 3D PNG capture exists) | A's for 2D |
| Bundle (minified, gzipped) | ~263 KB / 85 KB plus Vega ~494 KB / 172 KB | ~494 KB / 172 KB | Plot plus Mosaic core plus DuckDB-WASM (tens of MB) | small (d3 modules a few tens of KB) | A's plus ours |
| Maturity | high (v6, schema stable since v4 era) | high (v6) | medium (research group, spec still evolving) | none | mixed |
| Extension cost | custom marks impossible in Vega-Lite; new mark means dropping to Vega | custom transforms, scales, schemes; marks fixed | custom marks as Plot marks plus Mosaic client | every mark × every renderer | own marks outside the 2D subset |

Sources for the table: Vega-Lite params and config (docs, https://vega.github.io/vega-lite/docs/parameter.html, https://vega.github.io/vega-lite/docs/config.html); Vega usage and View API (docs, https://vega.github.io/vega/usage/, https://vega.github.io/vega/docs/api/view/); vgplot (docs, https://idl.uw.edu/mosaic/vgplot/); Mosaic spec format (docs, https://idl.uw.edu/mosaic/api/spec/format.html); bundle sizes (report, DepScope via web search, vega-lite 6.4.3 and vega 6.2.0).

## Vega-Lite, Vega, Mosaic: the key points

**Vega-Lite (A).** A JSON spec with five top-level kinds (single view, layer, facet, concat, repeat), published schema at `https://vega.github.io/schema/vega-lite/v6.json` (docs, spec page). Interaction is a `params` array; a param with `select` becomes a point or interval selection and can drive conditional encodings, filters, scale domains, and bound widgets (docs, parameter page). Theming is the `config` object: top-level `font`, `background`, `range` for colour schemes, per-mark and per-axis defaults, named `style` blocks (docs, config page). Rendering is Vega's: SVG or canvas in the browser, `renderer: 'none'` plus `toSVG`/`toCanvas` in Node, and `vg2png`, `vg2svg`, `vg2pdf` from `vega-cli` (docs, usage page). There is no animation in the grammar, no 3D, no map tiles; `geoshape` draws GeoJSON through d3 projections. A new mark type cannot be added to Vega-Lite; extension means writing Vega. Selection state reaches outside code only through the compiled Vega view: `view.addSignalListener(name, handler)` to read, `view.signal(name, value)` then `runAsync()` to push (docs, View API). That is enough to link a chart to the 3D view, with the caveat that the signal names are Vega-Lite's generated ones (`<param>_store`), so the bridge depends on the compiler's naming (inferred from how Vega-Lite compiles selections; verify against a compiled spec).

**Vega (B).** The full grammar: `data`, `signals`, `scales`, `projections`, `axes`, `legends`, `marks`, `config` (docs, https://vega.github.io/vega/docs/). Signals with event streams give full control of interaction, and a `timer` event stream can drive hand-built animation, but nothing declares a transition. Extensible in transforms, scales, projections, and colour schemes, not in mark types (docs, same page). Specs are long; a model writes Vega-Lite far more reliably than Vega (inferred from spec size and example counts in the two galleries). Bundle: `vega.min.js` includes d3 and topojson; `vega-core` is smaller when d3 is already loaded (docs, usage page).

**Mosaic / vgplot (C).** vgplot "calls Observable Plot to render SVG output"; marks mirror Plot's (dot, bar, rect, cell, text, tick, rule, area, line) plus database-side ones (regressionY, hexbin, denseLine, density, contour, raster, heatmap, `geo` over DuckDB spatial); interactors are toggle, nearestX/Y, intervalX/Y/XY, panZoom, highlight (docs, vgplot page). The declarative format has `meta`, `config` (DuckDB extensions only), `data` (SQL or files), `params`, `plot`, `hconcat`/`vconcat`, `input`, `legend`; selections are `single`, `union`, `intersect`, `crossfilter`; the TypeScript types in `@uwdata/mosaic-spec` are the reference, with no separate JSON schema document on the page (docs, spec format page). Its strength for this project is that Selection and Param are first-class objects any client can join, which is exactly the chart-table-3D link; its weakness is that every mark is a live query, so a snapshot for a host-less notebook has to be captured separately, and the renderer is Plot, with no theme object in the spec. No animation. Another agent covers the DuckDB dependency.

## A spec of our own: design study

The owner's framing holds: a spec is the lever between tables and pixels. The question is how many pixel targets one lever can reach without becoming three specs stapled together.

**Minimal outline.** Standard grammar-of-graphics parts are marked (GoG); new parts are marked (new).

```
{
  "version": 1,
  "data":    { "<name>": { "ref": "<node output or hash>", "snapshot": [...rows] } },        (GoG; snapshot new)
  "scales":  { "<name>": { "type": "linear|band|ordinal|time|log|colour", "domain": ..., "range": ... } },  (GoG)
  "theme":   { "fonts": ..., "colours": { "accent": ..., "series": [...] }, "page": "screen|print|slide" },  (new as a shared object)
  "views":   [ { "id": ..., "kind": "chart2d|drawing|scene3d|map", "camera"?: ..., "cut"?: ..., "tiles"?: ...,  (new)
                 "layers": [ { "mark": ..., "data": ..., "encode": { "x": {"field":..,"scale":..}, "y": .., "colour": .., "size": .. } } ] } ],  (GoG)
  "selections": { "<name>": { "type": "point|interval", "key": "elementId|storey|class", "views": [...] } },  (Vega-Lite shape; cross-view key new)
  "transitions": { "default": { "duration": 300, "easing": "cubicOut" }, "on": { "data": ..., "selection": ..., "camera": ... } }  (new)
}
```

The one idea that makes the extra targets fit is a **shared join key**: every mark row carries, or can derive, an element id, storey, or class, and a selection is a set of keys, not a set of pixels or data rows of one view. A bar chart per storey, a table, and the 3D view then share one `selections.storey` object. Vega-Lite's selections are per-view and keyed on fields; Mosaic's Selection is already a predicate shared across clients and is the closest model.

**Kinds of view.**
- `chart2d`: the GoG core; marks bar, line, area, point, arc, rect, text, rule.
- `drawing`: a `cut` (plane, direction, depth range) applied to the model's geometry; the renderer projects the section to 2D and the layers colour it from a table joined on element id. The cut is a parameter, the colouring is an ordinary encoding. The viewer already has clipping (`packages/visualization/src/clipping.ts`) and PNG capture (source, file list).
- `scene3d`: a `camera` (the viewer's `CameraState` from `contracts.ts`, source) plus layers that colour, hide, offset, or annotate elements, and `bar3d` marks anchored at world positions. The `view3d.*` nodes today are imperative verbs (section, color, isolate, explode, camera); the spec turns them into one declarative object the viewer applies in one pass.
- `map`: a georeference (IFC `IfcMapConversion` easting, northing, orthogonal height, rotation) and tile source, with the same layers.

Marks the AEC targets add that no grammar has: `storey` (a horizontal band at a storey elevation in a `drawing` or `scene3d`), `element` (a mark whose geometry comes from the model, coloured by data), `space` (same for rooms), `bar3d`. These are encodings over model geometry rather than over rows alone, which is why they do not fit Vega: Vega marks have no notion of geometry from outside the data table.

## What to copy from whom

| Design | Take | Leave | Licence |
|---|---|---|---|
| Vega-Lite (docs above) | The `encode` shape (`field`, `type`, `scale`, `title`), the `params`/`select` shape, `config` as the theme section, the published-schema habit (`$schema` URL, TypeScript types generating the JSON schema) | The compile-to-Vega step; concat/repeat composition | BSD-3 |
| Observable Plot (docs, vgplot page cites its marks) | The mark list and the "mark plus channels plus transform" shape; its small, orthogonal mark names | Its JavaScript-only API; no JSON | ISC |
| Vega signals (docs, View API) | The idea that interaction state is named values with listeners; `addSignalListener` as the bridge pattern | Event-stream selectors (too low-level for a model to write) | BSD-3 |
| Mosaic (docs, spec and vgplot pages) | Selection as a shared predicate object across clients; `filterBy`; the `$param` reference syntax | Live query per mark (conflicts with host-less snapshots) | BSD-3 |
| deck.gl `@deck.gl/json` (docs, https://deck.gl/docs/api-reference/json/overview; licence MIT, Vis.gl contributors) | The JSONConverter convention: `@@type` names a class, `@@function` and `@@#ENUM.VALUE` reference registered items; a `map` view kind can be a deck.gl layer list directly | deck.gl itself if the 3D viewer stays three.js (two WebGL stacks) | MIT |
| kepler.gl (report, pygraphistry and Go type via web search) | Layer shape `{id, type, config: {dataId, columns, visConfig}, visualChannels}`; `version` string on the saved config | The whole app config (`mapState`, `mapStyle` are app state) | MIT |
| three.js JSON Object format (inferred from `ObjectLoader` and `toJSON`; no formal schema) | Camera serialisation only | Scene serialisation (unstable between versions, not a spec) | MIT |
| glTF 2.0 (docs, spec; animation details not re-read, from prior knowledge: channels with sampler and target path, LINEAR/STEP/CUBICSPLINE) | Keyframe model (times array, values array, interpolation enum) for `transitions`; `extensionsUsed`/`extensionsRequired` as the versioning pattern for AEC extensions | Binary buffers | Khronos spec licence, free to implement |
| CSS transitions / Flutter | `duration`, `delay`, `easing` per property as the whole of a transition declaration | Keyframe timelines beyond what a value change needs | n/a |
| Lottie / Rive | Nothing to copy structurally; both are authored-animation formats, not data-driven | | Apache-2 / MIT runtimes |
| Wilkinson GoG, ggplot2 | Layer = data + mapping + geom + stat + position; keep stat out of the spec (DuckDB does it upstream) | Coordinate systems as a spec axis (one per view kind instead) | book; GPL-2 (idea only) |
| Plotly (docs, reference page; MIT) | `scene` as the 3D view's camera and axes object; the trace list including `scatter3d`, `surface`, `mesh3d`, `choroplethmap`; `layout.template` as a theme | Its renderer (own WebGL stack) | MIT |
| ECharts (docs, v6 feature page; Apache-2) | Declarative animation: `animationDuration`, `animationEasing`, `universalTransition` between series states; design-token theme and runtime theme switching | echarts-gl (2.0.9, separate project, report via web search) | Apache-2 |
| Tableau VizQL | The idea that a table's role (dimension or measure) plus shelf placement determines the mark; a model-friendly "auto" mark (Plot has `auto` too) | nothing concrete; proprietary | n/a |
| Grafana / Kibana dashboards, Power BI visual JSON | `panels[]` with grid position and a per-panel spec; datasource reference by id | Their query models | AGPL / Elastic / proprietary |

Gratify (source, `deps/gratify/src/gratify`: `animate.ts`, `theme.ts`, `painter.ts` at 180 lines) already has the two things a `transitions` section needs: channels that tween every state change and one painter. A canvas chart renderer there is a view function over the same spec.

## Costs and effort

What D buys: one spec drives the SVG renderer, the three.js viewer, and a Gratify renderer; one `theme` object replaces the CSS custom properties in `viz/src/styles.ts` (source), the viewer's colours, and the dashboard generator's inlined styles; AEC marks; one hashable JSON per result; Claude writes one format it has seen in the catalog.

What it costs:
- Renderers × marks. Three renderers and about twelve marks is thirty-six cells; many are degenerate (no `bar3d` in SVG) but each needs a decision.
- Schema upkeep: TypeScript types, generated JSON schema, a validator the node and the MCP tool share, a catalog entry per mark.
- Documentation and examples for the model. Vega-Lite's advantage with Claude is corpus size; ours starts at zero and lives in the skill guide.
- No community: no themes, no gallery, no bug reports from others.
- Reinventing Vega badly: layout (axes, legends, label collision) is where hand-written renderers spend their time. The current 770-line package has no legend layout and no label collision (source, file list and `barChart.ts` size).

Effort for the minimal version (2D bar, line, scatter, pie; table; 3D colour overlay; theme; hover and select), using d3-scale, d3-shape, d3-array, d3-color as arithmetic and keeping the existing viewer and viz package as the two renderers:

| Piece | Weeks |
|---|---|
| Spec types, JSON schema, validator, hashing | 1 |
| 2D SVG renderer: four marks, axes, legend, theme, hover and select events | 2 |
| Selection bus and the viewer binding (`scene3d` colour overlay, selection in and out) | 1 |
| Node (`chart.spec` or per-mark nodes emitting the spec), MCP tool description, notebook embed snapshot, dashboard generator | 1.5 |
| Docs, examples for the Ask guide, tests and gates | 1 |
| Total | 6 to 7 weeks of one agent-driven session stream |

Drawings, maps, `bar3d`, and transitions are each another one to two weeks, and drawings depend on a section-to-2D projection that does not exist yet (inferred: the viewer has clipping, not polygon extraction). Estimate is inferred from the size of the current viz package and viewer modules; no comparable past task in the repository was timed.

## Hybrid

Our spec, with `chart2d` views compiled to Vega-Lite (or Plot calls) and the other view kinds rendered by our code.

The compile boundary is clean where our spec mirrors Vega-Lite's shapes, which is why the outline above copies them: `encode` maps one-to-one, `scales` to Vega-Lite scale objects, `theme` to `config` (`font`, `range`, mark configs), per-view `selections` to `params`.

Where it leaks:
1. **Cross-view selection.** Vega-Lite selections are per compiled view. The bridge is `addSignalListener` on generated signal names and `view.signal` plus `runAsync` to push a selection in; the names and the store format are compiler internals, so a Vega-Lite upgrade can break the bridge (inferred from the View API and the parameter docs).
2. **Transitions.** Vega-Lite has none; a `transitions` section is silently ignored for 2D views, so the same spec animates in 3D and snaps in 2D unless we re-render frames ourselves.
3. **Theme.** `config` covers fonts, colours, and backgrounds; print and slide page sizes, and brand marks, sit outside it and must be applied by the embedding page.
4. **Snapshots.** Vega-Lite inlines data as `values`; the notebook's 50-row cap (`SNAPSHOT_ROWS`, source, `compare.ts` line 8) applies equally, so nothing new leaks here.
5. **Bundle.** Vega-Lite plus Vega adds about 260 KB gzipped to a notebook page whose main bundle is 1.2 MB, and to every self-contained dashboard HTML file (report sizes above).
6. **AEC marks.** `storey` bands in a 2D chart compile to a `rule` layer; `element` marks do not compile at all and force the view into `drawing` kind. The boundary is by view kind, which keeps it clean, at the price of never mixing a model-geometry mark into a statistical chart.

Plot as the compile target instead of Vega-Lite removes the bundle cost (Plot is small, ISC) and the signal-name fragility (Plot has no runtime state; selection is our code re-rendering), and loses headless PDF and the published schema. Mosaic's vgplot is the same trade with DuckDB attached.

## Recommendation

Build D as the spec and start as the Hybrid: define the JSON (data refs, scales, theme, views by kind, layers with Vega-Lite-shaped encodings, selections keyed on element, storey, or class, transitions as duration and easing per property), validate it with a generated schema, hash it in run records, and render `chart2d` views through Vega-Lite now while the viewer takes `scene3d` views and selection flows over our own bus. This gets the brand theme, hover and brush, headless SVG and PDF, and model authoring with a well-known grammar in weeks rather than months, and leaves the 3D, drawing, and map kinds, which no candidate covers, as the work that is ours anyway. Replace the Vega-Lite backend with a Gratify or SVG renderer of our own only when transitions in 2D or the 260 KB per dashboard file become a measured problem. The fact that would change this: if a benchmark shows Claude writes correct `chart2d` views in our format at a materially lower rate than raw Vega-Lite, the 2D subset should be Vega-Lite verbatim (a `vegaLite` layer type) rather than a translation.

## Not checked

- glTF animation section text (page too large for the fetch; the channel, sampler, and interpolation summary is from prior knowledge of the spec).
- Observable Plot's exact mark list and licence from its own pages (rate-limited; ISC and SVG output from prior knowledge, consistent with the vgplot page's statement).
- Bundle sizes measured by our own bundler; figures are DepScope's.
- The exact `view3d.*` node list and signatures (the search over `src` timed out; supervisor's count of about 20 is taken as given).
- Whether Vega-Lite's generated selection signal names are stable across minor versions.
- kepler.gl's current config schema from an exported file.
- Any run of Claude authoring specs in the four formats; the authoring row of the table is inferred.
