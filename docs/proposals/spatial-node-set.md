# Spatial node set: geometric queries as table joins

> Proposal, 2026-09-18; implemented the same day (chunks 1 to 6 below, commits
> `72d335b`..`742ce5b`). A node pack, `BimOpenFlow.Nodes.Spatial` (kind prefix
> `spatial.*`), that gives graphs the predicate and measure vocabulary of a
> GIS database (nearest, within, intersects, contains, area, perimeter,
> volume) over the column conventions the packs already use for points,
> boxes, and footprints. Geometry math comes from `Ara3D.Geometry`; nothing
> here depends on DuckDB's spatial extension. Where the implementation
> departs from this text, the departure is noted in place; the list is
> collected under "As built" at the end.

## The problem

Three places in the toolkit answer "which elements are near, inside, or
overlapping which" and none of them share code:

- `bim.containment` and `bim.nearest` in the BimAnalysis pack. Both are
  brute-force O(n·m) joins, both only understand element centers, and each
  carries its own copy of the numeric-cell and copy-columns helpers
  (`BimNearestNode.cs:39` says so).
- `SpatialIndex` in `Ara3D.BimOpenSchema.DataModel`: a BVH with
  `Intersect(bounds)` and `WithinDistance(point, d)`. No node uses it.
- `view3d.boundingBoxes` and `view3d.voxelize` in the Geometry pack emit box
  tables, but nothing consumes those boxes as query geometry.

What a user cannot ask today, without a `duckdb.sql` node and hand-written
coordinate arithmetic: which ducts overlap which beams, which rooms lie
within 3 m of a stair, what a room's footprint perimeter is, which columns
fall inside a zone polygon, the three nearest fire extinguishers to each
room.

## What a GIS database gets right

PostGIS and DuckDB spatial succeed for one reason: geometry is a column
value, and a fixed set of predicates (`ST_Intersects`, `ST_DWithin`,
`ST_Contains`) and measures (`ST_Area`, `ST_Length`) works over any table
that has such a column. A spatial join is an ordinary join whose ON clause
is a predicate.

The toolkit already has half of this. Its geometry-as-columns convention
(`X/Y/Z` for a point, `MinX..MaxZ` for a box) keeps every wire a plain
table, which is exactly what makes it a good bridge to SQL: the result of a
spatial node is a table DuckDB or any other consumer can read with no
extension loaded. What is missing is the other half: one pack that treats
those conventions as shape types and offers the standard predicate set over
them.

## Shape conventions

The pack recognizes three shapes, each carried by ordinary columns. A node
reads a shape from a table by these names, case-insensitively, so the
`minX` spelling of the Geometry pack's boxes table and the `MinX` spelling of
`bim.bounds` both work.

| Shape | Columns | Produced today by |
|---|---|---|
| Point | three Number columns, named by the `x`, `y`, `z` params (default `CenterX`, `CenterY`, `CenterZ`) | `bim.bounds`, `bim.rooms`, `bim.paramTable` (Point parameters) |
| Box | `MinX MinY MinZ MaxX MaxY MaxZ` | `bim.bounds`, `bim.rooms`, `view3d.boundingBoxes`, `view3d.voxelize` |
| Polygon | one Text column holding WKT, `POLYGON((x y, x y, ...))`, named by the `polygon` param (default `Footprint`) | `spatial.footprint` (new); any CSV or SQL source |

A point is a degenerate box, so every box predicate accepts a point table.
Polygons are 2D, in plan (XY). WKT is the wire format because DuckDB
spatial, PostGIS, GeoPandas, and QGIS all read it unchanged; a polygon column
produced here can go straight into `ST_Area` elsewhere and vice versa. Only
the outer ring is read; holes are ignored with a warning. Implementation
note: WKT reading and writing is a small in-pack module (`Wkt.cs`) covering
`POINT` and `POLYGON`; anything more is an extension point.

Every join node takes a `key` column for each side (default `Name`, matching
`bim.*`) and emits a **pairs table**: `A`, `B`, and a measure. This is the
GIS join model; `table.join` brings the rest of either side's columns back
when wanted. It is a deliberate change from `bim.nearest`, which appends
columns to its left input and can therefore only answer k = 1.

## Nodes

All nodes are Pure. Box predicates are axis-aligned-box semantics: results
are candidates, not mesh clashes or clearances, and the docs for each node
say so.

| Kind | Inputs | Params | Output |
|---|---|---|---|
| `spatial.intersects` | boxes `a`, boxes `b` | `aKey`, `bKey`, `excludeSelf` | pairs + `OverlapVolume` |
| `spatial.within` | `a`, `b` (boxes or points) | `aKey`, `bKey`, `distance`, `measure` (box \| center) | pairs + `Distance` |
| `spatial.nearest` | `a`, `b` (boxes or points) | `aKey`, `bKey`, `k` (default 1), `measure` | pairs + `Distance`, `Rank` |
| `spatial.contains` | `a` (boxes or points), `boxes` | `aKey`, `bKey`, `smallest` (default true), `ignoreZ` | pairs + `ContainerVolume` |
| `spatial.footprint` | boxes | `key`, `as` (default `Footprint`) | input columns + WKT rectangle, `FootprintArea`, `Perimeter` |
| `spatial.polygon` | table with a polygon column | `polygon` | input columns + `Area`, `Perimeter`, `CentroidX`, `CentroidY`, `Vertices`, `IsConvex` |
| `spatial.polygonContains` | points `a`, polygons `b` | `x`, `y`, `aKey`, `bKey`, `polygon` | pairs + `Area` of the container |
| `spatial.polygonIntersects` | polygons `a`, polygons `b` | `aKey`, `bKey`, `polygon`, `excludeSelf` | pairs |

