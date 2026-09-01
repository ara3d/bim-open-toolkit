# BimOpenFlow node reference

> GENERATED FILE — do not edit by hand. This file is produced by the
> `BimOpenFlow.NodeDocs` tool from the node packs' `NodeSpec` declarations.
> To change it, change the specs or the generator and regenerate.

A node is a pure function over flow values. Values travel along graph edges
as one of five kinds — Boolean, Integer, Number, Text, or Table — and tables
are the currency: almost everything useful is an immutable table flowing
from node to node. A node reads its input values and parameters, and
returns its output values. It holds no state between evaluations.

**Pure vs Effect.** Pure nodes may be evaluated freely and their results
memoized; evaluating one twice with the same inputs gives the same answer
and touches nothing outside the graph. Effect nodes (file writers, report
generators) execute only inside an explicit Run — the engine refuses to
evaluate them otherwise — so re-evaluation for display can never write to
disk behind your back.

**Required vs optional inputs.** A node is normally not ready to evaluate
until every input port is connected. A port marked optional is the
exception: left unconnected, it does not block evaluation — the node
receives a placeholder in that position and treats the input as absent.
The placeholder never flows along an edge and is never an output.

**Parameters.** Parameters are configuration, not wires: every value is
stored in canonical string form in the graph document, and each parameter
declares a kind (Boolean, Integer, Number, Text, Enum, FilePath, ModelRef,
Expression, Json) that says how the string is interpreted and edited. Enum
parameters list their allowed values; an empty default means the parameter
starts blank. A parameter may also declare a suggestion source (the
columns of a table input, or the tables in the file another parameter
names): editors offer those values as a live pull-down, but they are
advisory only — any string is accepted, and validation stays an
evaluation-time concern (see docs/proposals/live-param-suggestions.md).

**File-reading nodes and caching.** Nodes that read files (`bos.load`,
`duck.read`, `xlsx.read`, `view3d.instances`) are pure despite touching
disk: the cache key is a hash of the file's content, so an unchanged file
is never re-read and an edited file is picked up automatically — the key
is the content itself, not the path or a timestamp.

## Packs

| Pack | Nodes | Kinds |
|---|---|---|
| BOS — `BimOpenFlow.Nodes.Bos` | 6 | `bos.load`, `bos.query`, `table.filter`, `table.derive`, `table.aggregate`, `table.sort` |
| BIM analysis — `BimOpenFlow.Nodes.BimAnalysis` | 12 | `bim.elements`, `bim.rooms`, `bim.levels`, `bim.bounds`, `bim.paramTable`, `bim.paramCoverage`, `bim.discipline`, `bim.classifyRooms`, `bim.containment`, `bim.nearest`, `bim.navGraph`, `bim.hops` |
| Geometry — `BimOpenFlow.Nodes.Geometry` | 11 | `view3d.instances`, `view3d.color`, `view3d.isolate`, `view3d.hide`, `view3d.opacity`, `view3d.spacing`, `view3d.arrange`, `view3d.decimate`, `view3d.boundingBoxes`, `view3d.voxelize`, `view3d.camera` |
| Compliance — `BimOpenFlow.Nodes.Compliance` | 4 | `check.rule`, `check.required`, `check.rollup`, `check.union` |
| Effects — `BimOpenFlow.Nodes.Effects` | 8 | `sink.exportCsv`, `sink.exportParquet`, `sink.exportJson`, `sink.exportXlsx`, `sink.exportSqlite`, `sink.exportDuckDb`, `sink.writePsets`, `sink.report` |
| DuckDB — `BimOpenFlow.Nodes.DuckDb` | 8 | `duck.read`, `duck.query`, `sql.query`, `csv.read`, `parquet.read`, `json.read`, `duck.table`, `duck.tables` |
| Tables — `BimOpenFlow.Nodes.Tables` | 11 | `xlsx.read`, `xlsx.sheets`, `sqlite.query`, `sqlite.table`, `sqlite.tables`, `table.join`, `table.setOp`, `table.project`, `table.inline`, `table.range`, `table.calendar` |
| TableOps — `BimOpenFlow.Nodes.TableOps` | 14 | `table.cast`, `table.concat`, `table.distinct`, `table.drop`, `table.limit`, `table.pivot`, `table.profile`, `table.rename`, `table.sample`, `table.schema`, `table.splitColumn`, `table.transpose`, `table.unpivot`, `table.window` |
| Cleaning — `BimOpenFlow.Nodes.Cleaning` | 6 | `table.fillNulls`, `table.dropNulls`, `table.dedupe`, `table.replace`, `text.transform`, `text.extract` |
| Dates — `BimOpenFlow.Nodes.Dates` | 6 | `date.parse`, `date.part`, `date.truncate`, `date.diff`, `date.offset`, `date.filter` |
| Viz — `BimOpenFlow.Nodes.Viz` | 3 | `chart.bar`, `chart.line`, `view.table` |

## BOS — `BimOpenFlow.Nodes.Bos`

Loading BIM Open Schema (.bos) files and the core table transforms: filter, derive, aggregate, sort.

### `bos.load` (v1) — Pure

Loads a BIM Open Schema (.bos) file and outputs its entity, parameter, and relation text tables.

Loads the .bos file into an in-memory DuckDB once and outputs three materialized text views: `entities`, `parameters`, and `relations`, each deterministically ordered. Results are cached per (file content hash, harmonize flag), so re-evaluations of unchanged content never reload and edits to the file are picked up automatically. With `harmonize` true, the data is passed through the BOS harmonizer (appends SI canonical columns) before the views are built. A missing file is an error.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `entities` | Table |
| `parameters` | Table |
| `relations` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `harmonize` | Boolean | `false` | — | — |

### `bos.query` (v1) — Pure

Runs one read-only SQL query over the input table, available as 't'.

The input table is loaded into an in-memory DuckDB as table `t`. The query must be read-only. The node predates `sql.query`, which generalizes it to four inputs.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `sql` | Text | — | — | — |

### `table.filter` (v1) — Pure

Keeps rows where the Boolean expression is true; null results exclude the row.

The expression must be statically Boolean; a non-Boolean expression is an error. A row is kept only when the expression is true — a null result excludes the row (SQL WHERE semantics).

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `expr` | Expression | — | — | — |

