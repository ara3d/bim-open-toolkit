# Visualization demo graphs

Graphs that turn a question about the Duplex into a figure: a chart, a coloured 3D view, or both from one
table. Each file is a canonical graph document whose file name is the analysis id. Paths use the placeholder
`{SAMPLES}` for `samples/nrc`, which holds the committed Duplex as IFC (`duplex-base.ifc`,
`duplex-enriched.ifc`), BOS (`duplex-enriched.bos`), DuckDB, and the NRC carbon CSVs. The studio seeds these
graphs with `{SAMPLES}` rewritten (`BimSampleSeeding`).

Each graph ends today in `chart.bar`, `chart.line`, `view.table`, or `view3d.*`. Each also has the Vega-Lite
spec for its figure at `specs/<id>.vl.json`, written for the draft `plot.vegaLite` node of bim-open-plot
(input `table`, param `spec` with `data` omitted; the node binds the input rows as `data.values`). When that
node lands, the spec moves into the graph. Tables keep an element key column, a storey column, and one value
column per figure, so the drawing, scene3d, and map kinds planned in bim-open-plot fit them too.

A demo whose numbers are synthetic (a schedule, unit rates) says so in its note and in a `Synthetic` column.

| Id | Question | Figure |
|---|---|---|
| `viz-storey-stacking` | BIM manager: how many elements of each class sit on each storey, from the foundation to the roof? | Stacked bar of elements per storey by class; storey totals and the 3D model coloured by storey elevation on one scale |
| `viz-model-composition` | BIM manager: which element classes make up the model, and where are they? | Sorted bar of the seven largest classes plus Other, with shares; 3D model on the same category colours |
| `viz-carbon-by-material` | Sustainability lead: which few materials carry 80% of the embodied carbon (A1-A3), and where are they? | Pareto: ranked bars with a cumulative-share line and an 80% rule; 3D model coloured by each element's main material on the same scale |
| `viz-carbon-intensity-by-storey` | Sustainability lead: how much embodied carbon does each storey carry per m² of floor? | Bars of kgCO2e/m² per storey, the storey with no floor area left missing; 3D tinted by intensity on the same scale |
| `viz-door-accessibility` | Accessibility reviewer: which doors are narrower than 850 mm, and where are they? | Width histogram with an 850 mm rule, unknown widths as their own bar; failing doors red in 3D, the rest faded |
| `viz-opening-schedule` | Estimator: how many doors and windows of each type and size are on each storey? | Bars per storey, type and size, coloured by type; openings coloured the same in 3D |
| `viz-facade-orientation` | Facade engineer: how much wall and glazing sits on each side of the building? (uses `bim.orientation`) | Wall and window m² per compass sector, a polar chart in the spec; 3D coloured by sector |
| `viz-window-to-wall-ratio` | Energy modeller: what share of each facade is glazing, and does any side pass 0.40? | Window-to-wall ratio per facing with a 0.40 rule; table of areas |
| `viz-construction-sequence` | Site superintendent: in what order are floors and trades built, and what is finished by which week? Synthetic dates (uses `bim.buildSequence`) | Gantt by task and trade; 3D coloured by finish week on the same scale |
| `viz-progress-s-curve` | Project manager: how many elements should be installed by each week, and how far behind is the site? Synthetic plan and actual | S-curve of cumulative installs, planned against a synthetic actual |
| `viz-element-size-outliers` | Model auditor: which elements are ten times larger or smaller than their class median? | Log-scale scatter of volume against height by class, outliers emphasised; outliers isolated in 3D |
| `viz-clash-matrix` | Coordinator: which pairs of classes have the most overlapping bounding boxes (candidates, not clashes)? | Class-by-class heatmap and matrix table; 3D coloured by each element's candidate count |
| `viz-parameter-completeness` | BIM manager at handover: which classes miss the fields a handover needs? | Heatmap of fill rate, class by parameter, blank where a class never has the field; worst classes ranked; 3D by element completeness |
| `viz-room-areas` | Space planner: how big is each room, and how much area does each room type take per storey? | Area histogram by room type; per-room bars and 3D rooms on one area scale; totals per type per storey |
| `viz-wall-type-takeoff` | Estimator: how much wall of each type is there, and where is it? | Horizontal bars of wall area per Revit type, ranked, one colour per type on the scale the 3D view shares; walls coloured by type in 3D, the rest ghosted |
| `viz-assembly-buildup` | Architect or specification writer: how thick is each wall, floor, roof and ceiling assembly, and what makes up its thickness? | Stacked bars of layer thickness per assembly, one series and colour per material, ranked by total; table of elements, materials and total per assembly |
| `viz-declared-vs-measured-volume` | Model auditor: do the volumes the model declares agree with its geometry? (uses `view3d.measures`) | Grouped bars of declared against measured m3 per class, coloured by series; a second chart of the gap per class, coloured by class; classes with no declared volume keep it missing |
| `viz-trade-progress` | Project manager: how many elements does each trade finish per week, and how far along is each trade? Synthetic dates (uses `bim.buildSequence`) | Multi-series line of cumulative elements per trade over the weeks; stacked bars of the same weeks by trade |
| `viz-ffe-schedule` | Facility manager at handover: how many pieces of furniture and fixtures of each family must be tagged, and on which floor? | Horizontal ranked bars in the single accent colour (colorBy none); table of items per family and storey |

