# Column vocabulary

> GENERATED FILE — do not edit by hand. Written by `bimopenflow-studio nodedocs` from the
> `ColumnKinds` registry in `Ara3D.BimOpenSchema.ObjectModel` (bim-open-data). To change it,
> change the registry and regenerate. `columns.json` holds the same list for programs.

A column kind is metadata on a column of a table: a name, a scalar type, an optional unit, a role and a meaning.
It is not a wire type; tables stay the currency. Names match ignoring case, as DuckDB identifiers do.

## Keys

Identify a row or an entity.

| Name | Type | Unit | Role | Meaning |
|---|---|---|---|---|
| `EntityIndex` | Integer |  | Key | Row number of the entity in the BOS Entities table; -1 when a row is about no entity. |
| `LocalId` | Integer |  | Key | The id the source file gave the entity (the STEP id of an IFC file, the element id of Revit). |
| `StepId` | Integer |  | Key | The EntityText view's name for LocalId. |
| `GlobalId` | Text |  | Key | The entity's globally unique id (an IfcGloballyUniqueId); empty when the source gave none. |
| `CheckId` | Text |  | Key | Identifier of the check or specification that produced the verdict. |

## Labels

Name a row for a person.

| Name | Type | Unit | Role | Meaning |
|---|---|---|---|---|
| `Name` | Text |  | Label | The entity's name, or a parameter's name in a parameter table. |
| `Number` | Text |  | Label | The room's number as a label (text, because numbers like 'A-101' occur). |
| `DoorName` | Text |  | Label | The door's name. |
| `Value` | Text |  | Label | A parameter's value as text, whatever its ValueType (the ParameterText view). The lowercase value column of chart, scale and colour tables is a number and is not this kind. |
| `NameA` | Text |  | Label | Name of the first entity of a relation. |
| `NameB` | Text |  | Label | Name of the second entity of a relation. |
| `StoreyName` | Text |  | Label | Name of the building storey above an entity. |
| `Title` | Text |  | Label | The issue's title; rows with one title form one issue (one BCF topic). |
| `Description` | Text |  | Label | What is wrong, in words. |
| `CheckTitle` | Text |  | Label | Human title of the check, shown to people. |
| `Citation` | Text |  | Label | The requirement the check enforces, as its source states it (a code clause, the IDS facets). |
| `Reason` | Text |  | Label | Why the entity got its verdict. |

## Categories

Group rows into a small set of values.

| Name | Type | Unit | Role | Meaning |
|---|---|---|---|---|
| `Category` | Text |  | Category | The entity's category: the IFC class (IFCWALL) or the Revit category. |
| `CategoryType` | Text |  | Category | The kind of the category, as the source file classifies it. |
| `Type` | Text |  | Category | The name of the entity's type (the family type of an element), or the type of a BCF issue. |
| `ClassName` | Text |  | Category | The class of the entity in the source model. |
| `Level` | Text |  | Category | Name of the level or storey the entity sits on. |
| `Document` | Text |  | Category | Title of the document (the linked or host model) the entity comes from. |
| `Workset` | Integer |  | Category | Id of the workset the entity belongs to; absent when it has none. |
| `Group` | Text |  | Category | Name of the group the entity belongs to. |
| `Discipline` | Text |  | Category | The discipline an element is assigned to (architectural, structural, mechanical, ...). |
| `RoomClass` | Text |  | Category | The class bim.classifyRooms gave the room from its name. |
| `ParameterGroup` | Text |  | Category | The group a parameter is filed under in the source tool's property dialog. |
| `ValueType` | Text |  | Category | The kind of a parameter's value: String, Number, Entity, Point and so on. |
| `Units` | Text |  | Category | The unit name the source file gave a parameter; absent when it gave none. |
| `RelationType` | Text |  | Category | The kind of a relation: PartOf, MemberOf, ContainedIn and so on. |
| `Status` | Text |  | Category | The issue's state, for example Open or Closed. |
| `Priority` | Text |  | Category | The issue's priority, for example High. |
| `Verdict` | Text |  | Category | The result of a check on an entity: Pass, Fail, or InfoNotAvailable when the model lacks what the check reads. |

## Measures

Quantities to sum, average or chart.

| Name | Type | Unit | Role | Meaning |
|---|---|---|---|---|
| `Elevation` | Number |  | Measure | Height of the level or element; absent when the model gives none. |
| `MinX` | Number |  | Measure | Smallest X of the element's bounding box. |
| `MinY` | Number |  | Measure | Smallest Y of the element's bounding box. |
| `MinZ` | Number |  | Measure | Smallest Z of the element's bounding box. |
| `MaxX` | Number |  | Measure | Largest X of the element's bounding box. |
| `MaxY` | Number |  | Measure | Largest Y of the element's bounding box. |
| `MaxZ` | Number |  | Measure | Largest Z of the element's bounding box. |
| `SizeX` | Number |  | Measure | Extent of the bounding box along X (MaxX - MinX). |
| `SizeY` | Number |  | Measure | Extent of the bounding box along Y (MaxY - MinY). |
| `SizeZ` | Number |  | Measure | Extent of the bounding box along Z (MaxZ - MinZ). |
| `CenterX` | Number |  | Measure | X of the bounding box's center. |
| `CenterY` | Number |  | Measure | Y of the bounding box's center. |
| `CenterZ` | Number |  | Measure | Z of the bounding box's center. |
| `FootprintArea` | Number |  | Measure | Area of the bounding box seen from above (SizeX * SizeY), not of the element's true footprint. |
| `Volume` | Number |  | Measure | A volume: of the bounding box in bim.bounds (SizeX * SizeY * SizeZ), of the room in bim.rooms. |
| `Diagonal` | Number |  | Measure | Length of the bounding box's space diagonal. |
| `UnboundedHeight` | Number |  | Measure | The room's unbounded height parameter; absent when the room has none. |
| `ElementCount` | Integer |  | Measure | How many elements a level or room holds. |
| `RoomCount` | Integer |  | Measure | How many rooms a level holds. |
| `Hops` | Integer |  | Measure | Doors to pass from the start room; absent when the room cannot be reached. |
| `Distance` | Number |  | Measure | Straight-line distance to the nearest candidate row, in the model's length unit. |
| `Count` | Integer |  | Measure | How many rows or entities fall in the group. |
| `Distinct` | Integer |  | Measure | How many different values a parameter takes. |
| `FillRate` | Number |  | Measure | Share of entities that carry the parameter, from 0 to 1. |
| `Depth` | Integer |  | Measure | Relations between an entity and its storey; 0 for the storey itself. |

## References

Point at a row of another table.

| Name | Type | Unit | Role | Meaning |
|---|---|---|---|---|
| `Room` | Text |  | Reference | Name of the room the entity is in, or a room's label in a hop table. |
| `Door` | Integer |  | Reference | EntityIndex of a door. |
| `FromRoom` | Text |  | Reference | Label of the room on the door's from side; 'Outside' when there is none. |
| `ToRoom` | Text |  | Reference | Label of the room on the door's to side; 'Outside' when there is none. |
| `EntityIndexA` | Integer |  | Reference | EntityIndex of the first entity of a relation. |
| `EntityIndexB` | Integer |  | Reference | EntityIndex of the second entity of a relation; for containment, the container. |
| `StoreyIndex` | Integer |  | Reference | EntityIndex of the building storey above an entity. |