### `table.derive` (v1) — Pure

Outputs the input table plus one computed column.

The new column's type comes from the expression's static type; rows where the expression is null get a null cell. It is an error if the column name already exists, or if the expression is always null (no type can be inferred).

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `name` | Text | — | — | — |
| `expr` | Expression | — | — | — |

### `table.aggregate` (v1) — Pure

Groups by the comma-separated groupBy columns (may be empty) and computes comma-separated 'func(column) as name' aggregates (count/sum/min/max/avg).

Runs via DuckDB. Each aggregate is written `func(column) as name` with funcs count, sum, min, max, avg; only count accepts `*`. Sums are cast (BIGINT for integer columns, DOUBLE otherwise) so the result type is predictable. `groupBy` may be empty (one summary row); when present, output rows are ordered by the group columns for determinism.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `groupBy` | Text | — | — | columns of input `table` |
| `aggregates` | Text | — | — | — |

### `table.sort` (v1) — Pure

Sorts by comma-separated column names, each optionally suffixed with ' desc'.

Runs via DuckDB. Each comma-separated term is a column name with an optional ` desc` (or explicit ` asc`) suffix. Column names containing commas or spaces cannot currently be expressed.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `by` | Text | — | — | columns of input `table` |

## BIM analysis — `BimOpenFlow.Nodes.BimAnalysis`

The bim.* pack: grouping tables (elements, rooms, levels), typed parameter tables and coverage, bounding boxes with dimensions, spatial joins, discipline and room classification, and door navigation graphs.

### `bim.elements` (v1) — Pure

Loads a .bos file into one row per element: EntityIndex, LocalId, GlobalId, Name, Category, CategoryType, Type, ClassName, Level, Elevation, Room, Document, Workset, Group. The grouping workhorse: feed it to table.aggregate, bim.discipline, or bim.classifyRooms.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |

### `bim.rooms` (v1) — Pure

Loads a .bos file into one row per room: EntityIndex, Name, Number, Level, Elevation, Volume, UnboundedHeight, ElementCount (elements whose Room/Space parameter points here), and when bounds exist MinX..MaxZ, SizeX/Y/Z, CenterX/Y/Z, FootprintArea. Rooms are the elements whose category is in the comma-separated 'categories' list.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `categories` | Text | `Rooms,Spaces` | — | — |

### `bim.levels` (v1) — Pure

Loads a .bos file into one row per level, ordered by elevation: EntityIndex, Name, Elevation, ElementCount (elements whose Level parameter points here), RoomCount. Levels are the elements carrying a level-elevation parameter or categorized as Levels.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |

### `bim.bounds` (v1) — Pure

Loads a .bos file into one row per element that has bounds: EntityIndex, Name, Category, Level, MinX..MaxZ, SizeX/Y/Z, CenterX/Y/Z, FootprintArea (SizeX*SizeY), Volume (box volume), Diagonal. Feeds bim.containment, bim.nearest, and dimension analyses.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |

### `bim.paramTable` (v1) — Pure

Loads a .bos file into one row per element with EntityIndex, Name, Category plus one typed column per requested parameter ('parameters' is a comma-separated list of full descriptor names, e.g. Rvt:Room:Volume). Columns take the short name after the last colon (the full name on collision); Int maps to integer, Number to double, String and Entity to text, and Point parameters expand to three .X/.Y/.Z double columns.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `parameters` | Text | — | — | — |

### `bim.paramCoverage` (v1) — Pure

