# Snowdon 3D toolkit graph

`snowdon-toolkit.json` is the graph the Snowdon graph demo at `/3d.html` opens
(see [docs/bim-flow-3d.md](../../docs/bim-flow-3d.md)). It shows every `view3d.*`
recipe kind composed on one model: a `view3d.scene` root feeding
`view3d.categoryStyle`, `view3d.section`, `view3d.sectionBox`, `view3d.explode`,
two `view3d.projection` nodes (plan and orthographic), a ghosted
`view3d.categoryStyle`, `view3d.environment`, `view3d.tint`, and
`view3d.sectionRange`: eleven nodes in all. Each node's output is a recipe
table (`operation` and JSON `input` columns) that the browser validates and
renders; no mesh bytes pass through the graph.

## Input

The scene node's `path` is the placeholder `{SNOWDON}`. The bim-profile host
seeds this graph on an empty store when `BIMOPENFLOW_SNOWDON` points to a BOS
file, or `Documents/BIM Open Schema/Snowdon Towers Sample Architectural.bos`
exists, and replaces the placeholder with that path. The model itself is
private and never committed; the Geometry pack's recipe nodes only record the
path, so the graph evaluates without reading it.

## Tests

- `tests/flow/BimOpenFlow.View3dWorkflows.Tests/View3dSampleTests.cs`,
  `SnowdonToolkitGraph_ComposesEveryRecipeWithoutReadingPrivateModelBytes`:
  the graph validates against the Bos and Geometry packs and every node
  evaluates Ok with the placeholder left in place.
- `scripts/check-bim-flow-3d.mjs` and `scripts/check-bim-flow-graph.mjs` drive
  the running demo against the real model.

## Converter facts (2026-09-26)

TKT-30 chunk C1. What `IfcToBosConverter` (`src/data/Ara3D.Ifc.Bos`) does with
each of the seven private Snowdon discipline IFC files at
`BIM_OPEN_SNOWDON_IFC` (default
`C:/Users/cdigg/git/3d-format-shootout/data/misc/Snowdon-IFC`), measured with a
throwaway harness (`scratch/SnowdonProbe`, not committed) that converts one
file at a time, disposes its `IfcFile`, and reads `Process.PeakWorkingSet64`
after each run. Counts below are BOS entities, parameters, and relations
after conversion (not the raw STEP entity counts in
`docs/proposals/snowdon-federation.md`).

**Kill criterion (C1): held, with headroom.** The Architectural file (95 MB,
the largest of the seven) converts in 14-19 seconds and peaks at about 1.2 GB
of working set, well under the 30-minute / 16 GB limit. No file threw or ran
out of memory.

| File | Bytes | Seconds | Peak working set | Entities | Parameters | Relations |
|---|---:|---:|---:|---:|---:|---:|
| Architectural | 95,187,347 | 14-19 | 1.25 GB | 19,382 | 181,277 | 20,671 |
| Structural | 10,062,106 | 3.6 | 280 MB | 3,381 | 75,828 | 3,433 |
| HVAC | 19,801,806 | 4.0 | 368 MB | 9,224 | 134,129 | 21,063 |
| Plumbing | 51,961,207 | 11.1 | 851 MB | 21,249 | 381,432 | 49,994 |
| Electrical | 18,053,778 | 4.4 | 317 MB | 8,046 | 89,210 | 11,442 |
| Facades | 15,015,724 | 5.3 | 270 MB | 1,774 | 11,545 | 1,103 |
| Site | 4,735,422 | 4.3-5.3 | 135 MB | 432 | 2,431 | 207 |

**IfcSpace `Other.Category` counts**, matching the proposal's Rooms/Areas/Spaces
split exactly:

| File | Rooms | Areas | Spaces |
|---|---:|---:|---:|
| Architectural | 54 | 100 | 0 |
| Structural | 0 | 7 | 0 |
| HVAC | 0 | 0 | 67 |
| Plumbing | 0 | 0 | 8 |
| Electrical | 0 | 0 | 80 |
| Facades | 0 | 0 | 0 |
| Site | 0 | 0 | 0 |

**Storey `Ifc:Elevation` values.** Every value the converter wrote matches
the proposal's feet table (`docs/proposals/snowdon-federation.md`, "Storeys")
exactly, storey for storey, file for file, including the two conflicts the
proposal calls out: Electrical's "L1 - Block 37" reads -3.5 ft against the
other files' -3.4583 ft (the 12.7 mm/0.0417 ft offset), and Facades' three
parapets read 47.4167 / 51.0833 / 54.5833 ft against Architectural's 47.6667
/ 51.1667 / 54.6667 ft. Structural's "L1_43_High" reads
-5.6e-15 (floating-point noise for 0.0). The elevation parameter is in the
file's declared unit (feet); the converter does not convert it, matching
Design item 1's "already true" note.

**Grid axis tags do not reach the BOS.** No file produces a parameter named
`Ifc:AxisTag`, or any parameter at all in group `IFCGRIDAXIS`. The `Entity.Name`
the converter records for an `IFCGRIDAXIS` is `.T.` or `.F.` (the boolean
`SameSense` attribute at index 2, read by `GetEntityLabel`), not the tag
string at attribute index 0. This confirms the plan's Design item 1: the
converter's generic property loop starts at attribute index 3 and never sees
the tag.

**Mesh coordinates are in metres, not feet, even though the file's declared
length unit is FOOT.** Five `IFCDOOR`-category mesh instances from
Architectural, scaled by their instance transform, have bounding boxes such as
1.02 x 0.15 x 2.24 (width x depth x height) — an ordinary door in metres (about
3.3 x 0.5 x 7.3 ft, an implausible door if read as feet, where it would be
under a metre tall). This means the converter's `IfcFile.ToModel3D()` geometry
path (the native `web-ifc` loader) normalizes lengths to metres independently
of `Ifc:Elevation` and other property values, which stay in the file's native
unit. An attempt to cross-check this with a world-space floor-to-floor height
(Architectural L1 to L2, 8.0833 ft / 2.4638 m apart by the elevation
parameter) gave 1.27, matching neither number cleanly; instance transforms
appear to carry a placement relative to a parent in the IFC placement
hierarchy rather than a flattened world position, so that check was
inconclusive and is not relied on here. The door bounding-box comparison is
the basis for "metres."

**Kept for later chunks.** C2 needs `IfcLengthUnit.Read` to record the file's
length unit and scale on `IFCPROJECT` regardless of what unit the mesh ends up
in; C8/C9's studio views only read parameter values (which are in the file's
unit), not mesh coordinates, so the metres-vs-feet mesh finding does not
change the plan, but the gap between geometry units and property units is
worth a one-line note if a later chunk ever mixes the two.
