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
A text parameter marked (list) holds a comma-separated list. A parameter
with a Socket type is also an input: wire a node of that type into the
port named like the parameter and the wired value replaces the typed one;
unwired, the typed value is used.

**File-reading nodes and caching.** Nodes that read files (`bos.load`,
`duck.read`, `xlsx.read`, `view3d.instances`) are pure despite touching
disk: the cache key is a hash of the file's content, so an unchanged file
is never re-read and an edited file is picked up automatically — the key
is the content itself, not the path or a timestamp.

## Packs

| Pack | Nodes | Kinds |
|---|---|---|
| BOS — `BimOpenFlow.Nodes.Bos` | 2 | `bos.load`, `bos.query` |
| BIM analysis — `BimOpenFlow.Nodes.BimAnalysis` | 15 | `bim.elements`, `bim.rooms`, `bim.levels`, `bim.bounds`, `bim.paramTable`, `bim.paramCoverage`, `bim.discipline`, `bim.classifyRooms`, `bim.containment`, `bim.nearest`, `bim.navGraph`, `bim.hops`, `bim.orientation`, `bim.buildSequence`, `bim.selection` |
| Geometry — `BimOpenFlow.Nodes.Geometry` | 22 | `view3d.instances`, `view3d.measures`, `view3d.color`, `view3d.label`, `view3d.isolate`, `view3d.hide`, `view3d.opacity`, `view3d.spacing`, `view3d.arrange`, `view3d.decimate`, `view3d.boundingBoxes`, `view3d.voxelize`, `view3d.camera`, `view3d.scene`, `view3d.section`, `view3d.sectionBox`, `view3d.explode`, `view3d.projection`, `view3d.environment`, `view3d.categoryStyle`, `view3d.tint`, `view3d.sectionRange` |
| IDS — `BimOpenFlow.Nodes.Ids` | 2 | `ids.check`, `ids.specifications` |
| BCF — `BimOpenFlow.Nodes.Bcf` | 4 | `bcf.issue`, `bcf.topics`, `bcf.write`, `bcf.read` |
| Compliance — `BimOpenFlow.Nodes.Compliance` | 4 | `check.rule`, `check.required`, `check.rollup`, `check.union` |
| Effects — `BimOpenFlow.Nodes.Effects` | 8 | `sink.exportCsv`, `sink.exportParquet`, `sink.exportJson`, `sink.exportXlsx`, `sink.exportSqlite`, `sink.exportDuckDb`, `sink.writePsets`, `sink.report` |
| DuckDB — `BimOpenFlow.Nodes.DuckDb` | 9 | `duck.read`, `duck.source`, `duck.query`, `sql.query`, `csv.read`, `parquet.read`, `json.read`, `duck.table`, `duck.tables` |
| Tables — `BimOpenFlow.Nodes.Tables` | 13 | `xlsx.read`, `xlsx.sheets`, `sqlite.query`, `sqlite.table`, `sqlite.tables`, `bfast.read`, `bfast.buffer`, `table.join`, `table.setOp`, `table.project`, `table.inline`, `table.range`, `table.calendar` |
| TableOps — `BimOpenFlow.Nodes.TableOps` | 18 | `table.filter`, `table.derive`, `table.aggregate`, `table.sort`, `table.cast`, `table.concat`, `table.distinct`, `table.drop`, `table.limit`, `table.pivot`, `table.profile`, `table.rename`, `table.sample`, `table.schema`, `table.splitColumn`, `table.transpose`, `table.unpivot`, `table.window` |
| Cleaning — `BimOpenFlow.Nodes.Cleaning` | 6 | `table.fillNulls`, `table.dropNulls`, `table.dedupe`, `table.replace`, `text.transform`, `text.extract` |
| Dates — `BimOpenFlow.Nodes.Dates` | 6 | `date.parse`, `date.part`, `date.truncate`, `date.diff`, `date.offset`, `date.filter` |
| Viz — `BimOpenFlow.Nodes.Viz` | 5 | `chart.bar`, `chart.line`, `view.table`, `view.colormap`, `view.note` |
| Spatial — `BimOpenFlow.Nodes.Spatial` | 8 | `spatial.intersects`, `spatial.within`, `spatial.nearest`, `spatial.contains`, `spatial.footprint`, `spatial.polygon`, `spatial.polygonContains`, `spatial.polygonIntersects` |
| Value — `BimOpenFlow.Nodes.Value` | 5 | `value.text`, `value.number`, `value.integer`, `value.boolean`, `value.path` |
| Relations — `BimOpenFlow.Nodes.Relations` | 12 | `rel.csv`, `rel.table`, `rel.fromTable`, `rel.sql`, `rel.select`, `rel.filter`, `rel.derive`, `rel.sort`, `rel.limit`, `rel.aggregate`, `rel.join`, `rel.materialize` |

## BOS — `BimOpenFlow.Nodes.Bos`

Loading BIM Open Schema (.bos) files and querying them with SQL; the general table transforms live in TableOps.

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.bos` |
| `harmonize` | Boolean | — | `false` | — | — |

**Columns of `entities`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `EntityIndex` | Integer | no | `EntityIndex` | Row number of the entity in the BOS Entities table; -1 when a row is about no entity. |
| `StepId` | Integer | yes | `StepId` | The EntityText view's name for LocalId. |
| `GlobalId` | Text | yes | `GlobalId` | The entity's globally unique id (an IfcGloballyUniqueId); empty when the source gave none. |
| `Name` | Text | yes | `Name` | The entity's name, or a parameter's name in a parameter table. |
| `Category` | Text | yes | `Category` | The entity's category: the IFC class (IFCWALL) or the Revit category. |
| `Type` | Text | yes | `Type` | The name of the entity's type (the family type of an element), or the type of a BCF issue. |

**Columns of `parameters`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `EntityIndex` | Integer | no | `EntityIndex` | Row number of the entity in the BOS Entities table; -1 when a row is about no entity. |
| `Name` | Text | yes | `Name` | The entity's name, or a parameter's name in a parameter table. |
| `ParameterGroup` | Text | yes | `ParameterGroup` | The group a parameter is filed under in the source tool's property dialog. |
| `Units` | Text | yes | `Units` | The unit name the source file gave a parameter; absent when it gave none. |
| `ValueType` | Text | yes | `ValueType` | The kind of a parameter's value: String, Number, Entity, Point and so on. |
| `Value` | Text | yes | `Value` | A parameter's value as text, whatever its ValueType (the ParameterText view). The lowercase value column of chart, scale and colour tables is a number and is not this kind. |

**Columns of `relations`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `EntityIndexA` | Integer | no | `EntityIndexA` | EntityIndex of the first entity of a relation. |
| `NameA` | Text | yes | `NameA` | Name of the first entity of a relation. |
| `EntityIndexB` | Integer | no | `EntityIndexB` | EntityIndex of the second entity of a relation; for containment, the container. |
| `NameB` | Text | yes | `NameB` | Name of the second entity of a relation. |
| `RelationType` | Text | yes | `RelationType` | The kind of a relation: PartOf, MemberOf, ContainedIn and so on. |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `sql` | Text | — | — | — | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.bos` |

**Columns of `table`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `EntityIndex` | Integer | no | `EntityIndex` | Row number of the entity in the BOS Entities table; -1 when a row is about no entity. |
| `LocalId` | Integer | no | `LocalId` | The id the source file gave the entity (the STEP id of an IFC file, the element id of Revit). |
| `GlobalId` | Text | yes | `GlobalId` | The entity's globally unique id (an IfcGloballyUniqueId); empty when the source gave none. |
| `Name` | Text | yes | `Name` | The entity's name, or a parameter's name in a parameter table. |
| `Category` | Text | no | `Category` | The entity's category: the IFC class (IFCWALL) or the Revit category. |
| `CategoryType` | Text | yes | `CategoryType` | The kind of the category, as the source file classifies it. |
| `Type` | Text | yes | `Type` | The name of the entity's type (the family type of an element), or the type of a BCF issue. |
| `ClassName` | Text | yes | `ClassName` | The class of the entity in the source model. |
| `Level` | Text | yes | `Level` | Name of the level or storey the entity sits on. |
| `Elevation` | Number | yes | `Elevation` | Height of the level or element; absent when the model gives none. |
| `Room` | Text | yes | `Room` | Name of the room the entity is in, or a room's label in a hop table. |
| `Document` | Text | yes | `Document` | Title of the document (the linked or host model) the entity comes from. |
| `Workset` | Integer | yes | `Workset` | Id of the workset the entity belongs to; absent when it has none. |
| `Group` | Text | yes | `Group` | Name of the group the entity belongs to. |

### `bim.rooms` (v1) — Pure

Loads a .bos file into one row per room: EntityIndex, Name, Number, Level, Elevation, Volume, UnboundedHeight, ElementCount (elements whose Room/Space parameter points here), and when bounds exist MinX..MaxZ, SizeX/Y/Z, CenterX/Y/Z, FootprintArea. Rooms are the elements whose category is in the comma-separated 'categories' list.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.bos` |
| `categories` | Text (list) | — | `Rooms,Spaces` | — | — |

**Columns of `table`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `EntityIndex` | Integer | no | `EntityIndex` | Row number of the entity in the BOS Entities table; -1 when a row is about no entity. |
| `Name` | Text | yes | `Name` | The entity's name, or a parameter's name in a parameter table. |
| `Number` | Text | yes | `Number` | The room's number as a label (text, because numbers like 'A-101' occur). |
| `Level` | Text | yes | `Level` | Name of the level or storey the entity sits on. |
| `Elevation` | Number | yes | `Elevation` | Height of the level or element; absent when the model gives none. |
| `Volume` | Number | yes | `Volume` | A volume: of the bounding box in bim.bounds (SizeX * SizeY * SizeZ), of the room in bim.rooms. |
| `UnboundedHeight` | Number | yes | `UnboundedHeight` | The room's unbounded height parameter; absent when the room has none. |
| `ElementCount` | Integer | no | `ElementCount` | How many elements a level or room holds. |
| `MinX` | Number | yes | `MinX` | Smallest X of the element's bounding box. |
| `MinY` | Number | yes | `MinY` | Smallest Y of the element's bounding box. |
| `MinZ` | Number | yes | `MinZ` | Smallest Z of the element's bounding box. |
| `MaxX` | Number | yes | `MaxX` | Largest X of the element's bounding box. |
| `MaxY` | Number | yes | `MaxY` | Largest Y of the element's bounding box. |
| `MaxZ` | Number | yes | `MaxZ` | Largest Z of the element's bounding box. |
| `SizeX` | Number | yes | `SizeX` | Extent of the bounding box along X (MaxX - MinX). |
| `SizeY` | Number | yes | `SizeY` | Extent of the bounding box along Y (MaxY - MinY). |
| `SizeZ` | Number | yes | `SizeZ` | Extent of the bounding box along Z (MaxZ - MinZ). |
| `CenterX` | Number | yes | `CenterX` | X of the bounding box's center. |
| `CenterY` | Number | yes | `CenterY` | Y of the bounding box's center. |
| `CenterZ` | Number | yes | `CenterZ` | Z of the bounding box's center. |
| `FootprintArea` | Number | yes | `FootprintArea` | Area of the bounding box seen from above (SizeX * SizeY), not of the element's true footprint. |

### `bim.levels` (v1) — Pure

Loads a .bos file into one row per level, ordered by elevation: EntityIndex, Name, Elevation, ElementCount (elements whose Level parameter points here), RoomCount. Levels are the elements carrying a level-elevation parameter or categorized as Levels.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.bos` |