## Numbers on the Duplex

Each graph's `about` note explains how to read it; the numbers it computes for the Duplex are kept here, so
the note stays true on another building. The goldens under
`tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/<id>.txt` record the same values.

An element's storey is the nearest IfcBuildingStorey that contains it: the row of `StoreyOfElement` (or
`StoreyOfEntity`) with the least `Depth`, taken with `arg_min(..., Depth)`. A filter on `Depth = 1` would leave
72 of the Duplex's 239 elements (furniture in rooms, stair parts), which only have a depth-2 row, with no
storey; the graphs that read only spaces, doors, windows, or walls, which a storey contains directly
(`viz-carbon-intensity-by-storey`, `viz-door-accessibility`, `viz-facade-orientation`, `viz-opening-schedule`,
`viz-window-to-wall-ratio`), filter on `Depth = 1`.

- **`viz-storey-stacking`**: 218 physical elements on four storeys, from T/FDN (-1.25 m) to Roof (6.0 m):
  T/FDN 14, Level 1 103, Level 2 93, Roof 8. 102 entities have no storey (the warning on `withStorey`).
- **`viz-model-composition`**: of the 218 elements, Furniture 61, Wall 57, Window 24, Slab 21, Door 14,
  Covering 13, Beam 8, and Other 20.
- **`viz-carbon-by-material`**: 115,730.3 kgCO2e both before and after the split (217 of 218 elements
  have a carbon value). 26 bars: Metal - Stud Layer leads with about 23,470 kgCO2e (20%), then
  Wood - Flooring and Ceramic Tile; ten groups make class A (80%). Roofing - EPDM Membrane, Roofing - Barrier,
  and Site - Grass, used only by the IFCROOF, stay missing.
- **`viz-carbon-intensity-by-storey`**: Level 2 362.0 and Level 1 348.8 kgCO2e/m2; Roof 39.9 kgCO2e/m2
  over one 145.7 m2 attic space; T/FDN carries 11,761.3 kgCO2e and no spaces, so its intensity is missing.
  Roof has carbon on 7 of its 8 elements. Whole building: 115,730.3 kgCO2e, of which 103,969.0 kgCO2e sits on
  the 3 storeys with 422.0 m2 of space, 246.3 kgCO2e/m2.
- **`viz-clash-matrix`**: 331 element pairs across 25 class pairs overlap by more than one litre: finish
  floors (IfcSlab) against furniture 57, ceilings against walls 47, and slabs against walls 40 lead. The
  IFCROOF and the roof slab overlap by 61.8 m3 with near-equal mesh volumes (60.7 and 60.4 m3, measured by
  `view3d.measures` in `viz-element-size-outliers`), which suggests the roof geometry is carried twice. The
  busiest elements are two Level 1 wood finish floors, with 35 candidates each.
- **`viz-construction-sequence`**: 10 tasks from T/FDN - Structure (2027-01-04, 7 elements) to
  Level 2 - Finishes (36 elements), finishing in weeks 2 to 8; 21 of 239 rows have no storey or no trade and
  stay unscheduled.