Profiles a long parameter table (the bos.load parameters output: EntityIndex, Name, ParameterGroup, Units, ValueType, Value) into one row per parameter name: Name, ParameterGroup, ValueType, Count, Distinct, FillRate (share of the input's distinct entities that carry the parameter), ordered by Count descending.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `parameters` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**: none

### `bim.discipline` (v1) — Pure

Adds a Discipline column (Architecture, Structure, Mechanical, Electrical, Plumbing, FireProtection, Site, or General) classified from the category column by a built-in mapping of common Revit categories and IFC classes; 'overrides' is an optional JSON object of {"category": "discipline"} entries that win over the built-ins. Unmatched categories get General.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `column` | Text | `Category` | — | columns of input `table` |
| `overrides` | Json | — | — | — |

### `bim.classifyRooms` (v1) — Pure

Adds a room class column ('as', default RoomClass) by matching the name column against ordered case-insensitive regex rules; first match wins, no match gets Other. The built-in ruleset covers Office, Meeting, Circulation, Stair, Elevator, Sanitary, Kitchen, Storage, Mechanical, Residential, and Parking; 'rules' is an optional JSON array of {"class": ..., "pattern": ...} that replaces it.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `column` | Text | `Name` | — | columns of input `table` |
| `rules` | Json | — | — | — |
| `as` | Text | `RoomClass` | — | — |

### `bim.containment` (v1) — Pure

Adds a column ('as') to the points table holding the 'key' of the smallest box row whose MinX..MaxZ box contains the point (x, y, z); rows in no box get null. With ignoreZ, containment is tested in plan (XY) only. Typical use: element centers from bim.bounds against room boxes from bim.rooms, when the model has no room parameters.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `points` | Table | required |
| `boxes` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `x` | Text | `CenterX` | — | columns of input `points` |
| `y` | Text | `CenterY` | — | columns of input `points` |
| `z` | Text | `CenterZ` | — | columns of input `points` |
| `key` | Text | `Name` | — | columns of input `boxes` |
| `as` | Text | `ContainedIn` | — | — |
| `ignoreZ` | Boolean | `false` | — | — |

### `bim.nearest` (v1) — Pure

Adds two columns to a: 'as' (default Nearest) holding the 'key' of the closest b row by 3D distance between (x,y,z) and (bx,by,bz), and Distance holding that distance. Rows with null coordinates, or when b is empty, get nulls. Typical use: distance from each room center to the nearest exit door.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `a` | Table | required |
| `b` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `x` | Text | `CenterX` | — | columns of input `a` |
| `y` | Text | `CenterY` | — | columns of input `a` |
| `z` | Text | `CenterZ` | — | columns of input `a` |
| `bx` | Text | `CenterX` | — | columns of input `b` |
| `by` | Text | `CenterY` | — | columns of input `b` |
| `bz` | Text | `CenterZ` | — | columns of input `b` |
| `key` | Text | `Name` | — | columns of input `b` |
| `as` | Text | `Nearest` | — | — |

### `bim.navGraph` (v1) — Pure

Loads a .bos file into one row per door in the given categories: Door (entity index), DoorName, Level, FromRoom, ToRoom — the rooms from the door's from/to-room parameters, labelled 'Name Number' (so two Corridors on different floors stay distinct), with Outside standing in for a missing side. The rows are the undirected edges of the room navigation graph; feed them to bim.hops for reachability.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `doorCategories` | Text | `Doors` | — | — |

### `bim.hops` (v1) — Pure

Walks the undirected graph whose edges are the (from, to) column pairs, breadth-first from the 'start' room, into one row per room seen in either column: Room, Hops (0 for the start, null for unreachable rooms), ordered by Hops then Room. An unknown start room is an error. Typical input: the bim.navGraph edge table.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `edges` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `from` | Text | `FromRoom` | — | columns of input `edges` |
| `to` | Text | `ToRoom` | — | columns of input `edges` |
| `start` | Text | — | — | — |

## Geometry — `BimOpenFlow.Nodes.Geometry`

The view3d pack: the tables the 3D pane consumes — instances, colors, isolation, camera.

### `view3d.instances` (v1) — Pure

Renderable instances of a model file as a table: one row per placed mesh, with entity ids and world bounds.

One row per placed mesh, with entity ids and world bounds. The loaded geometry is cached by file content hash.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `instances` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |

### `view3d.color` (v1) — Pure

Adds r,g,b,a color columns to an instance table by joining a value table on a shared column.

Numeric value columns map through a gradient normalized over the column's min..max range; text values map categorically, with palette indices assigned by sorted distinct value so colors are stable under row reordering. A non-numeric value column with a gradient colorMap warns and falls back to category10. Instance rows with no match in the value table get gray; alpha is always 1.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `instances` | Table | required |
| `values` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `instances` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `joinColumn` | Text | — | — | — |
| `valueColumn` | Text | — | — | — |
| `colorMap` | Enum | `viridis` | `viridis`, `category10`, `redgreen` | — |

### `view3d.isolate` (v1) — Pure

Keeps only the instance rows whose join column value appears in the ids table.

The ids table is matched on its column with the same name as `joinColumn`, or its first column when no such column exists.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `instances` | Table | required |
| `ids` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `instances` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `joinColumn` | Text | — | — | — |

### `view3d.hide` (v1) — Pure

Removes the instance rows whose join column value appears in the ids table.

The exact inverse of `view3d.isolate`: rows whose join key appears in the ids table are removed; rows with a null join key are kept. Same ids-column lookup (same name as `joinColumn`, else the first column).

**Inputs**

| Name | Type | Required |
|---|---|---|
| `instances` | Table | required |
| `ids` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `instances` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `joinColumn` | Text | — | — | columns of input `instances` |

### `view3d.opacity` (v1) — Pure

Sets the alpha column of an instance table, for all rows or for rows matched against an ids table.

Writes only the `a` column (added with default 1 when absent); existing colors are untouched, and the 3D pane honors `a` even without r/g/b — 0 hides, fractions fade. The ids input is optional: without it every row gets the alpha; with it, scope `matched` fades the matching rows and `others` fades everything else, while unassigned rows keep their current alpha.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `instances` | Table | required |
| `ids` | Table | optional |

**Outputs**

| Name | Type |
|---|---|
| `instances` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `alpha` | Number | `0.25` | — | — |
| `joinColumn` | Text | — | — | columns of input `instances` |
| `scope` | Enum | `matched` | `matched`, `others` | — |

### `view3d.spacing` (v1) — Pure

Offsets each group of instances along an axis by its group index times the spacing.

Explode-by-column: groups are the sorted distinct values of `groupColumn` and group i moves i x spacing along the axis. Offsets accumulate onto existing offsetX/Y/Z columns so spacing nodes chain, and the bounds columns are shifted to match. Null-group rows stay in place.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `instances` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `instances` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `groupColumn` | Text | — | — | columns of input `instances` |
| `axis` | Enum | `x` | `x`, `y`, `z` | — |
| `spacing` | Number | `10` | — | — |

### `view3d.arrange` (v1) — Pure

Arranges each group of instances into its own cell of a ground-plane grid.

Parts-catalog layout: each group gets a cell in a square XY grid sized by the largest group footprint plus the gap, moved so its bounds minimum lands at the cell origin; Z is unchanged. Offset/bounds column handling matches `view3d.spacing`.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `instances` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `instances` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `groupColumn` | Text | — | — | columns of input `instances` |
| `gap` | Number | `5` | — | — |

### `view3d.decimate` (v1) — Pure

Keeps only the largest instances: a minimum bounds diagonal, then the top fraction by volume.

Instance thinning, not mesh simplification: drops rows with a bounds diagonal under `minDiagonal`, then keeps the top `keepFraction` of the remainder by bounds volume (ties to the earlier row), preserving row order. An out-of-range fraction warns and clamps.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `instances` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `instances` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `keepFraction` | Number | `0.25` | — | — |
| `minDiagonal` | Number | `0` | — | — |

### `view3d.boundingBoxes` (v1) — Pure

Emits the axis-aligned bounding boxes of instances, per row or unioned per group.

Emits a boxes table (see the Geometry README): one box per row, or with `groupColumn`, one union box per sorted distinct group value with null-group rows under "(none)". Labels fall back globalId, then instanceIndex, then row number; r/g/b/a carry through when all four columns exist (group mode: first row's color).

**Inputs**

| Name | Type | Required |
|---|---|---|
| `instances` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `boxes` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `groupColumn` | Text | — | — | columns of input `instances` |

### `view3d.voxelize` (v1) — Pure

Emits the occupied voxels of the instances' bounding boxes as a boxes table with per-voxel counts.

AABB rasterization, not triangle-accurate: every voxel overlapped by an instance bounding box is emitted with a `count` of overlapping instances and a `voxelId` join key for coloring. The grid spans the union bounds; a size that would exceed 2,000,000 voxels is doubled until it fits, with a warning.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `instances` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `boxes` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `size` | Number | `1` | — | — |

### `view3d.camera` (v1) — Pure

A named camera as a one-row table: position and look-at target.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `camera` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `name` | Text | `default` | — | — |
| `posX` | Number | `0` | — | — |
| `posY` | Number | `0` | — | — |
| `posZ` | Number | `0` | — | — |
| `targetX` | Number | `0` | — | — |
| `targetY` | Number | `0` | — | — |
| `targetZ` | Number | `0` | — | — |

## Compliance — `BimOpenFlow.Nodes.Compliance`

The verdict-bearing vocabulary: rule checks, required-data checks, rollups, and unions of verdict tables.

### `check.rule` (v1) — Pure

Per row: expr true = Pass, false = Fail (NeedsReview where reviewExpr is true), null = InfoNotAvailable.

Per row: `expr` true is Pass; false is Fail, unless `reviewExpr` is also true, which makes it NeedsReview; a null result (missing data) is InfoNotAvailable. An empty `reviewExpr` means false never escalates to NeedsReview. The output is the input columns plus the verdict columns (`verdict`, `checkId`, `checkTitle`, `citation`).

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `checkId` | Text | — | — | — |
| `title` | Text | — | — | — |
| `citation` | Text | — | — | — |
| `expr` | Expression | — | — | — |
| `reviewExpr` | Expression | — | — | — |

### `check.required` (v1) — Pure

Required data check: missing column = InfoNotAvailable everywhere; null cell = Fail; else Pass.

If any listed column is missing from the table, the node warns and every row is InfoNotAvailable. Otherwise a row with a null cell in any listed column is Fail, else Pass. Data absence is reported, never skipped.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `checkId` | Text | — | — | — |
| `title` | Text | — | — | — |
| `citation` | Text | — | — | — |
| `columns` | Text | — | — | — |

### `check.rollup` (v1) — Pure

Groups a verdict table by checkId into counts and the worst verdict per check.

Input must be a verdict table. Output has one row per checkId in first-appearance order, with per-verdict counts (`passCount`, `failCount`, `needsReviewCount`, `infoNotAvailableCount`) and `worst`, the worst verdict present by severity Fail > NeedsReview > InfoNotAvailable > Pass.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**: none

### `check.union` (v1) — Pure

Concatenates two verdict tables with identical columns; chain for more.

Both inputs must be verdict tables with identical column-name sequences; the output is a's rows followed by b's. The spec cannot express variadic inputs, so the node takes exactly two — chain unions to combine more tables.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `a` | Table | required |
| `b` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**: none

## Effects — `BimOpenFlow.Nodes.Effects`

Every Run-gated sink: CSV export, IFC property-set write-back, and HTML reports.

### `sink.exportCsv` (v1) — Effect

Writes the input table as RFC-4180 CSV (invariant formatting; configurable delimiter, optional header row). Outputs a one-row summary (path, rowCount).

Effect: runs only inside a Run. Writes the table as RFC-4180 CSV with invariant formatting. `delimiter` swaps the comma for any text (cells containing it are quoted accordingly) and `header` false drops the header row. The file is replaced atomically.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `delimiter` | Text | `,` | — | — |
| `header` | Boolean | `true` | — | — |

### `sink.exportParquet` (v1) — Effect

Writes the input table as a Parquet file (zstd, snappy, or uncompressed). Outputs a one-row summary (path, rowCount).

Effect: runs only inside a Run. Writes the table as a Parquet file, the hand-off format for Power BI and data pipelines. `compression` picks zstd (default, smallest), snappy (fastest to read), or none. Replaced atomically.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `compression` | Enum | `zstd` | `zstd`, `snappy`, `none` | — |

### `sink.exportJson` (v1) — Effect

Writes the input table as JSON: 'records' is one array of objects (optionally indented), 'lines' is newline-delimited objects. Outputs a one-row summary (path, rowCount).

Effect: runs only inside a Run. Writes the table as JSON: `records` is one array of objects (set `indent` for human-readable output), `lines` is newline-delimited JSON, one object per line, for streaming pipelines.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `layout` | Enum | `records` | `records`, `lines` | — |
| `indent` | Boolean | `false` | — | — |

### `sink.exportXlsx` (v1) — Effect

Writes the input table to an Excel workbook sheet. 'replaceFile' writes a fresh single-sheet workbook; 'replaceSheet' refreshes one sheet of an existing workbook, leaving other sheets alone (the file is created if absent). Outputs a one-row summary (path, rowCount, sheet).

Effect: runs only inside a Run. Writes the table to one sheet of an Excel workbook. `replaceFile` produces a fresh single-sheet file; `replaceSheet` refreshes only the named sheet of an existing workbook, so people keep their own tabs while the graph owns this one. Header can be bold and columns auto-fit.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `sheet` | Text | `Sheet1` | — | — |
| `mode` | Enum | `replaceFile` | `replaceFile`, `replaceSheet` | — |
| `autoWidth` | Boolean | `true` | — | — |
| `headerBold` | Boolean | `true` | — | — |

### `sink.exportSqlite` (v1) — Effect

Writes the input table into a SQLite database (booleans/integers as INTEGER, numbers as REAL, text as TEXT). 'replace' drops and recreates the table, 'append' adds rows to a column-compatible table, 'failIfExists' refuses to touch an existing one. Outputs a one-row summary (path, rowCount, table).

Effect: runs only inside a Run. Writes the table into a SQLite database in one transaction: `replace` drops and recreates it, `append` adds rows to a table with the same columns, `failIfExists` refuses to touch an existing one. Booleans and integers become INTEGER, numbers REAL, everything else TEXT; other tables in the database are untouched.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `table` | Text | — | — | — |
| `mode` | Enum | `replace` | `replace`, `append`, `failIfExists` | — |

### `sink.exportDuckDb` (v1) — Effect

Writes the input table into a DuckDB database file (booleans/integers as BIGINT, numbers as DOUBLE, text as VARCHAR). 'replace' drops and recreates the table, 'append' adds rows to a column-compatible table, 'failIfExists' refuses to touch an existing one. Outputs a one-row summary (path, rowCount, table).

Effect: runs only inside a Run. Writes the table into a DuckDB database file — the only node that ever opens one writable — with the same replace/append/failIfExists modes, transactionally. Build a curated database here, query it back with duck.query or duck.table.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `table` | Text | — | — | — |
| `mode` | Enum | `replace` | `replace`, `append`, `failIfExists` | — |

### `sink.writePsets` (v1) — Effect

Byte-exact pset write-back: reads sourcePath, appends psets from the input table, writes targetPath. Outputs a one-row summary (targetPath, entitiesTouched, valuesWritten).

Effect: runs only inside a Run. Input rows (`entityId`, `psetName`, `paramName`, `paramValue`) are grouped by (entityId, psetName) in first-appearance order; each group becomes one IfcPropertySet attached to the entity, appended to a byte-exact copy of the source file. An entity id not present in the source file is an error. v1 limitation: every value is written as IFCTEXT; typed measures come later.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `sourcePath` | FilePath | — | — | — |
| `targetPath` | FilePath | — | — | — |

### `sink.report` (v1) — Effect

Writes a standalone HTML report (title + table). Outputs a one-row summary (path, rowCount).

Effect: runs only inside a Run. The report is a minimal standalone HTML page: the title followed by the table.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `title` | Text | — | — | — |

## DuckDB — `BimOpenFlow.Nodes.DuckDb`

File readers backed by DuckDB and SQL over flowing tables. BIM-free; every value is a plain table.

### `duck.read` (v1) — Pure

Loads a CSV, Parquet, or JSON file into a table using DuckDB's readers.

With `format` auto, the reader is inferred from the file extension (.csv, .parquet, .json); any other extension is an error telling you to set `format`. The loaded table is cached by (file content hash, reader), so unchanged files never reload. A missing file is an error.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `format` | Enum | `auto` | `auto`, `csv`, `parquet`, `json` | — |

### `duck.query` (v1) — Pure

Runs one read-only SQL query against a .duckdb database file.

The database file is opened read-only (the node can never mutate it), and the SQL is validated as a single SELECT or WITH statement before it runs.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `sql` | Text | — | — | — |

### `sql.query` (v1) — Pure

Runs one read-only SQL query over the connected input tables t1..t4 (t = t1).

Connected inputs load into an in-memory DuckDB as `t1`..`t4`, and `t` is a view of `t1`, so single-table queries can just say `FROM t`. Ports `t2`..`t4` are optional: unconnected ones are simply absent from the database. The SQL is validated as a single read-only SELECT or WITH statement. The dialect is DuckDB's.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `t1` | Table | required |
| `t2` | Table | optional |
| `t3` | Table | optional |
| `t4` | Table | optional |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `sql` | Text | — | — | — |

### `csv.read` (v1) — Pure

Reads a CSV file or glob of files into a table, with typed delimiter, header, skip, quote, null-text, and encoding options.

Reads one CSV file or a glob of files via DuckDB `read_csv`, with typed delimiter, quote, header, skip-rows, null-text, encoding, and type-inference options. A glob unions every matching file and appends a `filename` column so provenance survives; a glob matching nothing, like a missing file, is an error. With `header` false, columns are named Column1..N. Results are cached by file content hash plus parameter values.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `delimiter` | Text | `,` | — | — |
| `header` | Boolean | `true` | — | — |
| `skipRows` | Integer | `0` | — | — |
| `quote` | Text | `"` | — | — |
| `nullText` | Text | — | — | — |
| `encoding` | Enum | `utf8` | `utf8`, `utf16`, `latin1` | — |
| `inferTypes` | Boolean | `true` | — | — |

### `parquet.read` (v1) — Pure

Reads a Parquet file or glob of files into a table using DuckDB read_parquet.

Reads a Parquet file or glob of files via DuckDB `read_parquet`. Parquet is self-describing, so path is the only parameter. Content-hash cached like csv.read.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |

### `json.read` (v1) — Pure

Reads a JSON file (record array or newline-delimited) into a table, optionally flattening one level of nested objects into dotted columns.

Reads a JSON file via DuckDB `read_json`; `layout` selects the file shape (auto, records = one array of objects, lines = newline-delimited). With `flatten` true, one level of nested objects expands into dotted columns; deeper nesting stays a struct column for `sql.query` to unpack.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `layout` | Enum | `auto` | `auto`, `records`, `lines` | — |
| `flatten` | Boolean | `false` | — | — |

### `duck.table` (v1) — Pure

Reads one named table from a .duckdb database file, read-only.

Reads one named table from a .duckdb database opened read-only, so the node can never mutate the file. An unknown table name is an error naming the table; the no-SQL companion to duck.query.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `table` | Text | — | — | tables in the file at `path` |

### `duck.tables` (v1) — Pure

Lists the tables in a .duckdb database file with their column and row counts.

Lists the tables of a .duckdb database (read-only) as a table with `name`, `columnCount`, and real `rowCount` per table, ordered by name. The discovery step before duck.table or duck.query.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `tables` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |

## Tables — `BimOpenFlow.Nodes.Tables`

XLSX and SQLite readers plus table combinators: join, set operations, and projection. BIM-free, DuckDB-free.

### `xlsx.read` (v1) — Pure

Reads a worksheet (named, or the first) from an .xlsx file. headerRow is the header's row within the range (rows above are skipped); range is an A1-style rectangle like B3:F100 (empty = used range).

An empty `sheet` means the first worksheet; a named sheet that does not exist is an error. Row 1 of the used range is the header (blank headers become Column1, Column2, ...). Each column's type is inferred: if all non-null cells share one CLR type that type wins, otherwise the column is text. Dates are read as ISO-8601 text. `headerRow` (default 1) names the header's row within the region being read — rows above it are skipped, the junk-rows-above-the-header fix — and `range` (empty = used range) restricts reading to an A1-style rectangle like B3:F100; the two compose. The result is cached by content hash and parameters.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `sheet` | Text | — | — | — |
| `headerRow` | Integer | `1` | — | — |
| `range` | Text | — | — | — |

### `xlsx.sheets` (v1) — Pure

Lists the worksheets in an .xlsx file: name, index (1-based), rowCount, columnCount of the used range.

Lists a workbook's worksheets as a table: `name`, `index` (1-based position), and the used range's `rowCount`/`columnCount` (0 for empty sheets). Discovery before naming a sheet in xlsx.read; cached by file content hash.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `sheets` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |

### `sqlite.query` (v1) — Pure

Runs one read-only SQL query against a SQLite database file.

The database file is opened read-only, and the SQL is validated as a single SELECT or WITH statement. SQLite columns are dynamically typed per row, so each result column is unified: one non-null CLR type wins, a mix of integer and real widens to real, anything else lands as text.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `sql` | Text | — | — | — |

### `sqlite.table` (v1) — Pure

Reads one whole table from a SQLite database file (SELECT *, read-only).

Reads one whole table (`SELECT *`, read-only, case-insensitive name match) with the pack's column-type unification rules; an unknown table is an error naming it. The no-SQL companion to sqlite.query.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |
| `table` | Text | — | — | — |

### `sqlite.tables` (v1) — Pure

Lists the tables in a SQLite database file: name, columnCount, rowCount (read-only).

Lists a database's user tables (`name`, `columnCount`, `rowCount`) in name order, read-only, with sqlite_ internals and views excluded.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `tables` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `path` | FilePath | — | — | — |

### `table.join` (v1) — Pure

Joins b's columns onto a by key (bKey defaults to aKey). left keeps all a rows; inner keeps matches; full also appends unmatched b rows; semi/anti keep only a rows with/without a match and attach no b columns.

Joins b's columns onto a by key, matching on canonical cell text; `bKey` defaults to `aKey` when blank. Mode `left` keeps every a row (unmatched rows get null b cells); `inner` keeps only matches; `full` keeps left's rows plus unmatched b rows (with b's key surfaced in the key column); `semi` keeps a rows that have a match without attaching b columns; `anti` keeps a rows with no match. Unmatched rows and duplicate keys in b are warned about in every mode, never silent — with duplicates, the first b occurrence wins. b's key column is dropped from the output, and a b column whose name collides with an a column (case-insensitive) is suffixed `_b`.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `a` | Table | required |
| `b` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `aKey` | Text | — | — | columns of input `a` |
| `bKey` | Text | — | — | columns of input `b` |
| `mode` | Enum | `left` | `left`, `inner`, `full`, `semi`, `anti` | — |

### `table.setOp` (v1) — Pure

Keeps a's rows by key-set operation with b: union, intersect, or subtract.

Row-set algebra on a key column; a's columns and row order pass through. `intersect` keeps a rows whose key appears in b, `subtract` keeps those whose key does not, and `union` appends b rows whose key is absent from a. Union requires b to have exactly a's column set (matched case-insensitively); any missing or extra column is an error.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `a` | Table | required |
| `b` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `op` | Enum | `intersect` | `union`, `intersect`, `subtract` | — |
| `key` | Text | — | — | columns of input `a` |

### `table.project` (v1) — Pure

Keeps the comma-separated columns, in that order; unknown names warn.

Keeps the named columns in the given order. A name with no matching column warns and is skipped rather than erroring; naming no columns at all is an error.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `columns` | Text | — | — | columns of input `table` |

### `table.inline` (v1) — Pure

Builds a table from a JSON array of objects, e.g. [{"type":"Wall","rate":120.5}]. Column types are inferred (bool/integer/number/text); a column mixing value types is an error; nulls and missing keys are allowed.

Builds a small table from a JSON array of objects typed into the node. Column types are inferred (bool/integer/number/text); a column mixing types is an error naming the column; nulls and missing keys land as nulls; `[]` gives an empty table.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `rows` | Json | — | — | — |

### `table.range` (v1) — Pure

Generates one numeric column from start to stop (inclusive when a step lands on it) by step; a negative step counts down.

One numeric column from `start` to `stop` by `step`, inclusive of stop when a step lands exactly on it; negative steps count down; step 0 is an error.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `name` | Text | `value` | — | — |
| `start` | Number | `0` | — | — |
| `stop` | Number | — | — | — |
| `step` | Number | `1` | — | — |

### `table.calendar` (v1) — Pure

Generates one ISO-8601 date column from start to end inclusive; month/quarter/year steps use calendar arithmetic.

One ISO-8601 date column from `start` to `end` inclusive, stepping by day/week/month/quarter/year with real calendar arithmetic. The calendar spine for gap-filling time series via table.join.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `name` | Text | `date` | — | — |
| `start` | DateTime | — | — | — |
| `end` | DateTime | — | — | — |
| `step` | Enum | `day` | `day`, `week`, `month`, `quarter`, `year` | — |

## TableOps — `BimOpenFlow.Nodes.TableOps`

Rows, columns, reshape, and window transforms — each a typed facade over one generated DuckDB clause.

### `table.cast` (v1) — Pure

Converts a column to boolean, integer, number, text, date, or datetime.

Converts one column to boolean, integer, number, text, date, or datetime, in place or as a new named column. onError `null` turns unconvertible values into nulls and warns with the count; date/datetime accept ISO-8601 text only and come back as ISO text.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `column` | Text | — | — | columns of input `table` |
| `type` | Enum | — | `boolean`, `integer`, `number`, `text`, `date`, `datetime` | — |
| `onError` | Enum | `error` | `error`, `null` | — |
| `name` | Text | — | — | — |

### `table.concat` (v1) — Pure

Appends b's rows after a's, matching columns strictly by position or loosely by name.

Appends b's rows after a's. Strict mode requires both tables to have identical column sequences and errors naming the difference; byName matches columns by name and fills columns missing from one side with nulls.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `a` | Table | required |
| `b` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `columns` | Enum | `strict` | `strict`, `byName` | — |

### `table.distinct` (v1) — Pure

Removes duplicate rows; with key columns named, keeps the first row per key with all columns.

Removes duplicate rows. With no columns named, whole rows are compared; with key columns named, the first row per key (in input order) is kept with all its columns. Output preserves first-occurrence order.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `columns` | Text | — | — | columns of input `table` |

### `table.drop` (v1) — Pure

Removes the named columns and keeps all others.

Removes the named columns and keeps everything else — the complement of table.project. Unknown names warn; dropping every column is an error.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `columns` | Text | — | — | columns of input `table` |

### `table.limit` (v1) — Pure

Keeps 'count' rows starting at 'offset' in the table's order.

Keeps `count` rows starting at `offset` in the table's deterministic order — top-N after table.sort, paging through inspection.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `count` | Integer | — | — | — |
| `offset` | Integer | `0` | — | — |

### `table.pivot` (v1) — Pure

Pivots long data wide: one new column per distinct value of nameColumn.

Turns long data wide: each distinct value of nameColumn becomes a column, filled by aggregating valueColumn per groupBy key. New columns are ordered by sorted value; `first` takes the first value in input order.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `groupBy` | Text | — | — | columns of input `table` |
| `nameColumn` | Text | — | — | columns of input `table` |
| `valueColumn` | Text | — | — | columns of input `table` |
| `aggregate` | Enum | `first` | `first`, `sum`, `count`, `min`, `max`, `avg` | — |

### `table.profile` (v1) — Pure

Profiles every column: type, counts, distinct count, min, max, and mean.

Profiles every column via DuckDB SUMMARIZE, projected to a fixed column set: type, row count, exact null count, approximate distinct count, min/max (lexical for text), and mean (null for non-numeric).

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `profile` | Table |

**Params**: none

### `table.rename` (v1) — Pure

Renames columns using comma-separated 'old=new' pairs.

Renames columns via comma-separated `old=new` pairs. Unknown old names warn and are skipped; a new name that would collide with a remaining column is an error.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `renames` | Text | — | — | columns of input `table` |

### `table.sample` (v1) — Pure

Takes a seeded random sample: a fixed number of rows, or a fraction of them.

Takes a seeded random sample: `rows` mode keeps a fixed number of rows (reservoir), `fraction` mode keeps each row with the given probability (bernoulli). The same seed returns the same sample on the same machine (DuckDB documents REPEATABLE as reproducible for a fixed thread count), and sampled rows keep their input order.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `mode` | Enum | `rows` | `rows`, `fraction` | — |
| `rows` | Integer | `100` | — | — |
| `fraction` | Number | `0.1` | — | — |
| `seed` | Integer | `1` | — | — |

### `table.schema` (v1) — Pure

Outputs the table's columns as a table: name, type, and index.

Outputs the table's shape as a table: one row per column with its name, wire type (Boolean/Integer/Number/Text), and position — so schemas can be diffed, checked, and documented like any other data.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `schema` | Table |

**Params**: none

### `table.splitColumn` (v1) — Pure

Splits a column on a separator into new columns named by 'names'.

Splits a text column on a separator into new columns, one per requested name. Rows with fewer parts than names get nulls; extra parts are dropped; `keep` retains the original column.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `column` | Text | — | — | columns of input `table` |
| `separator` | Text | `-` | — | — |
| `names` | Text | — | — | — |
| `keep` | Boolean | `false` | — | — |

### `table.transpose` (v1) — Pure

Turns rows into columns, using the header column's values as the new column names.

Rows become columns: the header column's values name the new columns and every other column becomes a row. All values widen to text; limited to 1,000 rows — meant for small summary tables.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `headerColumn` | Text | — | — | — |

### `table.unpivot` (v1) — Pure

Unpivots columns into name/value rows, keeping the 'keep' columns as row ids.

Turns wide data long: the chosen columns fold into name/value rows next to the kept id columns. Mixed-type columns widen to text with a warning; null cells produce no row.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `keep` | Text | — | — | columns of input `table` |
| `columns` | Text | — | — | columns of input `table` |
| `nameColumn` | Text | `name` | — | — |
| `valueColumn` | Text | `value` | — | — |

### `table.window` (v1) — Pure

Adds one window-function column: ranking, lag/lead, cumulative sum, moving average, or percent of total.

Adds one window-function column: rankings (rowNumber/rank/denseRank), lag/lead, cumulative sum, moving average, or percent of total, optionally partitioned and ordered. Input rows and their order are unchanged.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `function` | Enum | — | `rowNumber`, `rank`, `denseRank`, `lag`, `lead`, `cumSum`, `movingAvg`, `percentOfTotal` | — |
| `column` | Text | — | — | columns of input `table` |
| `partitionBy` | Text | — | — | columns of input `table` |
| `orderBy` | Text | — | — | columns of input `table` |
| `offset` | Integer | `1` | — | — |
| `windowSize` | Integer | `3` | — | — |
| `name` | Text | — | — | — |

## Cleaning — `BimOpenFlow.Nodes.Cleaning`

Nulls, duplicates, text noise, and value replacement: the messy-data fixes that run before shaping.

### `table.fillNulls` (v1) — Pure

Fills nulls in 'columns' with a constant, or the nearest earlier/later non-null value in row order.

Fills nulls in the listed columns with a typed constant, or with the nearest earlier (forward) or later (backward) non-null value in the table's row order. Forward fill is the merged-cells-out-of-Excel fix; set partitionBy to stop values leaking across group boundaries. The constant is cast to each column's type and an uncastable value is an error.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `columns` | Text | — | — | columns of input `table` |
| `strategy` | Enum | `constant` | `constant`, `forward`, `backward` | — |
| `value` | Text | — | — | — |
| `partitionBy` | Text | — | — | columns of input `table` |

### `table.dropNulls` (v1) — Pure

Drops rows where any/all of 'columns' (empty = all columns) are null; warns with the dropped count.

Drops rows where any (or, with mode all, every one) of the listed columns is null; leaving columns empty checks every column. Never silent: the dropped-row count is reported as a warning.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `columns` | Text | — | — | columns of input `table` |
| `mode` | Enum | `any` | `any`, `all` | — |

### `table.dedupe` (v1) — Pure

Keeps the first/last row per 'keys' by 'orderBy' (empty = input row order); warns with the duplicate count.

Keeps one row per key combination: the first or last by orderBy (same syntax as table.sort), or by input row order when orderBy is empty. Kept rows come out in their original order, and the number of removed duplicates is reported as a warning. Keep-latest-per-id is keep last with orderBy on a timestamp column.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `keys` | Text | — | — | columns of input `table` |
| `keep` | Enum | `first` | `first`, `last` | — |
| `orderBy` | Text | — | — | columns of input `table` |

### `table.replace` (v1) — Pure

Replaces 'find' with 'replaceWith' in a text column, by exact/substring/regex match.

Rewrites values in one text column by exact match (whole-value recode), substring, or regular expression (with group references like \1), optionally case-insensitive. To recode a sentinel to null, replace it with the empty string and follow with table.cast using onError null.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `column` | Text | — | — | columns of input `table` |
| `find` | Text | — | — | — |
| `replaceWith` | Text | — | — | — |
| `match` | Enum | `exact` | `exact`, `substring`, `regex` | — |
| `caseSensitive` | Boolean | `true` | — | — |

### `text.transform` (v1) — Pure

Applies trim/upper/lower/normalizeSpace to 'columns' (empty = every text column) in place.

Applies trim, upper, lower, or normalizeSpace (trim plus collapse runs of whitespace to one space) in place to the named text columns, or to every text column when none are named. The standard pre-join step for keys that fail on invisible whitespace.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `columns` | Text | — | — | columns of input `table` |
| `op` | Enum | `trim` | `trim`, `upper`, `lower`, `normalizeSpace` | — |

### `text.extract` (v1) — Pure

Adds column 'name' holding capture group 'group' (0 = whole match) of 'pattern' from 'column'; null when no match.

Adds one new column holding a regex capture group (0 = the whole match) pulled from a text column; rows that don't match get null. Pair with table.cast to make the extract numeric, e.g. pulling "03" out of "Level 03 - Zone B".

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `column` | Text | — | — | columns of input `table` |
| `pattern` | Text | — | — | — |
| `group` | Integer | `1` | — | — |
| `name` | Text | — | — | — |

## Dates — `BimOpenFlow.Nodes.Dates`

Parsing text columns into dates, extracting parts, truncating, arithmetic, and range filtering.

### `date.parse` (v1) — Pure

Parses 'column' with the strptime 'format' (empty = ISO-8601) into ISO date text; 'onError' nulls or rejects unparseable values; empty 'name' replaces the column in place.

Turns a text column into canonical ISO-8601 date text, using a strptime format (e.g. `%d/%m/%Y`) or a plain ISO cast when the format is empty. `onError` picks between rejecting the table on the first bad value and nulling bad values with a warning that counts them. The entry point of the Dates set: every other date node requires an ISO date column and points here when it finds anything else.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `column` | Text | — | — | columns of input `table` |
| `format` | Text | — | — | — |
| `onError` | Enum | `error` | `error`, `null` | — |
| `name` | Text | — | — | — |

### `date.part` (v1) — Pure

Adds the integer 'part' of the ISO date 'column' as new column 'name'; dayOfWeek is ISO (Monday = 1).

Adds one Integer column holding a component of an ISO date column: year, quarter, month, week, day of month, ISO day of week (Monday = 1), day of year, hour, minute, or second.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `column` | Text | — | — | columns of input `table` |
| `part` | Enum | — | `year`, `quarter`, `month`, `week`, `dayOfMonth`, `dayOfWeek`, `dayOfYear`, `hour`, `minute`, `second` | — |
| `name` | Text | — | — | — |

### `date.truncate` (v1) — Pure

Truncates the ISO date 'column' down to the start of its 'period' (week starts Monday); empty 'name' replaces the column in place.

Rounds an ISO date column down to the start of its year, quarter, month, week (Monday), day, or hour. The result is still a date, so it sorts and joins correctly across years. Empty `name` replaces the column in place.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `column` | Text | — | — | columns of input `table` |
| `period` | Enum | — | `year`, `quarter`, `month`, `week`, `day`, `hour` | — |
| `name` | Text | — | — | — |

### `date.diff` (v1) — Pure

Adds new Integer column 'name' counting 'unit' boundaries from ISO date column 'a' to column 'b' (negative when b is earlier).

Adds an Integer column counting unit boundaries (years to seconds, default days) from column `a` to column `b`, negative when `b` is earlier.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `a` | Text | — | — | — |
| `b` | Text | — | — | — |
| `unit` | Enum | `days` | `years`, `months`, `days`, `hours`, `minutes`, `seconds` | — |
| `name` | Text | — | — | — |

### `date.offset` (v1) — Pure

Shifts the ISO date 'column' by 'amount' (may be negative) whole 'unit's, calendar-aware (Jan 31 + 1 month = end of February); empty 'name' replaces in place.

Shifts an ISO date column by a signed whole number of years, months, days, hours, or minutes using calendar rules: Jan 31 plus one month lands on the end of February. Empty `name` replaces the column in place.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `column` | Text | — | — | columns of input `table` |
| `amount` | Integer | — | — | — |
| `unit` | Enum | `days` | `years`, `months`, `days`, `hours`, `minutes` | — |
| `name` | Text | — | — | — |

### `date.filter` (v1) — Pure

Keeps rows where ISO date 'column' >= 'from' (inclusive) and < 'to' (exclusive); an empty bound is open. Rows with a null date are dropped.

Keeps rows whose ISO date column falls in the half-open range [from, to), so adjacent ranges never overlap; an empty bound leaves that side open, and both bounds empty passes the table through with a warning. Promoted to graph parameters, the bounds become the report's date-range control.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `column` | Text | — | — | columns of input `table` |
| `from` | DateTime | — | — | — |
| `to` | DateTime | — | — | — |

## Viz — `BimOpenFlow.Nodes.Viz`

Chart and table-view nodes that validate and project table data for the web panes; rendering stays client-side.

### `chart.bar` (v1) — Pure

Projects 'labelColumn' plus the comma-separated numeric 'valueColumns' for the bar-chart pane; 'sort' orders rows by the first value column.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `labelColumn` | Text | — | — | columns of input `table` |
| `valueColumns` | Text | — | — | columns of input `table` |
| `title` | Text | — | — | — |
| `sort` | Enum | `none` | `none`, `asc`, `desc` | — |

### `chart.line` (v1) — Pure

Projects 'xColumn' plus the comma-separated numeric 'yColumns' for the line-chart pane; rows are ordered by 'xColumn'.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `xColumn` | Text | — | — | columns of input `table` |
| `yColumns` | Text | — | — | columns of input `table` |
| `title` | Text | — | — | — |

### `view.table` (v1) — Pure

Titles a table view; comma-separated 'columns' optionally projects (default all, kept in the named order; unknown names warn).

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Default | Allowed values | Suggestions |
|---|---|---|---|---|
| `title` | Text | — | — | — |
| `columns` | Text | — | — | columns of input `table` |