**Columns of `table`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `EntityIndex` | Integer | no | `EntityIndex` | Row number of the entity in the BOS Entities table; -1 when a row is about no entity. |
| `Name` | Text | yes | `Name` | The entity's name, or a parameter's name in a parameter table. |
| `Elevation` | Number | no | `Elevation` | Height of the level or element; absent when the model gives none. |
| `ElementCount` | Integer | no | `ElementCount` | How many elements a level or room holds. |
| `RoomCount` | Integer | no | `RoomCount` | How many rooms a level holds. |

### `bim.bounds` (v1) — Pure

Loads a .bos file into one row per element that has bounds: EntityIndex, Name, Category, Level, MinX..MaxZ, SizeX/Y/Z, CenterX/Y/Z, FootprintArea (SizeX*SizeY), Volume (box volume), Diagonal. Feeds bim.containment, bim.nearest, and dimension analyses.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.bos` |

**Columns of `table`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `EntityIndex` | Integer | no | `EntityIndex` | Row number of the entity in the BOS Entities table; -1 when a row is about no entity. |
| `Name` | Text | yes | `Name` | The entity's name, or a parameter's name in a parameter table. |
| `Category` | Text | yes | `Category` | The entity's category: the IFC class (IFCWALL) or the Revit category. |
| `Level` | Text | yes | `Level` | Name of the level or storey the entity sits on. |
| `MinX` | Number | no | `MinX` | Smallest X of the element's bounding box. |
| `MinY` | Number | no | `MinY` | Smallest Y of the element's bounding box. |
| `MinZ` | Number | no | `MinZ` | Smallest Z of the element's bounding box. |
| `MaxX` | Number | no | `MaxX` | Largest X of the element's bounding box. |
| `MaxY` | Number | no | `MaxY` | Largest Y of the element's bounding box. |
| `MaxZ` | Number | no | `MaxZ` | Largest Z of the element's bounding box. |
| `SizeX` | Number | no | `SizeX` | Extent of the bounding box along X (MaxX - MinX). |
| `SizeY` | Number | no | `SizeY` | Extent of the bounding box along Y (MaxY - MinY). |
| `SizeZ` | Number | no | `SizeZ` | Extent of the bounding box along Z (MaxZ - MinZ). |
| `CenterX` | Number | no | `CenterX` | X of the bounding box's center. |
| `CenterY` | Number | no | `CenterY` | Y of the bounding box's center. |
| `CenterZ` | Number | no | `CenterZ` | Z of the bounding box's center. |
| `FootprintArea` | Number | no | `FootprintArea` | Area of the bounding box seen from above (SizeX * SizeY), not of the element's true footprint. |
| `Volume` | Number | no | `Volume` | A volume: of the bounding box in bim.bounds (SizeX * SizeY * SizeZ), of the room in bim.rooms. |
| `Diagonal` | Number | no | `Diagonal` | Length of the bounding box's space diagonal. |

### `bim.paramTable` (v1) — Pure

Loads a .bos file into one row per element with EntityIndex, Name, Category plus one typed column per requested parameter ('parameters' is a comma-separated list of full descriptor names, e.g. Rvt:Room:Volume). Columns take the short name after the last colon (the full name on collision); Int maps to integer, Number to double, String and Entity to text, and Point parameters expand to three .X/.Y/.Z double columns.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.bos` |
| `parameters` | Text (list) | — | — | — | — |

**Columns of `table`**: inferred from the inputs

### `bim.paramCoverage` (v1) — Pure

