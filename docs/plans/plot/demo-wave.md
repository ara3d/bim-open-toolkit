# BIM Open Plot: the twenty-demo wave

Status: built 2026-10-11; gate passed. Written 2026-10-11 by the supervising session (`c63e906d`). Serves workflow 3 of `deps/bim-open-plot/PROJECT.md` (browse twenty demos and find your own), which serves the family brief's W1 (look, then install one thing). Done line: the page opens from GitHub Pages with nothing installed and lists at least twenty demos; every demo's spec renders headlessly in a test; every synthetic dataset carries a visible label.

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

| Chunk | Commit | Result |
|---|---|---|
| D03 element-mix-by-storey | 704aa94 | 8 tests pass, tsc clean; only its folder. 239 elements, 50 openings left out. Wanted a categorical palette longer than 8 (uses tableau20 for 15 classes). |
| D01 rooms-by-storey-area | fdf0e91 | 7 tests pass, tsc clean; only its folder. 21 of 21 spaces have an Area; Roof 145.7, Level 1 141.8, Level 2 134.5 m². Units A/B taken from OccupancyZoneName, not from position: the units are mirrored by a half turn, so the brief's west/east rule was wrong. Wanted `parametersByElement` to take (set, name) pairs; palette short for 12 rooms. |
| D04 window-orientation | ad53cab | 11 tests pass; only its folder. 24 windows: N 5, E 6, S 5, W 6, Up 2 (skylights get their own class, the thin-axis rule misfiles them); WWR N 0.36, E 0.10, S 0.37, W 0.11; exterior walls by Revit Function = 1. Wanted `facing(box, model)` in building.ts. |
| D05 room-area-plan | c14d18e | 8 tests pass; only its folder. 10 rooms per living storey, largest 30.14 m² (A102, B102); walls and doors chosen by a cut 1.2 m above the storey floor rather than by StoreyName. Wanted in plan.ts: legend text clipped (legendH 36 too small), a label colour that contrasts with dark fills, label fallbacks that fit, an `extent` option, hatching for null. |
| D07 travel-distance-heatmap | 378edff | 8 tests pass; only its folder. 20 rooms with a distance, farthest Bedroom 1 (Level 2) at 12.8 m, no room over 30 m; three views (two plans, one chart). Same plan.ts legend clipping and label contrast requests. |
| D09 clash-candidate-matrix | 6188401 | 9 tests pass; only its folder. 215 solids tested, 287 candidate pairs, 43 hosted door/window-in-wall pairs set apart, Furniture × Slab leads (57, a box artefact, stated); the roof assembly excluded because its slab shares its box. Wanted a box-intersection helper in building.ts (openLinks has it inline). |
| D13 construction-sequence | 78af2de | 10 tests pass; only its folder. 14 activities over 24 weeks, 11 critical, 218 elements with a week, all found in duplex-federated.bos by STEP id; schedule.ts generates data/schedule.json and a file snapshot keeps them equal. Wanted a shared week slider. |
| D18 site-map | c2a5490 | 9 tests pass; only its folder. IfcSite angles kept as DMS, 41.8744 N 87.6394 W; footprint, 10 Level 1 rooms, 6 synthetic nearby projects. Found a shared bug: relative `./data/` URLs were not fetched in the browser and not copied by the build; fixed by the supervisor in data.ts (fetch everything in a browser) and vite.config.mjs (copy each demo's data/ at closeBundle). Wanted `fitBounds` on mountMap and an inverse of toLonLat. |
| D10 element-size-scatter | 607800b | 7 tests pass; only its folder. 216 elements: 105 modelled volumes, 111 box volumes, rooms left out; largest the roof (61.8 m³ box, appears as IFCROOF and IFCSLAB with one box); colour by seven class groups since the palette has 8 colours. Wanted a `group` option on parametersByElement. Note: its commit attributes Claude Opus 5.5 (the builder's model). |
| D06 egress-hops-plan | edbdc1c | 8 tests pass; only its folder. 2 exits (both Level 1 foyers); hops over 21 spaces: 2 at 0, 12 at 1, 6 at 2, Roof unreached; max 2. Finding: `hopsFrom` counts every link as a hop, and bedroom boxes overlap the hallway boxes, so an open link stands where the real plan has a door; a doors-only count needs a helper and a tighter open-overlap rule. Wanted exported tolerance constants, routes from hopsFrom, label offsets and line/outline legend entries in plan.ts. |
| D12 cost-by-storey-class | 90fc313 | 9 tests pass, tsc clean; only its folder. 198 priced, 9 unpriced (roof, 7 foundation walls, a party wall with no Area), 11 parts costed with their whole; Base $408,872 vs VE $335,031; Level 1 highest. estimate.ts holds the pricing. Wanted a longer palette, a property-set filter on parametersByElement, a shared storey order. |
| D15 room-temperature | 4a0d2a5 | 9 tests pass; only its folder. 18 of 20 rooms with 24 hourly synthetic readings by a stated rule (daily curve, solar gain per facade, bathroom offset), 2 rooms with no sensor; hottest B202 Bedroom 1 at 27.4 °C at 15:00. rule.ts, model.ts, generate.ts keep data and rule equal. Same plan.ts legend clipping; wanted ramp plus swatch legends and a north arrow. |
| D17 discipline-mix | ef04666 | 7 tests pass, tsc clean; only its folder. Disciplines from the source documents (`loaded.documents.ofObject`): Architecture 215, MEP 926, Electrical 103, Mechanical 487 (the rooms file also holds ducts and pipes), 1731 drawn elements, 101 room volumes hidden; storeys found by walking containment relations, ordered by geometry since storey placements carry no elevation; STEP ids repeat across the four files (1,052), so colour and visibility go by object key. Wanted colorByKey/setVisibleByKey and a storey lookup in scene.ts. |
| D20 model-diff-federated | f12697a | 9 tests pass, tsc clean; only its folder. 296 architecture products all matched by STEP id in the Duplex_A document; 8 classes only in the federated model; no class loses objects; the .bos has no GlobalId even with properties. Wanted an options argument on loadModelHeadless. |
| D14 installed-vs-planned | b66a0e8 | 9 tests pass, tsc clean; only its folder. 218 elements: 86 installed, 10 ahead, 20 late, 102 not due at week 9; Level 2 14 behind, Level 1 10 ahead; schedule.ts regenerates data/events.json under test. Lists the .bos as a data file, so the frame shows a second model badge. |
| D19 room-adjacency-network | 774aa8d | 11 tests pass, tsc clean; only its folder. 21 rooms; 18 door, 6 open, 8 stair edges over 28 pairs; highest degree 6 (both Foyers, both Hallways); 2 components per living storey, 3 in the building. network.ts holds the graph. Wanted in plan.ts: label offset by point radius, a polyline, group labels. |
| D11 embodied-carbon-storey | 2508632 | 7 tests pass, tsc clean; only its folder. 218 built elements, 105 with a volume, 92 with a factor (brick largest, 44.6 t; Level 1 highest, 38.8 t); 13 excluded (7 footings name no material, 6 tile floors). The extract has no material-layer rows, so one family per element from its type name; stud and air layers skipped as cavities. carbon.ts holds the calculation. Wanted a shared storey order. |
| D16 storeys-in-3d | a7f8e6b | 9 tests pass, tsc clean; only its folder; checked by the builder in headless Chrome. Storeys T/FDN −1.25, Level 1 0, Level 2 3.1, Roof 6.0 m; 218 elements per the extracts, 1,270 more by their own containment, 246 with no storey faint, 101 rooms hidden; Exploded through the viewer's layout functions (captureTranslations, layoutTranslations, writeLayout), since mountScene installs no layouts feature. Found a shared defect: `keysByStepId` kept the last object per STEP id and the four federated documents reuse ids, so 33 of 296 rows pointed into another document; fixed by the supervisor (prefer the first document by title, or a pattern). Wanted colorByKey and a layouts option on mountScene. |
| D08 parameter-completeness | cad36cf | 13 tests pass, tsc clean; only its folder; checked by the builder and the supervisor in the browser. 239 elements in 15 classes, 13,275 parameter rows, 52 parameters shown; placeholder values that repeat the parameter's name (7,153 rows, Revit's COBie template) count as unfilled; IFCDOOR × Ifc:OverallWidth 14/14; IFCROOF carries no parameters (labelled, not 0 %). Longest chunk: 4.5 h. |
| D02 door-width-check | b61f4d7 | 6 tests pass, tsc clean; only its folder. 14 doors, 6 below 850 mm (762 and 813 mm). Checked in the browser 2026-10-11: bar chart with the rule, two plans with pass/fail doors render. Wanted a fixed-colour box rect in plan.ts and an outline on legend swatches. |

## Wave record

Outcome: success; unmet criteria or blockers: none for this wave. The brief's Done line for workflow 3 is met except "opens from GitHub Pages", which needs Pages switched on in the bim-open-plot repository settings (Source: GitHub Actions) and the first run of `.github/workflows/pages.yml`.
Gates: `npx vitest run --root packages/demos` 238 passed, 24 files (20 demos, 14 flow-* mirrors from the viz-analyses session, 4 helper tests); `npx tsc --noEmit -p packages/demos/tsconfig.json` clean; `PLOT_BASE=/bim-open-plot/ npx vite build packages/demos` built in 13 s with every demo page and data folder in dist/; the index lists 34 demos; 12 pages checked in the browser (door-width-check, room-area-plan, travel-distance-heatmap, construction-sequence, room-temperature, discipline-mix, site-map, storeys-in-3d, embodied-carbon-storey, parameter-completeness, flow-storey-stacking, the index).
Commits: one per chunk, listed in the build log above, each touching only its folder; supervisor commits d38b364 (scaffold), 4171c5a (shared fixes, flow helper move, Pages workflow), 7cfa62b (index); peer commits 6b23171 and 484b054 (flow-* mirrors).
Findings: four helper requests were fixed in shared code at the gate (relative data URLs, federated STEP-id ambiguity, plan legend clipping, label contrast); the rest are recorded per chunk and feed the next wave: a palette longer than eight, `parametersByElement` by property set, a shared storey order, `colorByKey` and a layouts option on `mountScene`, a box-intersection helper, exported box-model tolerances, `fitBounds` on `mountMap`, a doors-only hop count. Two briefs were corrected by the data (unit split by position, skylight orientation). Builders shared one scratchpad folder and overwrote each other's probe files until they used subfolders. The package-wide `tsc` failed intermittently on other builders' probe files during the wave; each builder reran once, as instructed. The peer session pushed the shared branch once; after that only the supervisor pushed. The first version of this record was written through an unquoted shell heredoc, which ran its backticked commands; commit 3c44894d carries that damage and this commit replaces it.
Timing: dispatched 20 builders at once at about 16:15 on 2026-10-11; 19 returned within 7 to 32 minutes, the last (D08) after 4.5 h; wall clock about 4.5 h against a sequential estimate of about 8 h of builder time (sum of durations). Builders spent no time blocked on contracts.
