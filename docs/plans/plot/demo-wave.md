# BIM Open Plot: the twenty-demo wave

Status: building. Written 2026-10-11 by the supervising session (`c63e906d`). Serves workflow 3 of `deps/bim-open-plot/PROJECT.md` (browse twenty demos and find your own), which serves the family brief's W1 (look, then install one thing). Done line: the page opens from GitHub Pages with nothing installed and lists at least twenty demos; every demo's spec renders headlessly in a test; every synthetic dataset carries a visible label.

## Brief

Twenty standalone demo pages in `deps/bim-open-plot/packages/demos/demos/<slug>/`, one per role and decision on a realistic construction project, over the public Duplex Apartment model (buildingSMART, CC BY 4.0) with synthetic schedule, cost, sensor, and carbon-factor data where the model has none, labelled on the page. Built apart (PLANNING.md, "building apart"): each demo is self-contained so twenty builders work at once in one checkout; the shared figure spec, the `plot.*` node pack, and the real geometry cuts come in later waves and absorb what the demos prove.

Out of scope for this wave: the C# pack, the notebook embed, the studio pane, true section polygons, IMDF export, the Schependomlaan and DigitalHub models (the extracts exist only for the Duplex).

## What the explorers found (2026-10-11)

- `chart.bar` and `chart.line` emit a narrowed table, not a spec; the studio Chart tab and the notebook embed go through `@bimopenflow/panes`; the dashboard generator has no caller. (Chart nodes explorer.)
- The viewer clips on the GPU only and produces no 2D polygons; overlays exist as data but nothing draws them; capture needs a browser; `loadModel` is pure and runs in Node. A 3D bar is possible as an `InstancedGroup` of unit cubes. (Viewer explorer.)
- `Ara3D.IO.GeoJson` has IMDF unit and opening types only, no writer; BOS drops `IfcRelSpaceBoundary`, so no door-to-room relation exists; `IfcSite` latitude and longitude are truncated by the IFC-to-BOS converter (a bim-open-data defect), but the IFC itself carries Duplex at 41°52′27.84″N, 87°38′21.84″W (Chicago); no DuckDB spatial anywhere. (Geometry explorer.)
- Public models with cleared licences: Duplex (4 storeys, 21 spaces, 14 doors, 56 walls, 24 windows), Schependomlaan, DigitalHub. Synthetic data keyed to public ids exists only for NRC carbon (`samples/nrc/*.csv`). (Demo inventory explorer, which also proposed 24 candidates; the twenty below draw on it and on the thirteen ideas from the "BIM Open Flow demo graphs" session.)

## Design

Shared code, supervisor-owned, committed before dispatch (`packages/demos/src/`):

| Module | Gives a demo |
|---|---|
| `manifest.ts` | `DemoManifest` and `manifestProblems` |
| `demo.ts` | the `Demo` contract: `manifest`, `render(root)`, `headless(paths)`; `dataUrl`, `resolveDataPath` |
| `page.ts` | `mountDemoPage`: the frame with role, decision, licence, and the synthetic-data badge |
| `theme.ts` | brand tokens, `series`, `heat`, `diverging`, `vegaConfig`, `heatColor` |
| `chart.ts` | `renderVegaLite`, `vegaLiteToSvg`, `Row` |
| `data.ts` | `loadTable` (newline-delimited JSON), `loadJson`, `loadCsv`, `parametersByElement`, `BoundsFile` |
| `building.ts` | elements joined to boxes; storeys; door-to-space pairs by overlap; exits; room graph; hops; travel distances |
| `plan.ts` | `planSvg` (rectangles, lines, points, legend, scale bar), `heatRect`, `mountSvg` |
| `scene.ts` | `mountScene` over the viewer: load a `.bos`, colour by STEP id, top-down, describe headlessly |
| `map.ts` | `mountMap` (MapLibre, OSM tiles), `toLonLat`, `boxFeature`, `describeMap` |

Data: `public/data/duplex/{elements,parameters,relations,bounds}.json` (extracted 2026-10-11 with the `bimopen-ifc` MCP server from `data/duplex.ifc`), `public/models/{duplex,duplex-federated,schependomlaan}.bos` with `NOTICE.md`.

Approximations every demo over boxes states in its caption: rooms and elements are axis-aligned bounding boxes, not outlines; door-to-room adjacency is box overlap with 0.3 m tolerance; an exit is a door touching at most one room; travel distance is a chain of straight segments between door centres.

## Considered and rejected

- **Option:** one shared figure spec and renderers first, then demos. **Reason:** the owner asked for the twenty demos in parallel sub-agents now; contracts proven by twenty concrete figures are better contracts, and a wrong contract found by twenty builders at once costs twenty times as much to unwind (parallel-wave skill). **Would change if:** the demos converge on the same handful of encodings, which is the signal to extract the spec (planned debt below).
- **Option:** cut true plan polygons from BOS meshes before any floor-plan demo. **Reason:** no slicer exists in the family (the only mesh-plane code returns unchained segments); boxes give a legible plan of the Duplex today. **Would change if:** a demo's reader cannot tell rooms apart from boxes; the Duplex rooms are rectangular enough that they can.
- **Option:** worktrees per builder, merged at the end. **Reason:** `GIT.md` bans worktrees; disjoint folder fences in one checkout give the same isolation and the merge is the index commit. **Would change if:** the owner names this task as an exception.

