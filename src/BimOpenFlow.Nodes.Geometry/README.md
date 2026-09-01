# BimOpenFlow.Nodes.Geometry

The `view3d.*` node pack plus the library the host uses to serve renderable
geometry to the viewer. This is the only pack that touches meshing, which keeps
the native windows/x64 constraint (inherited from `Ara3D.Ifc.Mesher`) out of
every other pack.

3D content flows through graphs as tables. Mesh bytes never enter the graph:
the host loads a `ModelGeometry` (via `ModelGeometryCache`) and serves the
meshes to the viewer itself; nodes only produce and transform instance tables.

## Library

- `ModelGeometry.Load(path)` — meshes an IFC file (pure C# `Approach1Mesher`)
  into immutable meshes (`meshId` = index into `Meshes`) and a
  `GeometryInstance` list (index, meshId, transform, entityId, globalId,
  category, world bounds).
- `ModelGeometryCache.Load(path)` — same, cached process-wide by SHA-256 of the
  file contents, so identical content is meshed once and edited files miss.
- `geometry.ToInstanceTable()` — the instance table described below.

## Nodes

| Kind | Inputs | Params | Output |
|---|---|---|---|
| `view3d.instances` | — | `path` (FilePath) | instance table |
| `view3d.color` | instances, values | `joinColumn`, `valueColumn`, `colorMap` (viridis \| category10 \| redgreen) | instance table + `r g b a` |
| `view3d.isolate` | instances, ids | `joinColumn` | filtered instance table |
| `view3d.hide` | instances, ids | `joinColumn` | filtered instance table (inverse of isolate) |
| `view3d.opacity` | instances, ids (optional) | `alpha`, `joinColumn`, `scope` (matched \| others) | instance table + `a` |
| `view3d.spacing` | instances | `groupColumn`, `axis` (x \| y \| z), `spacing` | instance table + offsets |
| `view3d.arrange` | instances | `groupColumn`, `gap` | instance table + offsets (grid layout) |
| `view3d.decimate` | instances | `keepFraction`, `minDiagonal` | thinned instance table |
| `view3d.boundingBoxes` | instances | `groupColumn` (empty = per row) | boxes table |
| `view3d.voxelize` | instances | `size` | boxes table with per-voxel `count` |
| `view3d.camera` | — | `name`, `posX..posZ`, `targetX..targetZ` | camera table |

## Instance table columns

| Column | Type | Meaning |
|---|---|---|
| `instanceIndex` | Integer | Row id; index the host/viewer use to address the instance |
| `meshId` | Integer | Index into the model's mesh list |
| `entityId` | Integer | STEP express id of the IFC entity |
| `globalId` | Text | IfcRoot GlobalId (empty when unresolved) |
| `category` | Text | IFC entity name, e.g. `IFCWALLSTANDARDCASE` |
| `minX minY minZ maxX maxY maxZ` | Number | World-space bounding box |

`view3d.color` appends `r`, `g`, `b`, `a` (Number, 0..1 floats). Numeric value
columns map through the chosen gradient normalized over the column's min..max;
text value columns (or `category10`) map categorically, with palette indices
assigned by sorted distinct value so colors are stable under row reordering.
Unmatched rows get gray (0.5, 0.5, 0.5, 1).

Joins compare canonical invariant text of cells (integers plain, doubles
round-trip "R", booleans `true`/`false`), so an Integer `entityId` joins a Text
id column holding `"42"`.

### Alpha

The `a` column is honored on its own, without `r g b`: 0 hides the instance,
values between 0 and 1 fade it, 1 leaves it opaque. `view3d.opacity` writes only
`a`, preserving whatever colors are present.

### Offsets

`view3d.spacing` and `view3d.arrange` append optional `offsetX offsetY offsetZ`
(Number) columns. The 3D pane translates each instance by its offset on top of
the transform loaded with the model. Nodes that produce offsets accumulate onto
existing offset columns (so they chain) and shift `minX..maxZ` by the same
amount, keeping the bounds columns descriptive of the displayed position.

## Boxes table columns

Emitted on a port named `boxes` (table name `boxes`) by `view3d.boundingBoxes`
and `view3d.voxelize`. The 3D pane renders each row as an axis-aligned box
(an instanced unit cube), colored by `r g b a` when present, gray otherwise;
alpha semantics match instance tables.

| Column | Type | Meaning |
|---|---|---|
| `minX minY minZ maxX maxY maxZ` | Number | Required. World-space box |
| `r g b a` | Number | Optional, 0..1 |
| `label` | Text | Optional. Group value or row id |
| `count` | Integer | Optional. Voxel occupancy count |
| `voxelId` | Text | Optional. "x,y,z" cell indices (join key) |

## Camera table columns

One row per camera; the 3D pane consumes the first row.

| Column | Type |
|---|---|
| `name` | Text |
| `posX posY posZ` | Number |
| `targetX targetY targetZ` | Number |