- **`viz-opening-schedule`**: 38 openings on 11 lines. The skylight's type name says 1180 x 1170 mm, but the
  IFC gives 1173 x 635 mm.
- **`viz-progress-s-curve`**: 218 elements scheduled.
- **`viz-element-size-outliers`**: 22 of 216 elements are outliers: the roof slab is 144 times its class
  median, and eight furring walls are 70 to 74 times below theirs.
- **`viz-parameter-completeness`**: 543 of 2,157 parameter cells are filled (25%); the placeholder
  SerialNumber appears on 211 elements.
- **`viz-room-areas`**: Level 1 142 m2, Level 2 135 m2, Roof 146 m2.
- **`viz-wall-type-takeoff`**: 57 walls of 8 types, 587.8 m2 and 207.1 m3 in all. By area: Exterior - Brick on Block
  12 walls, 154.6 m, 272.0 m2, 111.4 m3; Interior - Partition (92mm Stud) 18 walls, 106.4 m2; Foundation - Concrete
  (417mm) 4 walls, 64.4 m2; Party Wall - CMU 4 walls, 61.9 m2; Interior - Furring (152 mm Stud) 6 walls, 58.6 m2;
  Foundation - Concrete (435mm) 3 walls, 12.5 m2; Interior - Plumbing (152mm Stud) 2 walls, 9.4 m2; Interior - Furring
  (38 mm Stud) 8 walls, 2.6 m2. Every wall declares all three dimensions. In 3D, 57 instances are coloured and 657 ghosted.
- **`viz-assembly-buildup`**: 15 assemblies over 17 materials (36 assembly-material pairs). Thickest: Party Wall - CMU
  550 mm (concrete block 386, stud 82, air 50, plasterboard 32), Live Roof over Wood Joist Flat Roof 457 mm (lumber 286,
  rigid insulation 76, grass 64, plywood 19, EPDM 6, barrier 6), Foundation - Concrete (435mm) 435, Exterior - Brick on
  Block 417 (block 193, brick 92, insulation 50, stud 41, air 25, plasterboard 16), Foundation - Concrete (417mm) 417,
  Residential - Wood Joist with Subflooring 305; thinnest: Finish Floor - Wood 19 mm and Finish Floor - Ceramic Tile 13 mm.
- **`viz-declared-vs-measured-volume`**: 216 elements in 12 classes; 2 have no mesh (the join warns). Six classes declare a
  volume: Wall 207.1 m3 declared against 194.7 measured (-6%), Slab 64.6 against 125.0 (+93.5%: 20 of 21 slabs declare one,
  and the undeclared roof slab alone measures about 60 m3), Roof 60.75 against 60.75 (0), Footing 16.5 against 16.5 (0),
  Covering 13.9 against 8.0, Beam 0.33 against 0.51. Door, Window, Furniture, Member, Stair and Railing declare none and
  keep Declared_m3 and Gap_pct missing.
- **`viz-trade-progress`**: 218 scheduled elements over 8 weeks in three trades (the Duplex has no MEP); 10 week-trade
  pairs finish something, and the grid has 24 week-trade rows. Cumulative by week 5: Structure 43, Envelope 32, Finishes 0;
  weeks 1 and 4 finish nothing (zeros, not gaps); everything is finished by week 8.
- **`viz-ffe-schedule`**: 61 items in 9 families, 41 on Level 1 and 20 on Level 2. Base Cabinet-Double Door & 2 Drawer 16
  (all Level 1), Table-Coffee 10 (6 and 4), Tall Cabinet-Single Door(2) 8 (Level 2), Upper Cabinet-Double Door-Wall 8,
  Vanity Cabinet-Double Door Sink Unit 5, Sofa 4, Bed-Standard 4, Counter Top 4, Counter Top w Sink Hole 2.
- **`viz-door-accessibility`**: 14 doors, 6 fail (four 762 mm, two 813 mm), 8 pass (six 864 mm,
  two 1250 mm), 0 unknown.

`tests/studio/BimOpenFlow.BimWorkflows.Tests/VizSampleAnalysesTests.cs` checks that every graph validates
against the bim profile, evaluates all-green, carries a `view.note`, and has its spec.