`measure = box` is surface-to-surface distance between boxes, zero when they
overlap; `center` is the distance between box centers, which is what
`bim.nearest` computes. `excludeSelf` drops pairs whose two keys are equal,
so a table joined to itself (all clash candidates in one model) does not
report every element against itself.

Complexity: every box join builds an `AabbTree` (from `Ara3D.Geometry`) over
`b` and queries it once per `a` row, so the cost is O((n + m) log m) plus the
output size, instead of O(n·m). Polygon joins use each polygon's bounds as
the tree key and the exact polygon test only on candidates.

### What comes from Ara3D.Geometry

| Need | API |
|---|---|
| Candidate box and point queries | `AabbTree`, `QueryOverlaps`, `QueryPoint` |
| Polygon area, perimeter, centroid, convexity | `PolygonOps.Area`, `.Perimeter`, `.Centroid`, `.IsConvex` |
| Point in polygon | `PolygonOps.Contains` / `ContainsStrict` |
| Polygon edge crossing | `PolygonOps.SegmentsIntersect` over `Edges()` |
| Polygon bounds | `PolygonOps.GetBounds` |

Exact box arithmetic (overlap volume, box-to-box distance) is done in double
precision in the pack, because the SDK types are single precision and the
tree is only used to find candidates. The Plato-generated `Bounds3D.Overlaps`
is corner-based and misses boxes that cross without a corner inside the
other, so it is not used.

### Not in this pack

- **True mesh measures** (surface area, closed-mesh volume, oriented
  bounding box, length and width). Only the Geometry pack may touch meshes,
  because of the native x64 mesher. This becomes one `view3d.measures` node
  there, emitting an entity-keyed table: `SurfaceArea`, `MeshVolume`,
  `TriangleCount`, plus OBB extents. That table is the real BIM-to-SQL
  bridge for quantities, and it is a separate chunk.
- **Exact mesh-vs-mesh predicates** (triangle clash, point in mesh). A much
  larger project; `spatial.intersects` output is the candidate list such a
  project would consume.
- **Polygon boolean operations** (union, difference, buffer). Not in
  `Ara3D.Geometry` today; adding them there is the right home, not here.
- **Coordinate reference systems.** Everything is in model coordinates.

## Migration

`bim.containment` and `bim.nearest` stay as they are. The samples
`bim-room-containment` and `bim-nearest-door` keep working. Once the
`spatial.*` versions have a sample each, a follow-up decides whether the two
`bim.*` nodes become thin aliases or are removed at a version bump. The
duplicated `Numeric` and `CopyColumns` helpers move to
`BimOpenFlow.Nodes.Support` as part of this work; the `bim.*` copies are
left in place and the TODO stays until that follow-up.

## Chunks

1. Support helpers: `TableColumns.CellNumber` and `CopyBuilder`.
2. Pack skeleton: project, `SpatialNodes.All`, README, shape readers
   (`Shapes.cs`), `Wkt.cs`, registered in the bim profile and NodeDocs;
   layering test green.
3. `spatial.intersects`, `spatial.within`, `spatial.nearest`,
   `spatial.contains`, each with unit tests.
4. `spatial.footprint`, `spatial.polygon`, `spatial.polygonContains`,
   `spatial.polygonIntersects`, each with unit tests.
5. Samples in `samples/bim-analyses`: clash candidates (ducts against
   structure), rooms within 3 m of a stair, room footprints with perimeter.
6. `view3d.measures` in the Geometry pack.
7. Regenerate `docs/nodes.md`; review; sweep.

## As built

Departures from the text above, in the order they were made:

- **One `x`, `y`, `z` param triple per node, applied to both sides.** The
  table proposed `aKey`/`bKey` but only one set of point columns; six point
  params would have doubled the parameter list for the common case where
  both sides come from `bim.*` tables. Each side still decides box versus
  point on its own.
- **`spatial.footprint` emits only the WKT column.** Area and perimeter
  come from `spatial.polygon`, so a `bim.bounds` table (which already has
  `FootprintArea`) never collides. Shape conversion and measurement are
  separate nodes.
- **Area-weighted centroid is computed in the pack.** `PolygonOps.Centroid`
  is the vertex average, which is not the GIS `ST_Centroid`. Everything else
  polygonal (area, perimeter, convexity, point containment, edge crossing)
  is the SDK's.
- **Polygons are handed to the SDK translated to their bounds minimum.** The
  SDK is single precision; translating first makes rounding scale with a
  polygon's extent instead of with site coordinates (tested at 500 000 m).
- **`view3d.measures` has no oriented-bounding-box columns.** It emits
  `surfaceArea`, `meshVolume`, `triangleCount` with the instance keys. OBB
  extents (length and width) stay an extension point; `MeshFeatures` in the
  SDK has the PCA to build them from.
- **The pack is in both host profiles.** It is BIM-free, so the tables
  profile gets it too.
- **The `bim.*` copies of `Numeric` and `CopyColumns` are untouched**, as
  planned; the migration of `bim.containment` and `bim.nearest` is the
  open follow-up. Their samples still pass.

Samples added: `bim-duct-rooms`, `bim-door-rooms`, `bim-room-footprints`.

Open items: the `bim.*` migration; OBB extents; polygon booleans in the
SDK; MULTIPOLYGON and holes in `Wkt` if a real source needs them.