Profiles a long parameter table (the bos.load parameters output: EntityIndex, Name, ParameterGroup, Units, ValueType, Value) into one row per parameter name: Name, ParameterGroup, ValueType, Count, Distinct, FillRate, ordered by Count descending. With 'groupBy' empty (the default), FillRate is the share of every distinct entity in the input that carries the parameter, which understates fill for a parameter that only applies to one kind of entity. With 'groupBy' naming a column present on the input (for example a Category column joined in from bos.load's entities table), the output gets one row per parameter per group value, and FillRate is the share of that group's entities that carry the parameter.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `parameters` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `groupBy` | Text | — | — | — | columns of input `parameters` |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `column` | Text | — | `Category` | — | columns of input `table` |
| `overrides` | Json | — | — | — | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `column` | Text | — | `Name` | — | columns of input `table` |
| `rules` | Json | — | — | — | — |
| `as` | Text | — | `RoomClass` | — | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `x` | Text | — | `CenterX` | — | columns of input `points` |
| `y` | Text | — | `CenterY` | — | columns of input `points` |
| `z` | Text | — | `CenterZ` | — | columns of input `points` |
| `key` | Text | — | `Name` | — | columns of input `boxes` |
| `as` | Text | — | `ContainedIn` | — | — |
| `ignoreZ` | Boolean | — | `false` | — | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `x` | Text | — | `CenterX` | — | columns of input `a` |
| `y` | Text | — | `CenterY` | — | columns of input `a` |
| `z` | Text | — | `CenterZ` | — | columns of input `a` |
| `bx` | Text | — | `CenterX` | — | columns of input `b` |
| `by` | Text | — | `CenterY` | — | columns of input `b` |
| `bz` | Text | — | `CenterZ` | — | columns of input `b` |
| `key` | Text | — | `Name` | — | columns of input `b` |
| `as` | Text | — | `Nearest` | — | — |

**Columns of `table`**: inferred from the inputs

### `bim.navGraph` (v1) — Pure

Loads a .bos file into one row per door in the given categories: Door (entity index), DoorName, Level, FromRoom, ToRoom — the rooms from the door's from/to-room parameters, labelled 'Name Number' (so two Corridors on different floors stay distinct), with Outside standing in for a missing side. The rows are the undirected edges of the room navigation graph; feed them to bim.hops for reachability.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.bos` |
| `doorCategories` | Text (list) | — | `Doors` | — | — |

**Columns of `table`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `Door` | Integer | no | `Door` | EntityIndex of a door. |
| `DoorName` | Text | yes | `DoorName` | The door's name. |
| `Level` | Text | yes | `Level` | Name of the level or storey the entity sits on. |
| `FromRoom` | Text | no | `FromRoom` | Label of the room on the door's from side; 'Outside' when there is none. |
| `ToRoom` | Text | no | `ToRoom` | Label of the room on the door's to side; 'Outside' when there is none. |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `from` | Text | — | `FromRoom` | — | columns of input `edges` |
| `to` | Text | — | `ToRoom` | — | columns of input `edges` |
| `start` | Text | — | — | — | — |

**Columns of `table`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `Room` | Text | no | `Room` | Name of the room the entity is in, or a room's label in a hop table. |
| `Hops` | Integer | yes | `Hops` | Doors to pass from the start room; absent when the room cannot be reached. |

### `bim.orientation` (v1) — Pure

Loads a .bos file into one row per element with a box: EntityIndex, GlobalId, Name, Category, Level, CenterX, CenterY, Bearing, Sector, Direction, Distance, Facing, FacingArea. The box is the element's Rvt:Element:Bounds when present, else the world box of its visible geometry. The plan centre is the middle of the rows' combined XY extent, so 'categories' (comma-separated, blank for every element) also sets the centre. Bearing is degrees clockwise from project north (+Y of the model) to the element's box centre; a BOS carries no true-north angle, so it is not true north. Sector 0..7 and Direction (N, NE, E, SE, S, SW, W, NW) bin the bearing in 45-degree slices centred on each point, a bearing on a boundary going to the clockwise slice (22.5 is NE, 337.5 is N); Distance is the plan distance from the centre (m). Facing (N, E, S, W) is the side the box's larger vertical face looks out to, by which side of the centre the box lies on (a square box counts its X-running face, so it faces N or S); FacingArea is that face's area, max(SizeX, SizeY) * SizeZ (m2), which approximates a wall's or window's gross face when it runs along a model axis and overstates a diagonal one. An element whose box centre is the plan centre (Distance 0, as when it is the only row) has no bearing and no side, so its Bearing, Sector, Direction, and Facing are null; FacingArea is still given.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.bos` |
| `categories` | Text (list) | — | — | — | — |

**Columns of `table`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `EntityIndex` | Integer | no | `EntityIndex` | Row number of the entity in the BOS Entities table; -1 when a row is about no entity. |
| `GlobalId` | Text | yes | `GlobalId` | The entity's globally unique id (an IfcGloballyUniqueId); empty when the source gave none. |
| `Name` | Text | yes | `Name` | The entity's name, or a parameter's name in a parameter table. |
| `Category` | Text | yes | `Category` | The entity's category: the IFC class (IFCWALL) or the Revit category. |
| `Level` | Text | yes | `Level` | Name of the level or storey the entity sits on. |
| `CenterX` | Number | no | `CenterX` | X of the bounding box's center. |
| `CenterY` | Number | no | `CenterY` | Y of the bounding box's center. |
| `Bearing` | Number | yes | `Bearing` | Degrees clockwise from project north (+Y of the model) to the element's box centre as seen from the plan centre; absent at the centre. BOS records no true-north angle. |
| `Sector` | Integer | yes | `Sector` | The 45-degree compass slice of the bearing, 0 (N) to 7 (NW), clockwise. |
| `Direction` | Text | yes | `Direction` | The compass point of the bearing's slice: N, NE, E, SE, S, SW, W or NW. |
| `Distance` | Number | no | `Distance` | A distance in the model's length unit: to the nearest candidate row in bim.nearest, from the plan centre in bim.orientation. |
| `Facing` | Text | yes | `Facing` | The side (N, E, S or W) the box's larger vertical face looks out to. |
| `FacingArea` | Number | no | `FacingArea` | Area of the box's larger vertical face, max(SizeX, SizeY) * SizeZ; it overstates a diagonal element's face. |

### `bim.buildSequence` (v1) — Pure

A synthetic construction sequence (4D) for an element table such as bim.elements or bim.discipline's output; it takes a table rather than a .bos path so a filtered or re-classified element set schedules the same way. Each row's trade comes from 'column' (Revit categories, IFC classes, or bim.discipline names) by a built-in map to Structure, Envelope, MEP, and Finishes; 'overrides' is a JSON {"value": "trade"} object that wins. 'trades' orders the trades; storeys from 'levelColumn' run bottom-up by the lowest 'elevationColumn' value, then by name (only by name, with a warning, when that column is missing). A task starts when the previous trade has left its storey and its own trade has left the storey below, so trades overlap by one storey; each task with elements lasts 'daysPerTask' calendar days from 'start'. Output 'tasks': Task, Storey, Trade, Start, End (exclusive, ISO dates), DurationDays, FinishWeek (the week of the last working day, End - 1, counted from 1 at 'start'), ElementCount, Synthetic. Output 'elements': the input rows plus Task, Trade, Finish (the task's exclusive End), FinishWeek (as in 'tasks'), Synthetic (true on every scheduled row); rows with no storey or no trade get nulls in all five and are counted in one warning. Same input, same schedule.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `tasks` | Table |
| `elements` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `levelColumn` | Text | — | `Level` | — | columns of input `table` |
| `elevationColumn` | Text | — | `Elevation` | — | columns of input `table` |
| `column` | Text | — | `Category` | — | columns of input `table` |
| `start` | DateTime | — | `2027-01-04` | — | — |
| `daysPerTask` | Integer | — | `10` | — | — |
| `trades` | Text (list) | — | `Structure,Envelope,MEP,Finishes` | — | — |
| `overrides` | Json | — | — | — | — |

**Columns of `tasks`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `Task` | Text | no | `Task` | One trade's work on one storey, named 'Storey - Trade'. |
| `Storey` | Text | no | `Storey` | Name of the storey a scheduled task works. |
| `Trade` | Text | no | `Trade` | The trade that does a task: Structure, Envelope, MEP, Finishes, or the names the node was given. |
| `Start` | Text | no | `Start` | First day of a task, as an ISO date (yyyy-MM-dd). |
| `End` | Text | no | `End` | Day after a task's last day (exclusive), as an ISO date (yyyy-MM-dd). |
| `DurationDays` | Integer | no | `DurationDays` | Calendar days a task lasts. |
| `FinishWeek` | Integer | no | `FinishWeek` | The week, counted from 1 at the schedule's start, that holds the task's last working day (End - 1). |
| `ElementCount` | Integer | no | `ElementCount` | How many elements a level or room holds. |
| `Synthetic` | Boolean | no | `Synthetic` | True when the value comes from a generated schedule, not from the model: an invented plan, not a recorded one. |

**Columns of `elements`**: inferred from the inputs

### `bim.selection` (v1) — Pure

The elements picked in the 3D pane, as a table with one column, GlobalId, and one row per distinct id in the order given. The 3D pane's 'Use selection' button adds this node (or updates the one it added) holding the current selection; 'ids' is the comma-separated GlobalIds, and may be typed by hand. Wire the table into a join or filter on GlobalId (table.filter, table.aggregate), into view3d.isolate or view3d.color, or into bcf.issue. Blank entries are dropped; with no ids the table has no rows.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `ids` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `ids` | Text (list) | — | — | — | — |

**Columns of `ids`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `GlobalId` | Text | no | `GlobalId` | The entity's globally unique id (an IfcGloballyUniqueId); empty when the source gave none. |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.bos` |

### `view3d.measures` (v1) — Pure

One row per placed mesh of a model file: instanceIndex, meshId, entityId, globalId, category, surfaceArea, meshVolume, and triangleCount, computed in world space from the mesh triangles. meshVolume is the enclosed volume and is exact only for closed meshes with consistent winding; open shells report the absolute signed sum. Join on entityId or globalId to bring quantities onto any other table. The loaded geometry is cached by file content hash.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `measures` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.bos` |

### `view3d.color` (v1) — Pure

Adds r,g,b,a color columns to an instance table by joining a value table on a shared column, and reports the colour scale used on a `legend` output. Without a `scale` input the scale is built from `auto`/`min`/`max`/`colorMap`; with one, that scale colours the cells and passes through unchanged.

Numeric value columns map through a gradient normalized over the column's min..max range; text values map categorically, with palette indices assigned by sorted distinct value so colors are stable under row reordering. A non-numeric value column with a gradient colorMap warns and falls back to category10. Instance rows with no match in the value table get gray; alpha is always 1. With `auto` false, the gradient's domain is the manual `min`..`max` instead of the column's own range; values outside it take the end colours and are counted in the `legend` output's below/above rows, with one warning naming the count. `min >= max` warns and falls back to the automatic domain. An optional `scale` input (typically `view.colormap`'s `legend`, so this pane and a chart share one domain) replaces the node's own scale entirely — `auto`/`min`/`max`/`colorMap` are ignored (with a warning when `auto` is false) and the scale's own value column is used, with a warning if `valueColumn` names a different one. Either way, `legend` reports the domain actually used — `auto`, `manual`, or `categorical` — so a clamped manual domain is visible instead of silent.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `instances` | Table | required |
| `values` | Table | required |
| `scale` | Table | optional |

**Outputs**

| Name | Type |
|---|---|
| `instances` | Table |
| `legend` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `joinColumn` | Text | — | — | — | columns of input `instances`, keys shared with `values` first |
| `valueColumn` | Text | — | — | — | — |
| `colorMap` | Enum | — | `viridis` | `viridis`, `category10`, `redgreen` | — |
| `auto` | Boolean | — | `true` | — | — |
| `min` | Number | — | `0` | — | — |
| `max` | Number | — | `1` | — | — |

### `view3d.label` (v1) — Pure

Writes text on elements in the 3D view. Adds label, labelX, labelY, labelZ columns to an instance table; the 3D pane draws every non-null label as text at its anchor. `format` is the text with {Column} or {Column:0.0} placeholders (.NET numeric formats, invariant culture), for example "{Name}: {OverallWidth:0} mm", filled from the `values` table joined to the instances on `joinColumn`; with no `values` input the placeholders read the instance table's own columns. Without `groupColumn` there is one label per distinct join value, anchored at the top centre of the union of that value's instance boxes; with `groupColumn` (an instance or values column, such as the storey) there is one label per group, anchored over the union of the group's boxes, its placeholders read from the group's first values row (a per-storey total table is the intended use). A row whose placeholder value is empty gets no label, never invented text. A placeholder naming a column that does not exist is an error. Past `limit` labels the rest get none and the node warns with how many were dropped.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `instances` | Table | required |
| `values` | Table | optional |

**Outputs**

| Name | Type |
|---|---|
| `instances` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `joinColumn` | Text | — | `entityId` | — | columns of input `instances`, keys shared with `values` first |
| `format` | Text | — | — | — | — |
| `groupColumn` | Text | — | — | — | columns of input `instances` |
| `limit` | Integer | — | `200` | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `joinColumn` | Text | — | — | — | columns of input `instances`, keys first |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `joinColumn` | Text | — | — | — | columns of input `instances`, keys first |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `alpha` | Number | — | `0.25` | — | — |
| `joinColumn` | Text | — | — | — | columns of input `instances`, keys first |
| `scope` | Enum | — | `matched` | `matched`, `others` | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `groupColumn` | Text | — | — | — | columns of input `instances` |
| `axis` | Enum | — | `x` | `x`, `y`, `z` | — |
| `spacing` | Number | — | `10` | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `groupColumn` | Text | — | — | — | columns of input `instances` |
| `gap` | Number | — | `5` | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `keepFraction` | Number | — | `0.25` | — | — |
| `minDiagonal` | Number | — | `0` | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `groupColumn` | Text | — | — | — | columns of input `instances` |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `size` | Number | — | `1` | — | — |

### `view3d.camera` (v1) — Pure

A named camera as a one-row table: position, look-at target, and the vertical field of view in degrees (fov, default 60). The 3D pane's Comment button adds one holding the current camera and wires it into bcf.issue, which turns it into a BCF viewpoint.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `camera` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `name` | Text | — | `default` | — | — |
| `posX` | Number | — | `0` | — | — |
| `posY` | Number | — | `0` | — | — |
| `posZ` | Number | — | `0` | — | — |
| `targetX` | Number | — | `0` | — | — |
| `targetY` | Number | — | `0` | — | — |
| `targetZ` | Number | — | `0` | — | — |
| `fov` | Number | — | `60` | — | — |

**Columns of `camera`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `name` | Text | no | — | — |
| `posX` | Number | no | — | — |
| `posY` | Number | no | — | — |
| `posZ` | Number | no | — | — |
| `targetX` | Number | no | — | — |
| `targetY` | Number | no | — | — |
| `targetZ` | Number | no | — | — |
| `fov` | Number | no | — | — |

### `view3d.scene` (v1) — Pure

Open a model with the visualization toolkit. Connect view outputs to compose a presentation.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `view` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.bos` |

### `view3d.section` (v1) — Pure

Cut along an axis at a fraction of the model bounds (0–1). Keeps the lower side; no capped solids.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `view` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `view` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `axis` | Enum | — | `z` | `x`, `y`, `z` | — |
| `fraction` | Fraction | — | `0.5` | — | — |

### `view3d.sectionBox` (v1) — Pure

Reveal a centered box inside the model. Fraction 1 keeps the full model; 0.5 keeps its central half on each axis.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `view` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `view` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `fraction` | Fraction | — | `0.5` | — | — |

### `view3d.explode` (v1) — Pure

Fan source categories apart using the toolkit layout feature. Reset restores original coordinates.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `view` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `view` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `strength` | Number | — | `0.5` | — | — |

### `view3d.projection` (v1) — Pure

Frame the model in perspective, orthographic or overhead plan view.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `view` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `view` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `mode` | Enum | — | `orthographic` | `perspective`, `orthographic`, `plan` | — |

### `view3d.environment` (v1) — Pure

Set a light or dark review background with scale-aware grid and axes.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `view` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `view` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `theme` | Enum | — | `light` | `light`, `dark` | — |
| `grid` | Boolean | — | `true` | — | — |

### `view3d.categoryStyle` (v1) — Pure

Color source categories, with a distinct unknown category; optionally ghost the entire model.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `view` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `view` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `palette` | Enum | — | `classic` | `classic`, `vivid`, `pastel`, `earth`, `grayscale` | — |
| `opacity` | Fraction | — | `1` | — | — |

### `view3d.tint` (v1) — Pure

Apply a uniform color and opacity to the model.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `view` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `view` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `color` | Text | — | `#2b8bd6` | — | — |
| `opacityPercent` | Percent | — | `100` | — | — |

### `view3d.sectionRange` (v1) — Pure

Keep the band between two fractions of the original model bounds along an axis.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `view` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `view` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `axis` | Enum | — | `z` | `x`, `y`, `z` | — |
| `range` | Text | — | `[0.3,0.7]` | — | — |

## IDS — `BimOpenFlow.Nodes.Ids`

The ids.* pack: a buildingSMART IDS 1.0 file evaluated over the entity and parameter tables as a verdict table, and the specifications it holds listed before any model is read.

### `ids.check` (v1) — Pure

Evaluates a buildingSMART IDS 1.0 file over the entity and parameter tables (the first two outputs of bos.load) and, when wired, the relations table (its third output), which material and part-of facets need; without it they give InfoNotAvailable. Outputs a verdict table (GlobalId, EntityIndex, CheckId, CheckTitle, Citation, Verdict, Reason; one row per entity per specification) and a summary with the Pass, Fail and InfoNotAvailable counts per specification (one row per specification, zeros when none of its rows exist). A facet BOS cannot answer gives InfoNotAvailable and a warning, never a pass; a facet the IDS loader skipped is a warning too.

The entity and parameter tables are `bos.load`'s first two outputs (or any tables with the EntityText and ParameterText columns). Each specification's applicability facets select entities; each requirement facet is judged under its cardinality (expected, optional, prohibited); an entity's row keeps the worst verdict and the reasons behind it. Entity facets match the IFC class exactly (IncludeSubtypes is ignored with a warning); a USERDEFINED predefined type is read from ObjectType. Property `dataType` is checked at the level BOS records: number, logical, or text. Classification, material, part-of and document facets give InfoNotAvailable with one warning each, never a pass. A required specification that applies to nothing gets one model-level Fail row with an empty GlobalId. Numbers are compared in the model's own units.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `entities` | Table | required |
| `parameters` | Table | required |
| `relations` | Table | optional |

**Outputs**

| Name | Type |
|---|---|
| `verdicts` | Table |
| `summary` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `ids` | FilePath | Text | — | — | files under the model roots ending `.ids` |

**Columns of `verdicts`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `GlobalId` | Text | yes | `GlobalId` | The entity's globally unique id (an IfcGloballyUniqueId); empty when the source gave none. |
| `EntityIndex` | Integer | yes | `EntityIndex` | Row number of the entity in the BOS Entities table; -1 when a row is about no entity. |
| `CheckId` | Text | no | `CheckId` | Identifier of the check or specification that produced the verdict. |
| `CheckTitle` | Text | no | `CheckTitle` | Human title of the check, shown to people. |
| `Citation` | Text | yes | `Citation` | The requirement the check enforces, as its source states it (a code clause, the IDS facets). |
| `Verdict` | Text | no | `Verdict` | The result of a check on an entity: Pass, Fail, or InfoNotAvailable when the model lacks what the check reads. |
| `Reason` | Text | yes | `Reason` | Why the entity got its verdict. |

**Columns of `summary`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `CheckId` | Text | no | `CheckId` | Identifier of the check or specification that produced the verdict. |
| `CheckTitle` | Text | no | `CheckTitle` | Human title of the check, shown to people. |
| `Pass` | Integer | no | `Pass` | How many rows of a check got the verdict Pass. |
| `Fail` | Integer | no | `Fail` | How many rows of a check got the verdict Fail. |
| `InfoNotAvailable` | Integer | no | `InfoNotAvailable` | How many rows of a check got the verdict InfoNotAvailable. |
| `Rows` | Integer | no | `Rows` | How many verdict rows a check produced. |

### `ids.specifications` (v1) — Pure

Lists the specifications of a buildingSMART IDS 1.0 file: CheckId, CheckTitle, IfcVersion, Cardinality, Applicability, Requirements, and Supported (false when a facet would give InfoNotAvailable; material and part-of facets count as supported and need ids.check's relations input). Reads no model; use it to see what an IDS asks before running ids.check.

Reads only the IDS file. `Supported` is false when any facet of the specification would give InfoNotAvailable under `ids.check`.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `specifications` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `ids` | FilePath | Text | — | — | files under the model roots ending `.ids` |

**Columns of `specifications`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `CheckId` | Text | no | `CheckId` | Identifier of the check or specification that produced the verdict. |
| `CheckTitle` | Text | no | `CheckTitle` | Human title of the check, shown to people. |
| `IfcVersion` | Text | no | `IfcVersion` | The IFC schema versions a specification applies to, comma-separated. |
| `Cardinality` | Text | no | `Cardinality` | Whether a specification's applicable entities are required, optional or prohibited. |
| `Applicability` | Text | no | `Applicability` | The facets that select the entities a specification applies to, in short form. |
| `Requirements` | Text | no | `Requirements` | The facets an applicable entity must satisfy, in short form. |
| `Supported` | Boolean | no | `Supported` | False when a facet of the specification would give InfoNotAvailable because BOS cannot answer it. |

## BCF — `BimOpenFlow.Nodes.Bcf`

The bcf.* pack: an issue or verdict table previewed as BCF topics, written as a BCF 3.0 file on Run, and a BCF file read back as an issues table.

### `bcf.issue` (v1) — Pure

One reviewer's comment as an issue table: columns GlobalId, Title, Description, Status, Priority, Type, Comment, CommentAuthor, CommentDate, Author, CreationDate, with one row per distinct GlobalId in 'ids' (the elements the issue is about; one row with an empty GlobalId when there are none, a comment on the model as a whole). Author and CreationDate belong to the topic; CommentAuthor and CommentDate to its comment, and here carry the same values (the author and the time of creation). Wire a view3d.camera table into 'camera' and each row also carries the camera columns CameraX..CameraZ, DirectionX..DirectionZ, UpX..UpZ, FieldOfView and AspectRatio, which bcf.write turns into the topic's viewpoint (direction is target minus position, normalised; up is the z axis made perpendicular to it; aspect ratio 1). The 3D pane's 'Comment' button adds this node with its title, comment and author, the current selection in 'ids' and the time in 'created' (UTC, yyyy-MM-ddTHH:mm:ssZ; the node reads no clock). 'title' is required. Wire the table into bcf.topics to preview the topic and bcf.write to write the BCF file on Run.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `camera` | Table | optional |

**Outputs**

| Name | Type |
|---|---|
| `issues` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `title` | Text | — | — | — | — |
| `description` | Text | — | — | — | — |
| `comment` | Text | — | — | — | — |
| `author` | Text | — | — | — | — |
| `created` | Text | — | — | — | — |
| `status` | Text | — | `Open` | — | — |
| `priority` | Text | — | — | — | — |
| `type` | Text | — | `Issue` | — | — |
| `ids` | Text (list) | — | — | — | — |

**Columns of `issues`**: inferred from the inputs

### `bcf.topics` (v1) — Pure

Groups an issue or verdict table into the BCF topics bcf.write would write (one per distinct title: Title, Description, Status, Priority, Type, Elements, GlobalIds), so the file's contents can be checked before Run. 'preset' names the topic columns: 'issue' reads Title and Description, 'verdict' reads CheckTitle and Citation, 'auto' picks by the columns present. When the table has a Verdict column, only rows whose verdict is listed in 'verdicts' (comma-separated; default Fail) are kept; an empty list keeps every row.

The same grouping `bcf.write` applies, as a table: a preview of the file before Run. A verdict table is filtered to the verdicts listed (default Fail) first, then rows sharing a title become one topic whose GlobalIds are listed once each.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `issues` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `topics` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `preset` | Enum | — | `auto` | `auto`, `issue`, `verdict` | — |
| `verdicts` | Text (list) | — | `Fail` | — | — |

**Columns of `topics`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `Title` | Text | yes | `Title` | The issue's title; rows with one title form one issue (one BCF topic). |
| `Description` | Text | yes | `Description` | What is wrong, in words. |
| `Status` | Text | yes | `Status` | The issue's state, for example Open or Closed. |
| `Priority` | Text | yes | `Priority` | The issue's priority, for example High. |
| `Type` | Text | yes | `Type` | The name of the entity's type (the family type of an element), or the type of a BCF issue. |
| `Elements` | Integer | no | `Elements` | How many elements a BCF topic selects. |
| `GlobalIds` | Text | no | `GlobalIds` | The GlobalIds of a BCF topic's elements, comma-separated. |
| `AuthoringToolIds` | Text | no | — | — |

### `bcf.write` (v1) — Effect

Writes the input issue or verdict table as a BCF 3.0 file at 'path' that Revit, Solibri and BIMcollab open as topics. With 'model' (a .bos file) each topic gets a viewpoint selecting its elements under a camera framing them; without it, or for elements with no geometry, the GlobalIds go in the topic's description. 'model' also names the model file in the BCF header (file name and path), so a viewer can match the topic to its model; 'modelDate' (UTC, yyyy-MM-ddTHH:mm:ssZ) adds the file's date there, and is left out when empty because a file's last-write time changes with every checkout. 'created' (UTC, yyyy-MM-ddTHH:mm:ssZ) sets every topic's creation date and the zip entries' timestamps; empty uses the time of the Run, so two Runs differ, and set it to get the same bytes (and SHA-256) every time. A camera in the input (the CameraX..AspectRatio columns, as bcf.issue makes them) becomes the viewpoint's camera, and a Comment column becomes the topic's comments. 'guidSeed' keeps topic GUIDs stable across reruns (default: the file name). Runs only inside a Run; outputs a one-row summary (path, topics, viewpoints, elements, elementsWithoutGeometry, bytes, sha256). 'preset' names the topic columns: 'issue' reads Title and Description, 'verdict' reads CheckTitle and Citation, 'auto' picks by the columns present. When the table has a Verdict column, only rows whose verdict is listed in 'verdicts' (comma-separated; default Fail) are kept; an empty list keeps every row.

An Effect node: pending until Run. Topic GUIDs are name-based from `guidSeed` (default the file name) and the title, so a rerun with the same seed updates the same topics in a BCF reader instead of adding new ones. With `model`, a .bos file, each topic whose elements have geometry gets a viewpoint selecting them under a perspective camera framing their bounding box; the model's element boxes are cached by file content. A topic with no geometry has no viewpoint (BCF 3.0 requires a camera) and lists its GlobalIds at the end of its description. The file is written beside the target and moved into place when complete.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `issues` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | — | — | — | — |
| `model` | FilePath | Text | — | — | files under the model roots ending `.bos` |
| `preset` | Enum | — | `auto` | `auto`, `issue`, `verdict` | — |
| `verdicts` | Text (list) | — | `Fail` | — | — |
| `author` | Text | — | — | — | — |
| `guidSeed` | Text | — | — | — | — |
| `created` | Text | — | — | — | — |
| `modelDate` | Text | — | — | — | — |

**Columns of `out`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `path` | Text | no | — | — |
| `topics` | Integer | no | — | — |
| `viewpoints` | Integer | no | — | — |
| `elements` | Integer | no | — | — |
| `elementsWithoutGeometry` | Integer | no | — | — |
| `bytes` | Integer | no | — | — |
| `sha256` | Text | no | — | — |

### `bcf.read` (v1) — Pure

Reads a BCF 3.0 (or 2.1) file into an issues table (GlobalId, Title, Description, Status, Priority, Type, TopicGuid, Author, CreationDate, AuthoringToolId, the camera columns CameraX..AspectRatio (empty when the topic has no viewpoint camera, and FieldOfView and AspectRatio empty when the file gave none), Comments (the topic's comment count); one row per topic and selected element, with both ids empty for a topic that selects nothing) and a topics table (one row per topic with its element count) and a comments table (TopicGuid, Title, CommentAuthor, CommentDate, Comment; one row per comment). A component BCF names only by AuthoringToolId (a Revit UniqueId, say) has its id in AuthoringToolId and an empty GlobalId. The issues table joins to a model on GlobalId, so view3d.color can colour the elements a colleague flagged. A viewpoint or markup that cannot be read, or a viewpoint missing from the file, is skipped with a warning; the other topics still come through.

Reads markup.bcf per topic and the elements its viewpoints select; a topic written without geometry gets its GlobalIds back from its description. Comments, snapshots and cameras are not read.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `issues` | Table |
| `topics` | Table |
| `comments` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.bcf` |

**Columns of `issues`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `GlobalId` | Text | yes | `GlobalId` | The entity's globally unique id (an IfcGloballyUniqueId); empty when the source gave none. |
| `Title` | Text | yes | `Title` | The issue's title; rows with one title form one issue (one BCF topic). |
| `Description` | Text | yes | `Description` | What is wrong, in words. |
| `Status` | Text | yes | `Status` | The issue's state, for example Open or Closed. |
| `Priority` | Text | yes | `Priority` | The issue's priority, for example High. |
| `Type` | Text | yes | `Type` | The name of the entity's type (the family type of an element), or the type of a BCF issue. |
| `TopicGuid` | Text | yes | `TopicGuid` | The BCF topic's guid. |
| `Author` | Text | yes | `Author` | Who created the BCF topic. |
| `CreationDate` | Text | yes | `CreationDate` | When the BCF topic was created, as UTC ISO text (yyyy-MM-ddTHH:mm:ssZ); empty when the file gives none. |
| `AuthoringToolId` | Text | yes | `AuthoringToolId` | An id the authoring tool gave the entity (a Revit UniqueId), set when a BCF names a component only by it; GlobalId is then empty. |
| `CameraX` | Number | yes | — | — |
| `CameraY` | Number | yes | — | — |
| `CameraZ` | Number | yes | — | — |
| `DirectionX` | Number | yes | — | — |
| `DirectionY` | Number | yes | — | — |
| `DirectionZ` | Number | yes | — | — |
| `UpX` | Number | yes | — | — |
| `UpY` | Number | yes | — | — |
| `UpZ` | Number | yes | — | — |
| `FieldOfView` | Number | yes | — | — |
| `AspectRatio` | Number | yes | — | — |
| `Comments` | Integer | no | — | — |

**Columns of `topics`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `Title` | Text | yes | `Title` | The issue's title; rows with one title form one issue (one BCF topic). |
| `Description` | Text | yes | `Description` | What is wrong, in words. |
| `Status` | Text | yes | `Status` | The issue's state, for example Open or Closed. |
| `Priority` | Text | yes | `Priority` | The issue's priority, for example High. |
| `Type` | Text | yes | `Type` | The name of the entity's type (the family type of an element), or the type of a BCF issue. |
| `Elements` | Integer | no | `Elements` | How many elements a BCF topic selects. |
| `GlobalIds` | Text | no | `GlobalIds` | The GlobalIds of a BCF topic's elements, comma-separated. |
| `AuthoringToolIds` | Text | no | — | — |

**Columns of `comments`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `TopicGuid` | Text | yes | `TopicGuid` | The BCF topic's guid. |
| `Title` | Text | yes | `Title` | The issue's title; rows with one title form one issue (one BCF topic). |
| `CommentAuthor` | Text | yes | — | — |
| `CommentDate` | Text | yes | — | — |
| `Comment` | Text | no | — | — |

## Compliance — `BimOpenFlow.Nodes.Compliance`

The verdict-bearing vocabulary: rule checks, required-data checks, rollups, and unions of verdict tables.

### `check.rule` (v1) — Pure

Per row: expr true = Pass, false = Fail (NeedsReview where reviewExpr is true), null = InfoNotAvailable.

Per row: `expr` true is Pass; false is Fail, unless `reviewExpr` is also true, which makes it NeedsReview; a null result (missing data) is InfoNotAvailable. An empty `reviewExpr` means false never escalates to NeedsReview. The output is the input columns plus the verdict columns (`Verdict`, `CheckId`, `CheckTitle`, `Citation`).

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `checkId` | Text | — | — | — | — |
| `title` | Text | — | — | — | — |
| `citation` | Text | — | — | — | — |
| `expr` | Expression | — | — | — | — |
| `reviewExpr` | Expression | — | — | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `checkId` | Text | — | — | — | — |
| `title` | Text | — | — | — | — |
| `citation` | Text | — | — | — | — |
| `columns` | Text (list) | — | — | — | — |

**Columns of `out`**: inferred from the inputs

### `check.rollup` (v1) — Pure

Groups a verdict table by CheckId into counts and the worst verdict per check.

Input must be a verdict table. Output has one row per CheckId in first-appearance order, with per-verdict counts (`passCount`, `failCount`, `needsReviewCount`, `infoNotAvailableCount`) and `worst`, the worst verdict present by severity Fail > NeedsReview > InfoNotAvailable > Pass.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**: none

**Columns of `out`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `CheckId` | Text | no | `CheckId` | Identifier of the check or specification that produced the verdict. |
| `CheckTitle` | Text | no | `CheckTitle` | Human title of the check, shown to people. |
| `Citation` | Text | no | `Citation` | The requirement the check enforces, as its source states it (a code clause, the IDS facets). |
| `passCount` | Integer | no | — | — |
| `failCount` | Integer | no | — | — |
| `needsReviewCount` | Integer | no | — | — |
| `infoNotAvailableCount` | Integer | no | — | — |
| `worst` | Text | no | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | — | — | — | — |
| `delimiter` | Text | — | `,` | — | — |
| `header` | Boolean | — | `true` | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | — | — | — | — |
| `compression` | Enum | — | `zstd` | `zstd`, `snappy`, `none` | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | — | — | — | — |
| `layout` | Enum | — | `records` | `records`, `lines` | — |
| `indent` | Boolean | — | `false` | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | — | — | — | — |
| `sheet` | Text | — | `Sheet1` | — | — |
| `mode` | Enum | — | `replaceFile` | `replaceFile`, `replaceSheet` | — |
| `autoWidth` | Boolean | — | `true` | — | — |
| `headerBold` | Boolean | — | `true` | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | — | — | — | — |
| `table` | Text | — | — | — | — |
| `mode` | Enum | — | `replace` | `replace`, `append`, `failIfExists` | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | — | — | — | — |
| `table` | Text | — | — | — | — |
| `mode` | Enum | — | `replace` | `replace`, `append`, `failIfExists` | — |

### `sink.writePsets` (v1) — Effect

Byte-exact pset write-back: reads sourcePath, appends psets from the input table, writes targetPath. An optional valueType column names the IFC value type of each row - Text, Label, Identifier, Integer, Number (Real is a synonym), or Boolean, case-insensitive - and paramValue is parsed from text with the invariant culture; an empty cell or an absent column means Text. Optional input zones (zoneName, spaceId) appends one IfcZone per name grouping those spaces; optional input zonePsets (zoneName, psetName, paramName, paramValue, optional valueType) attaches property sets to the zones by name. Optional documentPath records that file (the long analytics table) as an IfcDocumentReference on the first IfcProject, with its file name, format, SHA-256, and the join key named by documentKey (default GlobalId); documentDescription adds a sentence about it. Outputs a one-row summary (targetPath, entitiesTouched, valuesWritten, zonesWritten, documentsWritten).

Effect: runs only inside a Run. Input rows (`entityId`, `psetName`, `paramName`, `paramValue`) are grouped by (entityId, psetName) in first-appearance order; each group becomes one IfcPropertySet attached to the entity, appended to a byte-exact copy of the source file. An entity id not present in the source file is an error. v1 limitation: every value is written as IFCTEXT; typed measures come later. The optional `zones` input (`zoneName`, `spaceId`) appends one IfcZone per name grouping those spaces through IfcRelAssignsToGroup, and the optional `zonePsets` input (`zoneName`, `psetName`, `paramName`, `paramValue`) attaches property sets to those zones by name, since a zone's id exists only once the Run allocates it. The optional `documentPath` parameter records that file (the long analytics table) as an IfcDocumentReference on the first IfcProject, carrying its file name, format, SHA-256, and the join key named by `documentKey` (default GlobalId).

**Inputs**

| Name | Type | Required |
|---|---|---|
| `in` | Table | required |
| `zones` | Table | optional |
| `zonePsets` | Table | optional |

**Outputs**

| Name | Type |
|---|---|
| `out` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `sourcePath` | FilePath | — | — | — | files under the model roots ending `.ifc` |
| `targetPath` | FilePath | — | — | — | — |
| `documentPath` | FilePath | — | — | — | — |
| `documentKey` | Text | — | `GlobalId` | — | — |
| `documentDescription` | Text | — | — | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | — | — | — | — |
| `title` | Text | — | — | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.csv,.parquet,.json` |
| `format` | Enum | — | `auto` | `auto`, `csv`, `parquet`, `json` | — |

**Columns of `table`**: inferred from the inputs

### `duck.source` (v1) — Pure

Opens one shared read-only DuckDB source for connected query branches.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `source` | Database |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | — | — | — | files under the model roots ending `.duckdb` |

### `duck.query` (v1) — Pure

Runs read-only SQL against a DuckDB file: type the path, or wire a duck.source into path.

The database file is opened read-only (the node can never mutate it), and the SQL is validated as a single SELECT or WITH statement before it runs.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Database | — | — | files under the model roots ending `.duckdb` |
| `sql` | Text | — | — | — | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `sql` | Text | — | — | — | — |

**Columns of `table`**: inferred from the inputs

### `csv.read` (v1) — Pure

Reads a CSV file or glob of files into a table, with typed delimiter, header, skip, quote, null-text, and encoding options.

Reads one CSV file or a glob of files via DuckDB `read_csv`, with typed delimiter, quote, header, skip-rows, null-text, encoding, and type-inference options. A glob unions every matching file and appends a `filename` column so provenance survives; a glob matching nothing, like a missing file, is an error. With `header` false, columns are named Column1..N. Results are cached by file content hash plus parameter values.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.csv,.tsv,.txt` |
| `delimiter` | Text | — | `,` | — | — |
| `header` | Boolean | — | `true` | — | — |
| `skipRows` | Integer | — | `0` | — | — |
| `quote` | Text | — | `"` | — | — |
| `nullText` | Text | — | — | — | — |
| `encoding` | Enum | — | `utf8` | `utf8`, `utf16`, `latin1` | — |
| `inferTypes` | Boolean | — | `true` | — | — |

**Columns of `table`**: inferred from the inputs

### `parquet.read` (v1) — Pure

Reads a Parquet file or glob of files into a table using DuckDB read_parquet.

Reads a Parquet file or glob of files via DuckDB `read_parquet`. Parquet is self-describing, so path is the only parameter. Content-hash cached like csv.read.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.parquet` |

**Columns of `table`**: inferred from the inputs

### `json.read` (v1) — Pure

Reads a JSON file (record array or newline-delimited) into a table, optionally flattening one level of nested objects into dotted columns.

Reads a JSON file via DuckDB `read_json`; `layout` selects the file shape (auto, records = one array of objects, lines = newline-delimited). With `flatten` true, one level of nested objects expands into dotted columns; deeper nesting stays a struct column for `sql.query` to unpack.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.json,.ndjson` |
| `layout` | Enum | — | `auto` | `auto`, `records`, `lines` | — |
| `flatten` | Boolean | — | `false` | — | — |

**Columns of `table`**: inferred from the inputs

### `duck.table` (v1) — Pure

Reads one named table from a .duckdb database file, read-only.

Reads one named table from a .duckdb database opened read-only, so the node can never mutate the file. An unknown table name is an error naming the table; the no-SQL companion to duck.query.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Database | — | — | files under the model roots ending `.duckdb` |
| `table` | Text | — | — | — | tables in the file at `path` |

**Columns of `table`**: inferred from the inputs

### `duck.tables` (v1) — Pure

Lists the tables in a .duckdb database file with their column and row counts.

Lists the tables of a .duckdb database (read-only) as a table with `name`, `columnCount`, and real `rowCount` per table, ordered by name. The discovery step before duck.table or duck.query.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `tables` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Database | — | — | files under the model roots ending `.duckdb` |

**Columns of `tables`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `name` | Text | no | — | — |
| `columnCount` | Integer | no | — | — |
| `rowCount` | Integer | no | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.xlsx` |
| `sheet` | Text | — | — | — | — |
| `headerRow` | Integer | — | `1` | — | — |
| `range` | Text | — | — | — | — |

**Columns of `table`**: inferred from the inputs

### `xlsx.sheets` (v1) — Pure

Lists the worksheets in an .xlsx file: name, index (1-based), rowCount, columnCount of the used range.

Lists a workbook's worksheets as a table: `name`, `index` (1-based position), and the used range's `rowCount`/`columnCount` (0 for empty sheets). Discovery before naming a sheet in xlsx.read; cached by file content hash.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `sheets` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.xlsx` |

**Columns of `sheets`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `name` | Text | no | — | — |
| `index` | Integer | no | — | — |
| `rowCount` | Integer | no | — | — |
| `columnCount` | Integer | no | — | — |

### `sqlite.query` (v1) — Pure

Runs one read-only SQL query against a SQLite database file.

The database file is opened read-only, and the SQL is validated as a single SELECT or WITH statement. SQLite columns are dynamically typed per row, so each result column is unified: one non-null CLR type wins, a mix of integer and real widens to real, anything else lands as text.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.sqlite,.sqlite3,.db` |
| `sql` | Text | — | — | — | — |

**Columns of `table`**: inferred from the inputs

### `sqlite.table` (v1) — Pure

Reads one whole table from a SQLite database file (SELECT *, read-only).

Reads one whole table (`SELECT *`, read-only, case-insensitive name match) with the pack's column-type unification rules; an unknown table is an error naming it. The no-SQL companion to sqlite.query.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.sqlite,.sqlite3,.db` |
| `table` | Text | — | — | — | — |

**Columns of `table`**: inferred from the inputs

### `sqlite.tables` (v1) — Pure

Lists the tables in a SQLite database file: name, columnCount, rowCount (read-only).

Lists a database's user tables (`name`, `columnCount`, `rowCount`) in name order, read-only, with sqlite_ internals and views excluded.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `tables` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.sqlite,.sqlite3,.db` |

**Columns of `tables`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `name` | Text | no | — | — |
| `columnCount` | Integer | no | — | — |
| `rowCount` | Integer | no | — | — |

### `bfast.read` (v1) — Pure

Lists the buffers in a BFAST file: name, byteLength, index (0-based file order). BFAST records no element types; bfast.buffer reads one buffer under a type you name.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `buffers` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.bfast` |

**Columns of `buffers`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `name` | Text | no | — | — |
| `byteLength` | Integer | no | — | — |
| `index` | Integer | no | — | — |

### `bfast.buffer` (v1) — Pure

Reads one buffer of a BFAST file as a table with a single `value` column, interpreting its bytes as the given element type (integers widen to long, floats to double). An unknown buffer name or a byte length that is not a multiple of the element size is an error.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | Text | — | — | files under the model roots ending `.bfast` |
| `name` | Text | — | — | — | — |
| `type` | Enum | — | `float32` | `uint8`, `int16`, `int32`, `int64`, `float32`, `float64` | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `aKey` | Text | — | — | — | columns of input `a`, keys shared with `b` first |
| `bKey` | Text | — | — | — | columns of input `b`, keys shared with `a` first |
| `mode` | Enum | — | `left` | `left`, `inner`, `full`, `semi`, `anti` | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `op` | Enum | — | `intersect` | `union`, `intersect`, `subtract` | — |
| `key` | Text | — | — | — | columns of input `a` |

**Columns of `table`**: inferred from the inputs

### `table.project` (v1) — Pure

Keeps the comma-separated columns, in that order; 'column as Alias' renames one; unknown names warn.

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `columns` | Text (list) | — | — | — | columns of input `table` |

**Columns of `table`**: inferred from the inputs

### `table.inline` (v1) — Pure

Builds a table from a JSON array of objects, e.g. [{"type":"Wall","rate":120.5}]. Column types are inferred (bool/integer/number/text); a column mixing value types is an error; nulls and missing keys are allowed.

Builds a small table from a JSON array of objects typed into the node. Column types are inferred (bool/integer/number/text); a column mixing types is an error naming the column; nulls and missing keys land as nulls; `[]` gives an empty table.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `rows` | Json | — | — | — | — |

**Columns of `table`**: inferred from the inputs

### `table.range` (v1) — Pure

Generates one numeric column from start to stop (inclusive when a step lands on it) by step; a negative step counts down.

One numeric column from `start` to `stop` by `step`, inclusive of stop when a step lands exactly on it; negative steps count down; step 0 is an error.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `name` | Text | — | `value` | — | — |
| `start` | Number | — | `0` | — | — |
| `stop` | Number | — | — | — | — |
| `step` | Number | — | `1` | — | — |

**Columns of `table`**: inferred from the inputs

### `table.calendar` (v1) — Pure

Generates one ISO-8601 date column from start to end inclusive; month/quarter/year steps use calendar arithmetic.

One ISO-8601 date column from `start` to `end` inclusive, stepping by day/week/month/quarter/year with real calendar arithmetic. The calendar spine for gap-filling time series via table.join.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `name` | Text | — | `date` | — | — |
| `start` | DateTime | — | — | — | — |
| `end` | DateTime | — | — | — | — |
| `step` | Enum | — | `day` | `day`, `week`, `month`, `quarter`, `year` | — |

**Columns of `table`**: inferred from the inputs

## TableOps — `BimOpenFlow.Nodes.TableOps`

Rows, columns, reshape, and window transforms — each a typed facade over one generated DuckDB clause.

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `expr` | Expression | — | — | — | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `name` | Text | — | — | — | — |
| `expr` | Expression | — | — | — | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `groupBy` | Text (list) | — | — | — | columns of input `table` |
| `aggregates` | Text (list) | — | — | — | columns of input `table`, each with the aggregate functions its type allows |

**Columns of `table`**: inferred from the inputs

### `table.sort` (v1) — Pure

Sorts by columns A, B, then C, each with its own ascending or descending direction.

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `A` | Text | — | — | — | columns of input `table` |
| `B` | Text | — | — | — | columns of input `table` |
| `C` | Text | — | — | — | columns of input `table` |
| `descendingA` | Boolean | — | `false` | — | — |
| `descendingB` | Boolean | — | `false` | — | — |
| `descendingC` | Boolean | — | `false` | — | — |
| `by` | Text (list) | — | — | — | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `column` | Text | — | — | — | columns of input `table` |
| `type` | Enum | — | — | `boolean`, `integer`, `number`, `text`, `date`, `datetime` | — |
| `onError` | Enum | — | `error` | `error`, `null` | — |
| `name` | Text | — | — | — | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `columns` | Enum | — | `strict` | `strict`, `byName` | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `columns` | Text (list) | — | — | — | columns of input `table` |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `columns` | Text (list) | — | — | — | columns of input `table` |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `count` | Integer | — | — | — | — |
| `offset` | Integer | — | `0` | — | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `groupBy` | Text (list) | — | — | — | columns of input `table` |
| `nameColumn` | Text | — | — | — | columns of input `table` |
| `valueColumn` | Text | — | — | — | columns of input `table` |
| `aggregate` | Enum | — | `first` | `first`, `sum`, `count`, `min`, `max`, `avg` | — |

**Columns of `table`**: unknown until run

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

**Columns of `profile`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `column` | Text | no | — | — |
| `type` | Text | no | — | — |
| `count` | Integer | no | — | — |
| `nullCount` | Integer | no | — | — |
| `distinctCount` | Integer | yes | — | — |
| `min` | Text | yes | — | — |
| `max` | Text | yes | — | — |
| `mean` | Number | yes | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `renames` | Text (list) | — | — | — | columns of input `table` |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `mode` | Enum | — | `rows` | `rows`, `fraction` | — |
| `rows` | Integer | — | `100` | — | — |
| `fraction` | Number | — | `0.1` | — | — |
| `seed` | Integer | — | `1` | — | — |

**Columns of `table`**: inferred from the inputs

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

**Columns of `schema`**

| Name | Type | Nullable | Kind | Meaning |
|---|---|---|---|---|
| `column` | Text | no | — | — |
| `type` | Text | no | — | — |
| `index` | Integer | no | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `column` | Text | — | — | — | columns of input `table` |
| `separator` | Text | — | `-` | — | — |
| `names` | Text (list) | — | — | — | — |
| `keep` | Boolean | — | `false` | — | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `headerColumn` | Text | — | — | — | — |

**Columns of `table`**: unknown until run

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `keep` | Text (list) | — | — | — | columns of input `table` |
| `columns` | Text (list) | — | — | — | columns of input `table` |
| `nameColumn` | Text | — | `name` | — | — |
| `valueColumn` | Text | — | `value` | — | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `function` | Enum | — | — | `rowNumber`, `rank`, `denseRank`, `lag`, `lead`, `cumSum`, `movingAvg`, `percentOfTotal` | — |
| `column` | Text | — | — | — | columns of input `table` |
| `partitionBy` | Text (list) | — | — | — | columns of input `table` |
| `orderBy` | Text (list) | — | — | — | columns of input `table` |
| `offset` | Integer | — | `1` | — | — |
| `windowSize` | Integer | — | `3` | — | — |
| `name` | Text | — | — | — | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `columns` | Text (list) | — | — | — | columns of input `table` |
| `strategy` | Enum | — | `constant` | `constant`, `forward`, `backward` | — |
| `value` | Text | — | — | — | — |
| `partitionBy` | Text (list) | — | — | — | columns of input `table` |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `columns` | Text (list) | — | — | — | columns of input `table` |
| `mode` | Enum | — | `any` | `any`, `all` | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `keys` | Text (list) | — | — | — | columns of input `table` |
| `keep` | Enum | — | `first` | `first`, `last` | — |
| `orderBy` | Text (list) | — | — | — | columns of input `table` |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `column` | Text | — | — | — | columns of input `table` |
| `find` | Text | — | — | — | — |
| `replaceWith` | Text | — | — | — | — |
| `match` | Enum | — | `exact` | `exact`, `substring`, `regex` | — |
| `caseSensitive` | Boolean | — | `true` | — | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `columns` | Text (list) | — | — | — | columns of input `table` |
| `op` | Enum | — | `trim` | `trim`, `upper`, `lower`, `normalizeSpace` | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `column` | Text | — | — | — | columns of input `table` |
| `pattern` | Text | — | — | — | — |
| `group` | Integer | — | `1` | — | — |
| `name` | Text | — | — | — | — |

**Columns of `table`**: inferred from the inputs

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `column` | Text | — | — | — | columns of input `table` |
| `format` | Text | — | — | — | — |
| `onError` | Enum | — | `error` | `error`, `null` | — |
| `name` | Text | — | — | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `column` | Text | — | — | — | columns of input `table` |
| `part` | Enum | — | — | `year`, `quarter`, `month`, `week`, `dayOfMonth`, `dayOfWeek`, `dayOfYear`, `hour`, `minute`, `second` | — |
| `name` | Text | — | — | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `column` | Text | — | — | — | columns of input `table` |
| `period` | Enum | — | — | `year`, `quarter`, `month`, `week`, `day`, `hour` | — |
| `name` | Text | — | — | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `a` | Text | — | — | — | — |
| `b` | Text | — | — | — | — |
| `unit` | Enum | — | `days` | `years`, `months`, `days`, `hours`, `minutes`, `seconds` | — |
| `name` | Text | — | — | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `column` | Text | — | — | — | columns of input `table` |
| `amount` | Integer | — | — | — | — |
| `unit` | Enum | — | `days` | `years`, `months`, `days`, `hours`, `minutes` | — |
| `name` | Text | — | — | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `column` | Text | — | — | — | columns of input `table` |
| `from` | DateTime | — | — | — | — |
| `to` | DateTime | — | — | — | — |

## Viz — `BimOpenFlow.Nodes.Viz`

Chart and table-view nodes that validate and project table data for the web panes; rendering stays client-side.

### `chart.bar` (v1) — Pure

Projects 'labelColumn' plus the comma-separated numeric 'valueColumns' for the bar-chart pane; 'sort' orders rows by the first value column. 'layout' draws the bars vertical, horizontal, or stacked, and 'colorBy' says what their colours encode: one hue per category or per series, none for the single accent, or auto (category for one value column, series for several). With a 'scale' input, appends 'r g b' colour columns computed from the scale's column (or the first value column) and passes the scale through on 'legend'; without one, 'legend' is the empty legend table.

With a `scale` input, colours each bar by looking up the scale's column (or, if the projection dropped it, the first value column, with a warning) in the source table and appending `r g b` columns; pre-existing `r`, `g`, or `b` columns from the projection are dropped first, with a warning naming them. Bars outside the scale's domain warn once, by count. The scale is passed through unchanged on `legend`, so the chart and its source scale (or a 3D pane sharing it) report the same domain. Without a `scale` input, `legend` is the empty legend table and bars keep their default fill.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |
| `scale` | Table | optional |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |
| `legend` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `labelColumn` | Text | — | — | — | columns of input `table`, labels and categories first |
| `valueColumns` | Text (list) | — | — | — | columns of input `table`, numeric only |
| `title` | Text | — | — | — | — |
| `sort` | Enum | — | `none` | `none`, `asc`, `desc` | — |
| `layout` | Enum | — | `vertical` | `vertical`, `horizontal`, `stacked` | — |
| `colorBy` | Enum | — | `auto` | `auto`, `category`, `series`, `none` | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `xColumn` | Text | — | — | — | columns of input `table` |
| `yColumns` | Text (list) | — | — | — | columns of input `table`, numeric only |
| `title` | Text | — | — | — | — |

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `title` | Text | — | — | — | — |
| `columns` | Text (list) | — | — | — | columns of input `table` |

### `view.colormap` (v1) — Pure

Builds a legend table (the shared colour scale) for 'valueColumn' of 'values'; wire the 'legend' output into view3d.color's or chart.bar's 'scale' input so both panes share one colour scale. An unknown column warns and emits an empty legend.

`ColorScale.Build` exposed as its own node, so a 3D pane and a chart pane over the same column share one colour scale: wire this node's `legend` output into both consumers' `scale` inputs and they colour identically and report the same domain. An unknown `valueColumn` warns and emits the empty legend table rather than failing the graph. `auto`/`min`/`max`/`colorMap` behave exactly as they do on `view3d.color`, including the clamp warning and the fallback to the automatic domain when `min >= max`.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `values` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `legend` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `valueColumn` | Text | — | — | — | columns of input `values` |
| `colorMap` | Enum | — | `viridis` | `viridis`, `category10`, `redgreen` | — |
| `auto` | Boolean | — | `true` | — | — |
| `min` | Number | — | `0` | — | — |
| `max` | Number | — | `1` | — | — |

### `view.note` (v1) — Pure

A comment on the canvas; computes nothing and has no ports.

**Inputs**: none

**Outputs**: none

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `text` | Text | — | — | — | — |

## Spatial — `BimOpenFlow.Nodes.Spatial`

GIS-style predicates and measures (intersects, within, nearest, contains, footprints, polygons) over point, box, and WKT polygon columns; every join emits a pairs table. BIM-free and DuckDB-free.

### `spatial.intersects` (v1) — Pure

Emits one row per (a, b) pair whose boxes intersect: A ('aKey' of the a row), B ('bKey' of the b row), and OverlapVolume (zero when the boxes only touch). Each input is read as boxes when it has MinX..MaxZ columns, else as points from the x, y, z columns. With excludeSelf, pairs whose two keys are equal are dropped, so a table joined to itself lists only distinct clash candidates (each unordered pair twice, once per direction). Axis-aligned-box semantics: candidates, not mesh clashes. Rows with missing coordinates never match.

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `aKey` | Text | — | `Name` | — | columns of input `a` |
| `bKey` | Text | — | `Name` | — | columns of input `b` |
| `x` | Text | — | `CenterX` | — | columns of input `a` |
| `y` | Text | — | `CenterY` | — | columns of input `a` |
| `z` | Text | — | `CenterZ` | — | columns of input `a` |
| `excludeSelf` | Boolean | — | `true` | — | — |

### `spatial.within` (v1) — Pure

Emits one row per (a, b) pair whose boxes are at most 'distance' apart: A, B, and Distance. With measure = box the distance is between the boxes' surfaces (zero when they intersect); with center it is between their centers. Each input is read as boxes when it has MinX..MaxZ columns, else as points from the x, y, z columns. excludeSelf drops pairs whose keys are equal. Axis-aligned-box semantics: candidates, not clearances. Typical use: rooms within 3 m of a stair.

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `distance` | Number | — | — | — | — |
| `measure` | Enum | — | `box` | `box`, `center` | — |
| `aKey` | Text | — | `Name` | — | columns of input `a` |
| `bKey` | Text | — | `Name` | — | columns of input `b` |
| `x` | Text | — | `CenterX` | — | columns of input `a` |
| `y` | Text | — | `CenterY` | — | columns of input `a` |
| `z` | Text | — | `CenterZ` | — | columns of input `a` |
| `excludeSelf` | Boolean | — | `true` | — | — |

### `spatial.nearest` (v1) — Pure

Emits, for each a row, its 'k' nearest b rows: A, B, Distance, and Rank (1 = closest). With measure = box the distance is between the boxes' surfaces (zero when they intersect); with center it is between their centers. Ties keep b's row order. Each input is read as boxes when it has MinX..MaxZ columns, else as points from the x, y, z columns. excludeSelf drops the b row whose key equals a's. An a row with missing coordinates, or an empty b, produces no rows. Typical use: the three nearest fire extinguishers to each room.

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `k` | Integer | — | `1` | — | — |
| `measure` | Enum | — | `box` | `box`, `center` | — |
| `aKey` | Text | — | `Name` | — | columns of input `a` |
| `bKey` | Text | — | `Name` | — | columns of input `b` |
| `x` | Text | — | `CenterX` | — | columns of input `a` |
| `y` | Text | — | `CenterY` | — | columns of input `a` |
| `z` | Text | — | `CenterZ` | — | columns of input `a` |
| `excludeSelf` | Boolean | — | `true` | — | — |

### `spatial.contains` (v1) — Pure

Emits one row per (a, boxes) pair where the boxes row's box contains a's box or point entirely: A, B, and ContainerVolume. With smallest (the default) only the smallest container of each a row is kept, so the output has at most one row per a row; with ignoreZ containment and smallest are judged in plan (XY) only. a is read as boxes when it has MinX..MaxZ columns, else as points from the x, y, z columns. excludeSelf drops pairs whose keys are equal. Rows in no box produce nothing. Typical use: element centers from bim.bounds against room boxes from bim.rooms.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `a` | Table | required |
| `boxes` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `aKey` | Text | — | `Name` | — | columns of input `a` |
| `bKey` | Text | — | `Name` | — | columns of input `boxes` |
| `x` | Text | — | `CenterX` | — | columns of input `a` |
| `y` | Text | — | `CenterY` | — | columns of input `a` |
| `z` | Text | — | `CenterZ` | — | columns of input `a` |
| `smallest` | Boolean | — | `true` | — | — |
| `ignoreZ` | Boolean | — | `false` | — | — |
| `excludeSelf` | Boolean | — | `true` | — | — |

### `spatial.footprint` (v1) — Pure

Adds a Text column ('as', default Footprint) holding the WKT POLYGON of each row's MinX..MaxY rectangle; rows with a missing bound get null. The column feeds spatial.polygon, spatial.polygonContains, and spatial.polygonIntersects, and reads unchanged in DuckDB spatial, PostGIS, or QGIS. Errors if the column already exists.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `boxes` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `as` | Text | — | `Footprint` | — | — |

### `spatial.polygon` (v1) — Pure

Adds Area, Perimeter, CentroidX, CentroidY (area-weighted), Vertices, and IsConvex computed from the WKT POLYGON in the 'polygon' column (default Footprint); rows with an empty cell get nulls, unparsable text is an error naming the row, and holes are ignored with a warning. Errors if any added column already exists.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `polygon` | Text | — | `Footprint` | — | columns of input `table` |

### `spatial.polygonContains` (v1) — Pure

Emits one row per (a, polygons) pair where the WKT POLYGON in the 'polygon' column (default Footprint) contains a's point in plan, boundary included: A, B, and Area of the polygon. a's point is the x, y columns, or the box center when a has MinX..MaxZ columns; Z is ignored. With smallest (the default) only the smallest containing polygon is kept per a row; excludeSelf drops pairs whose keys are equal. Typical use: columns inside zone outlines from a CSV.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `a` | Table | required |
| `polygons` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `aKey` | Text | — | `Name` | — | columns of input `a` |
| `bKey` | Text | — | `Name` | — | columns of input `polygons` |
| `x` | Text | — | `CenterX` | — | columns of input `a` |
| `y` | Text | — | `CenterY` | — | columns of input `a` |
| `z` | Text | — | `CenterZ` | — | columns of input `a` |
| `polygon` | Text | — | `Footprint` | — | columns of input `polygons` |
| `smallest` | Boolean | — | `true` | — | — |
| `excludeSelf` | Boolean | — | `true` | — | — |

### `spatial.polygonIntersects` (v1) — Pure

Emits one row per (a, b) pair whose WKT POLYGONs (the 'polygon' column of both inputs, default Footprint) intersect in plan, touching included: A and B. With excludeSelf, pairs whose two keys are equal are dropped. Rows with an empty polygon cell never match; holes are ignored with a warning.

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

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `aKey` | Text | — | `Name` | — | columns of input `a` |
| `bKey` | Text | — | `Name` | — | columns of input `b` |
| `polygon` | Text | — | `Footprint` | — | columns of input `a` |
| `excludeSelf` | Boolean | — | `true` | — | — |

## Value — `BimOpenFlow.Nodes.Value`

Constant text, number, integer, boolean, and file-path nodes: a value set once and shared through the parameter sockets of other nodes.

### `value.text` (v1) — Pure

Holds one Text value for a value that several nodes share through their parameter sockets. Wire its output into a bindable parameter, or edit the text here once.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `value` | Text |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `value` | Text | — | — | — | — |

### `value.number` (v1) — Pure

Holds one Number for a value that several nodes share through their parameter sockets. Wire its output into a bindable parameter, or edit the number here once.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `value` | Number |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `value` | Number | — | `0` | — | — |

### `value.integer` (v1) — Pure

Holds one Integer for a value that several nodes share through their parameter sockets. Wire its output into a bindable parameter, or edit the integer here once.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `value` | Integer |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `value` | Integer | — | `0` | — | — |

### `value.boolean` (v1) — Pure

Holds one true or false for a value that several nodes share through their parameter sockets. Wire its output into a bindable parameter, or edit the flag here once.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `value` | Boolean |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `value` | Boolean | — | `false` | — | — |

### `value.path` (v1) — Pure

Holds one file path for a value that several nodes share through their parameter sockets, such as a model file read by many nodes. Pick the file once and wire the output into each bindable path parameter.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `path` | Text |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `path` | FilePath | — | — | — | files under the model roots ending `` |

## Relations — `BimOpenFlow.Nodes.Relations`

The rel.* pack: wires carry a logical plan plus its schema instead of rows. A chain compiles to one SQL statement and runs only when inspected or materialized. Sources are named through the host's connection registry (each model root folder, and each .duckdb file inside one).

### `rel.csv` (v1) — Pure

A CSV file, named by its registered source folder and relative path. Nothing is read until a node is inspected.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `relation` | Relation |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `source` | Text | — | — | — | — |
| `path` | Text | Text | — | — | — |

### `rel.table` (v1) — Pure

A table in a registered database source. Nothing is read until a node is inspected.

**Inputs**: none

**Outputs**

| Name | Type |
|---|---|
| `relation` | Relation |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `source` | Text | — | — | — | — |
| `table` | Text | — | — | — | — |

### `rel.fromTable` (v1) — Pure

Makes the input table available to rel.* nodes as a relation, keyed by the table's content.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `table` | Table | required |

**Outputs**

| Name | Type |
|---|---|
| `relation` | Relation |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `name` | Text | — | `t` | — | — |

### `rel.sql` (v1) — Pure

One read-only SELECT over the connected relations, which it sees as t1, t2, and t3.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `t1` | Relation | required |
| `t2` | Relation | optional |
| `t3` | Relation | optional |

**Outputs**

| Name | Type |
|---|---|
| `relation` | Relation |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `sql` | Text | — | — | — | — |

### `rel.select` (v1) — Pure

Keeps only the comma-separated columns, in that order; 'column as Alias' renames one.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `input` | Relation | required |

**Outputs**

| Name | Type |
|---|---|
| `relation` | Relation |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `columns` | Text (list) | — | — | — | columns of input `input` |

### `rel.filter` (v1) — Pure

Keeps rows where the Boolean expression is true.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `input` | Relation | required |

**Outputs**

| Name | Type |
|---|---|
| `relation` | Relation |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `expr` | Expression | — | — | — | — |

### `rel.derive` (v1) — Pure

Appends a column computed from the expression.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `input` | Relation | required |

**Outputs**

| Name | Type |
|---|---|
| `relation` | Relation |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `name` | Text | — | — | — | — |
| `expr` | Expression | — | — | — | — |

### `rel.sort` (v1) — Pure

Sorts by comma-separated terms such as 'height desc, name'.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `input` | Relation | required |

**Outputs**

| Name | Type |
|---|---|
| `relation` | Relation |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `by` | Text (list) | — | — | — | columns of input `input` |

### `rel.limit` (v1) — Pure

Keeps count rows after skipping offset rows.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `input` | Relation | required |

**Outputs**

| Name | Type |
|---|---|
| `relation` | Relation |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `count` | Integer | — | `100` | — | — |
| `offset` | Integer | — | `0` | — | — |

### `rel.aggregate` (v1) — Pure

Groups by the comma-separated columns (may be empty) and computes 'func(column) as name' aggregates (count/sum/min/max/avg).

**Inputs**

| Name | Type | Required |
|---|---|---|
| `input` | Relation | required |

**Outputs**

| Name | Type |
|---|---|
| `relation` | Relation |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `groupBy` | Text (list) | — | — | — | columns of input `input` |
| `aggregates` | Text (list) | — | — | — | columns of input `input`, each with the aggregate functions its type allows |

### `rel.join` (v1) — Pure

Joins left to right on one key each. Right columns that collide with left ones get a _right suffix.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `left` | Relation | required |
| `right` | Relation | required |

**Outputs**

| Name | Type |
|---|---|
| `relation` | Relation |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `leftKey` | Text | — | — | — | columns of input `left`, keys shared with `right` first |
| `rightKey` | Text | — | — | — | columns of input `right`, keys shared with `left` first |
| `kind` | Enum | — | `inner` | `inner`, `left`, `right`, `full`, `semi`, `anti` | — |

### `rel.materialize` (v1) — Pure

Runs the relation and outputs its rows as a Table; limit 0 means every row.

**Inputs**

| Name | Type | Required |
|---|---|---|
| `input` | Relation | required |

**Outputs**

| Name | Type |
|---|---|
| `table` | Table |

**Params**

| Name | Kind | Socket | Default | Allowed values | Suggestions |
|---|---|---|---|---|---|
| `limit` | Integer | — | `0` | — | — |
