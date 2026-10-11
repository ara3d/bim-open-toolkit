# Research: does Mosaic fit BIM Open Notebook as its chart layer?

> Investigation, 2026-10-11, by Claude Fable 5.1 for Christopher Diggins, with the `platonic:investigate` skill. The question came out of a design conversation about charts and infographics for the toolkit (see `docs/proposals/chart-spec-comparison.md`, written the same day). Mosaic (https://idl.uw.edu/mosaic/, University of Washington Interactive Data Lab) is a DuckDB-backed interactive visualization framework; vgplot is its chart layer, rendering through Observable Plot. Facts were read from Mosaic's documentation and source on 2026-10-11 and are labelled **docs**, **source**, **report** (third-party issue or post), or **inferred** (reasoned; the basis is given). Status: answered; no ticket yet.

## Answer

No, not for the notebook as it stands. Mosaic can draw a chart without DuckDB only when the rows are inlined at the mark, and in that mode it is Observable Plot with a JSON front end, minus the features Mosaic exists for (linked filtering, database-side aggregation). Vega-Lite fits the notebook's snapshot contract better: a comparable runtime size, interaction without a database, a stable published schema, and headless SVG and PNG export.

**Confidence:** medium-high. The two claims the answer rests on (a mark with inline data issues no query; Vega exports headlessly) were checked at the source. Bundle sizes were measured by one agent, and the "no network request" behaviour is inferred from code, not observed in a browser.

**Would change it:** a decision to ship DuckDB-WASM in the notebook page so charts aggregate over the whole table in the browser instead of a 50-row snapshot. Mosaic's linked filtering and database-side marks would then be usable, at about 8 MB gzipped on a page that is 4.1 MB today.

## The notebook's contract

- Every embed carries a snapshot of its result so a notebook opens with no host. A chart snapshot holds at most 50 rows: `SNAPSHOT_ROWS = 50` in `deps/bim-open-notebook/bimopenflow/web/packages/bim-open-notebook/src/live/compare.ts`. **source**
- The chart embed renders the snapshot through the existing chart pane (`@bimopenflow/viz`, bar and line) and asks a host, when one is present, whether the result changed. **source**: `src/embeds/chart.ts` in the same package.
- The built page is 4.1 MB with a 1.2 MB main bundle, hosted on GitHub Pages. **source**: `du` of `site/`.

## Evidence

1. **Architecture.** Mosaic's coordinator turns every mark into SQL sent through a connector; a connector is one method, `query({type, sql})`, returning Arrow bytes. Something must run SQL. **source**: packages/mosaic/core/src/connectors/Connector.ts; **docs**: idl.uw.edu/mosaic/core. Connectors shipped: `rest` (the default), `wasm` (DuckDB-WASM), Node; Jupyter talks to Python DuckDB; WebSocket support was removed in 0.32.1. **source**; **report**: GitHub releases.
2. **Rendering without DuckDB.** A mark given a literal array has its own data: `hasOwnData()` returns true and `query()` returns null before any SQL is built. The docs add that interactive filtering is not supported for such a mark. **source**: packages/vgplot/plot/src/marks/Mark.js (re-read by the supervising session); **docs**: idl.uw.edu/mosaic/llms-full.txt. In the declarative spec only mark-level `data: [...]` takes this path; top-level named data is loaded into DuckDB. **source**: packages/vgplot/spec/src/ast/DataNode.js and PlotFromNode.js.
3. **Static mode.** None documented. Issue 506 (cache initial query results) and issue 624 (static HTML from Quarto) are open; the proposed fix still uses DuckDB-WASM. **report**: github.com/uwdata/mosaic/issues/506 and /624. A connector that replays recorded SQL-to-Arrow results would fit the interface but answer only recorded queries. **inferred** from Connector.ts.
4. **Headless export.** None. Maintainers recommend printing from Playwright (issue 627, open); the package's visual tests use Playwright. **report**; **source**. Vega documents `vg2svg`, `vg2png`, and `view.toSVG()` under Node, with node-canvas for PNG. **docs**: vega.github.io/vega/usage (re-read by the supervising session).
5. **Sizes, gzipped.** vgplot bundle with Plot, D3 and the WASM shim: 258 KB. Vega plus Vega-Lite plus vega-embed: 282 KB. DuckDB-WASM: 35.9 MB raw, about 8.1 MB gzipped, plus a 188 KB worker (a `-dev` build tagged `latest`; stable may differ). **inferred**: measured with curl and gzip against jsDelivr and esm.sh.
6. **Hosting.** Only DuckDB-WASM's threaded `coi` bundle needs COOP/COEP headers; `selectBundle` falls back to single-threaded on GitHub Pages. Mosaic loads the bundle from jsDelivr by default, so an offline page would self-host it. **docs**: duckdb.org, deploying DuckDB-WASM; **source**: connectors/wasm.ts.
7. **Spec.** JSON or YAML with `meta`, `config`, `data`, `params`, `plotDefaults`, and components; `parseSpec` gives an AST with `astToDOM`, `astToESM`, and `astToPython`. The JSON schema is generated from the TypeScript `Spec` type; no stability policy is stated. **docs**: idl.uw.edu/mosaic/spec; **source**: packages/vgplot/spec/package.json. Coverage: layered marks, `fx`/`fy` facets, interactors (interval, toggle, highlight, nearest, pan and zoom), legends, concat, inputs, the Plot mark set plus database-side marks (`denseLine`, `raster`, `hexbin`). Encodings may be SQL expressions, which need a database. **docs**
8. **Rendering.** SVG through Observable Plot (`plot-renderer.js`); no canvas renderer; raster marks produce bitmaps inside the SVG; large data is handled by aggregation in the database. **source**; **docs**
9. **Maturity.** Version 0.32.1 released 2026-10-09, BSD-3-Clause, fourteen releases since April 2026, self-described as "an active research project". Breaking changes in the past year: selection clauses (0.29), join syntax (0.30), JSON transport removed and Arrow options moved (0.32), WebSocket removed (0.32.1). **source**: npm registry; **report**: GitHub releases.
10. **Vega-Lite interop.** No converter and no shared spec; a `vega-example` proof of concept has Mosaic manage data for Vega-Lite views. **source**: uwdata/mosaic repository.

## What it means

Mosaic's value is linked interaction and aggregation over tables too large for the browser to hold as rows. The notebook sends the browser 50 rows; the large-table problem is solved upstream by the host's DuckDB, and the chart shows a result, not the data. That division is right for a notebook that must open anywhere, and Vega-Lite assumes the same division. Mosaic is worth revisiting for the live studio, where a host is always present and a chart could cross-filter the 3D view over the full table through a REST connector. That is a different surface with a different contract.

## Not checked

- Running a vgplot spec with mark-level data and watching the network tab.
- Vega-Lite's own `vl2svg` command (the Vega usage page documents the Vega-level tools and the View API).
- Whether later pull requests let the WASM connector serve cached query bundles.
- Gzipped size of mosaic-core alone.

## Next

None for the notebook decision. The companion document weighs Vega-Lite against Vega and a spec of our own.