## Planned debt

| Copied or stubbed | Payoff | Where |
|---|---|---|
| Each demo inlines its own Vega-Lite spec and data shaping | the `plot.vegaLite` node and a figure spec file per demo | later wave, TKT to file |
| Plans from bounding boxes | mesh-plane slicing to closed loops in `Ara3D.Geometry`, a `plot.section` node | later wave |
| Door-to-room adjacency by box overlap | `IfcRelSpaceBoundary` mapped to `BoundedBy` in bim-open-data | defect ticket in the toolkit |
| Georeference typed by hand from the IFC | fix the IFC-to-BOS truncation of `RefLatitude`/`RefLongitude`; read `IfcMapConversion` | defect ticket in the toolkit |
| Synthetic tables per demo folder | one keyed synthetic dataset package | when a second demo needs the same table |

## Chunks

Contracts: `packages/demos/src/*`, `test/demos.test.ts`, `demos/_template/*`, the Duplex extracts; bim-open-plot commit d38b364.
Baseline gates: `npm test -w @bim-open-plot/demos` (template, building, and the per-demo shared test over `_template` excluded) green before dispatch.

Every chunk: fence `deps/bim-open-plot/packages/demos/demos/<slug>/**` only; test `npx vitest run --root packages/demos -t "demo <slug>"` from the plot root, plus `npx tsc --noEmit -p packages/demos/tsconfig.json`; resources: none (no ports; the data is read-only). Kinds: C chart, D drawing (plan from boxes), S scene3d, M map. [H] heatmap, [F] floor plan, [E] egress.

| Id | Slug | Role · decision | Kinds | Data |
|---|---|---|---|---|
| D01 | `rooms-by-storey-area` | Architect · which storey carries the most floor area and how is it split between rooms | C | model |
| D02 | `door-width-check` | Accessibility reviewer · which doors fall below an 850 mm clear width and where are they [F] | C + D | model; threshold stated as illustrative |
| D03 | `element-mix-by-storey` | BIM manager · which element classes make up each storey | C | model |
| D04 | `window-orientation` | Energy analyst · how much window area faces each compass direction, and the window-to-wall ratio | C | model; orientation from box aspect, approximate |
| D05 | `room-area-plan` | Facility manager · where each room is and how large [F][H] | D | model |
| D06 | `egress-hops-plan` | Fire engineer · how many doors from each room to an exit [E][F] | D + C | model; adjacency by overlap |
| D07 | `travel-distance-heatmap` | Fire engineer · which rooms are furthest from an exit [E][F][H] | D + C | model; door-centre chains |
| D08 | `parameter-completeness` | BIM manager · is the delivered model complete enough to accept: class × parameter fill rate [H] | C | model |
| D09 | `clash-candidate-matrix` | BIM coordinator · which class pairs overlap most, per storey [H] | C + D | model; box overlaps |
| D10 | `element-size-scatter` | Quantity surveyor · which elements are outliers in volume and height | C | model (volumes from parameters where present, else box volume marked) |
| D11 | `embodied-carbon-storey` | Sustainability lead · which storey and material to target for carbon cuts [H] | C + S | model volumes × synthetic carbon factors |
| D12 | `cost-by-storey-class` | Estimator · base vs value-engineered cost per storey and class, and what stays unpriced | C | model quantities × synthetic unit rates |
| D13 | `construction-sequence` | Project manager · is the finishing sequence on the critical path (Gantt) and what is built by week | C + S | synthetic schedule over real storeys and classes |
| D14 | `installed-vs-planned` | Site superintendent · what is installed per storey vs plan this week (S-curve) | C + S | synthetic events over real element ids |
| D15 | `room-temperature` | Facility manager · which rooms overheat in the afternoon [F][H] | D + C | synthetic hourly readings per real room |
| D16 | `storeys-in-3d` | Coordinator · what each storey holds, tinted and exploded in 3D | S + C | model (duplex.bos) |
| D17 | `discipline-mix` | MEP coordinator · which discipline drives each storey's coordination effort | S + C | model (duplex-federated.bos: colour by source model or class group) |
| D18 | `site-map` | Owner · where the building sits and what is around it | M | IfcSite latitude and longitude typed from the IFC; a synthetic list of neighbouring projects, labelled |
| D19 | `room-adjacency-network` | Space planner · which rooms connect to which, through doors [F] | D | model; adjacency by overlap |
| D20 | `model-diff-federated` | BIM manager · what the federated model adds over the architecture model, per class (diverging bar) | C | derived: counts from the two .bos files loaded with the viewer's `loadModel` in Node |

Dependencies: none between chunks. D11, D13, D14, D16, D17 depend on `src/scene.ts`; D18 on `src/map.ts`; D02, D05, D06, D07, D09, D15, D19 on `src/plan.ts` and `src/building.ts`. All committed before dispatch.

Acceptance for every chunk: the folder has `demo.json`, `README.md`, `index.html`, `main.ts`; the shared test passes for the slug; `tsc` passes; the page draws in a browser (the supervisor checks at merge); every synthetic data file is listed in the manifest with `provenance: "synthetic"` and a `note` on how it was invented; captions state the approximations above where they apply.

## Build log

(filled as builders return)

## Wave record

(filled at the gate)
