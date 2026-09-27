# Snowdon federation: one model from seven discipline IFC files

> Investigation, 2026-09-26. Answers the open question in TKT-2 (and feeds
> TKT-7 and TKT-13): how the seven Snowdon Towers IFC files are merged into one
> BIM Open Schema (BOS) model in which storeys, rooms and spaces, grids, zones,
> systems, and the project, site, and building have one shared identity, while
> every element keeps its source file, and where in the toolkit that merge
> belongs. Every claim carries a label: **ran** (observed in the spike),
> **source** (read in this repository's code or the IFC files), **docs**
> (official documentation or specification), **report** (third-party
> documentation, articles, issues), **inferred** (reasoned from the others).
> The spike scripts are throwaway and live outside the repository.

## The question and the decision it feeds

The owner has decided that the canonical Snowdon data for analyses, charts, and
Claude demos comes from the seven discipline IFC files merged together, not
from the single Architectural BOS used today. Each file carries its own
storeys, spaces, grids, and project/site/building; after the merge they need a
shared identity. The decision is where the merge lives:

- (a) a multi-file input to the IFC-to-BOS converter (`src/data/Ara3D.Ifc.Bos`);
- (b) the existing `Ara3D.BimOpenSchema.Harmonizer`;
- (c) the BuildingModel mapping (`src/data/Ara3D.BimOpenSchema.BuildingModel*`);
- (d) a BimOpenFlow node pack operating on tables;
- (e) SQL views in DuckDB;

or a combination in a stated order. The fact that would change the decision
most: whether storey and space identity can be established by a plain join on
keys already in the files, or needs geometry.

**Short answer.** Storeys and grids join on existing attributes (storey
elevation plus name, grid axis tag); no geometry is needed. The GlobalId is
not a usable key: no element GlobalId repeats across files, and two of the ten
storey GlobalIds that do repeat name different storeys. Spaces are three
different Revit concepts exported under one IFC class (Rooms, Areas, and MEP
Spaces); an MEP Space links to an Architectural Room through a Revit-computed
"Room Number" property, a plain join that the footprint check confirms for 85
of 87 claims. That link is containment, not sameness. The merge should be a
union of per-file conversions (seven documents in one BOS), followed by a
matching step written as SQL and run as BimOpenFlow nodes that writes a
persisted correspondence table with evidence columns, which the BuildingModel
mapping then reads. Details and the rejected alternatives follow.

## The facts from the files

Method: a Python line scan of the STEP text (`ifcopenshell` is not installed
in this environment) that resolves placements, relationships, property sets,
grid axis lines, and space footprints (extruded profiles, or the downward
faces of tessellated bodies) [ran: `scan.py`, then `t1`..`t13` comparison
scripts in the spike folder]. All seven headers read `FILE_SCHEMA(('IFC4'))`,
`Autodesk Revit 24.0.5.432 - IFC 24.0.5.432`, view definition
`ReferenceView_V1.2`, `CoordinateBase: Survey Point`, dated 2023-08-17
[source: file headers].

### Counts

| Entity | Arch (A) | Struct (S) | HVAC (M) | Plumb (P) | Elec (E) | Facades (F) | Site (C) |
|---|---|---|---|---|---|---|---|
| IfcProject | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| IfcSite | 76 | 1 | 1 | 1 | 1 | 1 | 13 |
| IfcBuilding | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| IfcBuildingStorey | 18 | 12 | 11 | 11 | 11 | 11 | 3 |
| IfcSpace | 154 | 7 | 67 | 8 | 80 | 0 | 0 |
| IfcZone | 0 | 0 | 1 | 1 | 1 | 0 | 0 |
| IfcGrid | 36 | 11 | 11 | 11 | 11 | 11 | 0 |
| IfcGridAxis | 504 | 165 | 165 | 165 | 165 | 110 | 0 |
| IfcSystem | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| IfcDistributionSystem | 0 | 0 | 148 | 71 | 448 | 0 | 0 |
| IfcGroup | 43 | 15 | 0 | 0 | 0 | 65 | 1 |
| IfcRelContainedInSpatialStructure | 62 | 19 | 51 | 12 | 79 | 11 | 3 |
| IfcRelAggregates | 96 | 86 | 13 | 5 | 9 | 3 | 4 |
| IfcRelSpaceBoundary | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| IfcMapConversion / IfcProjectedCRS | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Products (IfcProduct occurrences) | 7,426 | 1,617 | 8,297 | 19,819 | 5,899 | 472 | 100 |
| of which IfcDistributionPort | 533 | 0 | 5,579 | 13,373 | 3,367 | 0 | 0 |

[ran: `t1_counts.py`; products are IfcRoot occurrences that are not
relationships, property definitions, types, groups, or the project]

Only one IfcSite per file is the spatial site (aggregated under IfcProject).
The other 75 in Architectural are families named "Sculpture" and "Tree Grate";
the other 12 in Site are neighbouring blocks ("Block 29", "Union Station",
"Brownsville Arch") [ran: `t3_site.py`]. A mapping that treats every IfcSite as
"the site" finds 76 sites in Architectural.

### Project, site, building, and coordinates

| Fact | Result across the seven files |
|---|---|
| IfcProject GlobalId | 7 distinct values |
| IfcProject Name | the file's project number, 7765328-33-A, -S, -M, -P, -E, -F, -C |
| IfcProject LongName | "Snowdon Towers" in all 7 |
| Phase | "Construction Documents" in A, S, F, C; "Design Development" in M, P, E |
| IfcSite GlobalId / Name | 7 distinct / "Default" in all 7 |
| IfcBuilding GlobalId / Name | 7 distinct / "Snowdon Towers" in all 7 |
| Site RefLatitude, RefLongitude | identical: 40°1'20.54", -79°53'11.99" |
| Site placement | identical: origin (2.2322, 1.4122, 792.5) ft, x axis (0.898675, 0.438615, 0) |
| Building placement | identical to the site's |
| Context WorldCoordinateSystem | identical: translation (1370149.563103, 258246.564049, -12.0) ft |
| TrueNorth / precision | identical: (0, 1, 0) / 0.0001 |
| Length unit | FOOT (IfcConversionBasedUnit) in all 7 |
| Storey placements | all 77 share the site's plan origin and x axis; world Z = Elevation + 792.5 ft in every file |

[ran: `t3_site.py`, `t2_storeys.py`, and a placement check]

So the identity of project, site, and building cannot come from GlobalIds or
the project Name; it can come from the building Name, the project LongName,
and the identical placements. Geometry from different files lines up without
a transform, provided one loader converts all seven the same way (the frames
are byte-identical) [inferred: from the identical context and placement
chains].

### Storeys

77 storey rows, 63 distinct GlobalIds, 27 distinct names, 27 distinct
elevations [ran: `t12_cluster.py`]. `Name` equals `LongName` for all 77
[ran: `t2_storeys.py`]. Elevations in feet:

| Elevation | A | S | M | P | E | F | C |
|---|---|---|---|---|---|---|---|
| -792.0 | | | | | | | Datum |
| -22.9167 | | Elevator Pit | | | | | |
| -16.9167 | Parking | Parking | Parking | Parking | Parking | | |
| -5.9167 | L1 - Block 35 | L1_35_Low | L1 - Block 35 | L1 - Block 35 | L1 - Block 35 | L1 - Block 35 | |
| -3.4583 | L1 - Block 37 | L1_37_Med | L1 - Block 37 | L1 - Block 37 | L1 - Block 37 **at -3.5** | | |
| 0.0 | L1 - Block 43 | L1_43_High | L1 - Block 43 | L1 - Block 43 | L1 - Block 43 | L1 - Block 43 | Project |
| 5.5 | M1 | M1 | M1 | M1 | M1 | | |
| 8.0833 | L2 | L2 | L2 | L2 | L2 | L2 | |
| 13.6667 | | | | | | L2 - Block 39 | |
| 18.8333 | L3 | L3 | L3 | L3 | L3 | L3 | |
| 20.0 | | | | | | | WV_Cut at 20' |
| 25.8333 | | | | | | L3 - Block 39 | |
| 32.1667 | L4 | L4 | L4 | L4 | L4 | L4 | |
| 45.5 | L5 | L5 | L5 | L5 | L5 | L5 | |
| 47.67 (F: 47.42) | Block 37 - Parapet | | | | | Block 37 - Parapet | |
| 51.17 (F: 51.08) | Block 43 - Parapet | | | | | Block 43 - Parapet | |
| 52.6667 | R1 | | R1 | R1 | R1 | | |
| 54.67 (F: 54.58) | Block 39 - Parapet | | | | | Block 39 - Parapet | |
| 58.8333 | R2 | R2 | R2 | R2 | R2 | | |
| 59.9167 | Green Roof Hardscape | | | | | | |
| 63.5 | Parapet | | | | | | |
| 68.8333 | R3 | | | | | | |
| 70.8333 | Parapet 2 | Parapet 2 | | | | | |

[ran: `t2_storeys.py`, `t3_site.py`]

GlobalIds shared across files (10 of 63):

| GlobalId | Files | Meaning in each file |
|---|---|---|
| `13IqgdyW163BExhxLiEU…` (8 ids) | A, F | same names; L1 - Block 35/43, L2..L5 at equal elevations; Block 37 and Block 43 Parapet 0.25 ft and 0.083 ft apart |
| `2JF4e6axWHqu3u0C1FZlmi` | M, P, E, C | "L1 - Block 43" at 0.0 in M, P, E; "Project" at 0.0 in C |
| `1ZGO8hrFCHqw0v0026FpFv` | M, P, E, C | "L2" at 8.0833 in M, P, E; **"Datum" at -792.0 in C** |

[ran: `t2_storeys.py`]

What the storey facts say:

- A GlobalId match is neither necessary nor sufficient. The same storey (L2)
  has three GlobalIds across six files, and one GlobalId names L2 in three
  files and a datum 800 ft lower in the fourth [ran]. Revit derives a storey's
  GlobalId from the level's own identifier [report: Autodesk/revit-ifc
  `GUIDUtil.cs`, via the landscape search], so equal GlobalIds only mean the
  levels descend from one Revit element, here most likely a shared template
  (M, P, E, C) and a Facades model split from Architectural (A, F) [inferred:
  from the shared prefixes and matching names].
- Exact name matches cover most storeys but miss Structural's three L1 levels
  (`L1_35_Low`, `L1_37_Med`, `L1_43_High`), which sit at exactly the
  Architectural L1 elevations [ran].
- Elevation clusters at a tolerance of 0.05 ft (15 mm) give 26 clusters, 12 of
  them spanning more than one file; no cluster ever holds two storeys from one
  file, at any tolerance up to 0.3 ft [ran: `t12_cluster.py`]. Three clusters
  carry more than one name: the three L1 levels (Structural names) and the
  0.0 cluster, which also holds Site's "Project" level [ran].
- Four conflicts must stay visible, not be resolved silently: Electrical's
  "L1 - Block 37" 0.0417 ft (12.7 mm) below the other four files; the three
  parapets whose names agree between A and F but whose elevations differ by
  0.083 to 0.25 ft (25 to 76 mm), two of them with the same GlobalId; Site's
  "Project" level at 0.0; and the GlobalId shared by "L2" and "Datum" [ran].

### Spaces

One IFC class, three Revit concepts, told apart by the exported property
`Other.Category`:

| File | IfcSpace | Revit category | Notes |
|---|---|---|---|
| Architectural | 154 | 54 Rooms, 100 Areas | Areas: two area schemes (ids 32254: 86, 32250: 14), types Major Vertical Penetration 35, Floor Area 24, Building Common Area 13, Gross Building Area 10, Exterior 9, Store 6, Office 3 |
| Structural | 7 | 7 Areas | one Gross Building Area per level ("Parking", "L1", ..., "Roof") |
| HVAC | 67 | 67 Spaces | |
| Plumbing | 8 | 8 Spaces | |
| Electrical | 80 | 80 Spaces | |

[ran: `t8_join2.py`] Every IfcSpace is aggregated to a storey of its own file
[ran]. Architectural room numbers are unique among the 54 Rooms; the 4
duplicated numbers ("11" to "14") belong to Areas [ran]. `Name` is the number
and `LongName` the name for all 154 Architectural spaces [ran: `t7_join.py`].

MEP Spaces carry two Revit properties the Rooms do not: `Identity Data.Room
Number` and `Identity Data.Room Name`, which Revit computes as the room (in
the linked Architectural model) that contains the space, or "Unoccupied"
[ran: `t6b.py`]. Joining on them, then checking each claim against the
footprints (the share of the space's plan area inside the claimed room,
sampled on a 0.5 ft grid, with the space's base inside the room's height):

| File | Spaces | Room Number found among A's Rooms | Room Name agrees | Footprint confirms (≥90% inside) | "Unoccupied" | Unoccupied but ≥50% inside some A room |
|---|---|---|---|---|---|---|
| HVAC | 67 | 40 | 40 | 38 | 27 | 2 |
| Plumbing | 8 | 0 | – | – | 8 | 5 |
| Electrical | 80 | 47 | 47 | 47 | 33 | 0 |

[ran: `t8_join2.py`, `t9_geom.py`] The two HVAC claims the footprints reject
are space 108 (claims room 108, no overlap) and space M100 "Mezzanine Dining"
on M1 (claims room 200 on L2, lies 92% inside room 101 "Café") [ran]; the
property is a value Revit computed at export time against whatever link
state it had, so it can be stale [inferred]. No Architectural room is claimed
by two spaces of one file; 47 of 54 rooms are claimed by at least one MEP
file [ran]. The storey of the space and the storey of its room differ in 4
HVAC and 10 Electrical claims: in Electrical all 10 spaces sit on "L1 - Block
43" while their rooms are based on Parking, "L1 - Block 35", "L1 - Block 37",
or L2; in HVAC they are two stair and elevator spaces on Parking, space 108,
and M100 [ran: `t8_join2.py`]. Storey agreement is therefore not a usable
condition for a space-to-room match.

The naive key, the space's own number, is wrong more often: in HVAC it hits
42 Architectural room numbers, of which 6 are different rooms (space 201
"Electrical" would join room 201 "Corridor"); in Plumbing 2 of 7 [ran:
`t13_naive.py`].

### Grids

Revit exports one IfcGrid per storey (Architectural: two per storey, split by
axis direction), so the IfcGrid is a per-storey copy, not the grid [ran:
`t4_grids.py`]. The identity is the axis tag: 28 distinct tags across files,
15 in S, M, P, E, 10 in F (facade reference lines), all 28 in A. For every
tag present in two files, the axis lines coincide as infinite lines within
0.001° and 0.001 ft; only their drawn extents differ [ran: `t5_gridlines.py`].
Two IfcGrid GlobalIds repeat across M, P, E, one on each storey whose
GlobalId they share [ran: `t10_guids.py`].

### Zones and systems

| Concept | Facts |
|---|---|
| IfcZone | One zone, "Default:378251", in each of M, P, E, **with the same GlobalId** `0z4yVJ2l13GQZS79e3imPd`, holding that file's spaces (67, 8, 80). Architectural has none. [ran: `t11_groups.py`] |
| IfcDistributionSystem | HVAC 148 (Ventilation 111, Exhaust 37); Plumbing 71 (Domestic Hot Water 32, Exhaust 31, Domestic Cold Water 5, Sewage 3); Electrical 448 (Electrical), with only 58 distinct names ("1", "2,4", ...). No system GlobalId repeats. 31 names repeat between HVAC and Plumbing ("Mechanical Exhaust Air 1" ...), which are Revit's automatic per-model names. [ran: `t11_groups.py`] |
| IfcGroup | Model groups (A 43, F 65, C 1) and rebar groups (S 15); per-file assemblies, no cross-file meaning. [ran] |

### Element GlobalIds

Of 462,945 distinct IfcRoot GlobalIds, 164 occur in more than one file: 106
property sets, 27 property relationships, 10 storeys, 10 containment
relationships, 3 aggregation relationships, 2 type relationships, 2 grids,
2 types, 1 zone, 1 group assignment. No physical element repeats; every
repeat has the same IFC class in each file [ran: `t10_guids.py`]. A union of
the seven files therefore keeps every element's source unambiguously, and a
merge that deduplicates by GlobalId would fuse property sets and relationship
objects that belong to different files [inferred].

## What the toolkit does today

- **One file per conversion.** `IfcToBosConverter` takes one input path, adds
  one `Document` (file name and path), and gives each entity its GlobalId,
  that document, its class as category, and its type [source:
  `src/data/Ara3D.Ifc.Bos/IfcToBosConverter.cs`]. Nothing in `src/` converts
  or opens more than one IFC at a time [source: search for `AddBimData` and
  `AddDocument`].
- **Storeys, spaces, containment.** IfcRelContainedInSpatialStructure becomes
  `ContainedIn`; IfcRelAggregates and IfcRelAssignsToGroup both become
  `MemberOf` (so a space is `MemberOf` its storey, and an element `MemberOf`
  its system) [source: `src/data/Ara3D.IfcLoader/IfcRelations.cs`,
  `Ara3D.Ifc.Bos/IfcRelationMapping.cs`]. IfcRelServicesBuildings is not read
  [source]. Storey `Elevation` and `LongName` become `Ifc:Elevation` and
  `Ifc:LongName` parameters; the IfcSpace `Name` also becomes `Ifc:Room:Number`
  [source]. Object placements are dropped (they point at non-element entities)
  [source: `ProcessAttributeAsProp`]. Space geometry is kept with the hidden
  flag [source: `HiddenIfcNames`].
- **A union primitive exists.** `BimDataBuilder.AddBimData(bd, title, path)`
  appends a dataset as a new document and keeps duplicates; the Harmonizer is
  its only caller [source: `src/data/Ara3D.BimOpenSchema.ObjectModel/BimDataBuilder.cs`].
- **The Harmonizer is single-dataset vocabulary work.** It copies one
  `IBimData` and appends canonical `Bos:` categories and SI parameters, plus a
  `Bos:Level` parameter from `ContainedIn`-to-storey relations. It has no
  notion of several documents or of matching. It maps IFCSPACE, Revit
  "Rooms", and Revit "Spaces" to one canonical category "Space", and it
  assumes IFC values are already SI [source:
  `src/data/Ara3D.BimOpenSchema.Harmonizer/BosHarmonizer.cs`,
  `CategoryMappings.cs:30`, `UnitConversion.cs`]. All seven Snowdon files are
  in feet [ran], so `Bos:Elevation` from these files would be feet labelled
  metres [inferred].
- **The BOS specification** is "for a discipline or federated model": every
  entity carries a document index, and the relation vocabulary is a closed
  enumeration of 15 kinds (`PartOf`, `MemberOf`, `ContainedIn`, `HostedBy`,
  `ChildOf`, `HasLayer`, `HasMaterial`, `ConnectsTo`, `HasConnector`,
  `BoundedBy`, `TraverseTo`, `Voids`, `Fills`, `Covers`, `Serves`). A relation
  row has no attributes, so it cannot carry evidence; parameters can be
  entity-typed, and a `Diagnostics` table exists [source:
  `submodules/bim-open-schema/src/Ara3D.BimOpenSchema/BimOpenSchema.cs`].
  There is no "same as" relation.
- **The BuildingModel already models correspondence.** `BimObject` (shared
  identity, with `IdentityStatus` Provisional, Reconciled, or Disputed),
  `SourceDocument`, `SourceRevision`, `SourceObject`, `InterpretationPolicy`,
  `Evidence`, and `ObjectCorrespondence` ("Candidates do not authorize
  merging", status Candidate, Confirmed, or Rejected) are defined [source:
  `src/data/Ara3D.BimOpenSchema.BuildingModel/IdentityAndEvidence.cs`]. The
  projection has an `ObjectCorrespondences` table that nothing fills [source:
  `BuildingModel.Workflows/Contracts.cs:60`, search]. The mapper keys identity
  by document plus GlobalId, so seven documents give seven storeys named L2,
  and its policy text says "Global identifiers are document scoped" and
  "Documents are not buildings" [source: `Mapping/MappingKernel.cs`,
  `InitializeIdentity` and `Build`].
- **The Rooms/Spaces conflation is in the mapping code.** `CoreMapping` claims
  "Rooms", "Spaces", and "IfcSpace" as `Space` [source:
  `Mapping/Domains/CoreMapping.cs:12`]; `PlacesMapping` claims the Revit
  category "Areas" as `Zone`, but an IFC input reaches it only as IFCSPACE, so
  Snowdon's 107 Areas would become `Space` rows [source:
  `Mapping/Domains/PlacesMapping.cs`; inferred for IFC input].
  (`docs/plans/BUILDING-MODEL-STATUS.md` does not discuss this; it describes
  the project split.) The `Space.Number` field reads the aliases "Number",
  "Room Number", and `Ifc:Room:Number`, and disagreeing values become
  `Conflicting` [source: `CoreMapping.cs`, `MappingKernel.Resolve`]. For an
  MEP Space, "Room Number" is the containing room, so every space whose own
  number differs from its room's loses its number: 32 of 67 in HVAC, 33 of 80
  in Electrical, 8 of 8 in Plumbing [inferred: source plus `t7_join.py`].
- **Prior design text agrees with the direction below.**
  `docs/proposals/bim-query-platform/PLAN.md` says "Never merge across
  documents just because a local ID, name or position matches. Record
  confirmed matches, possible matches, conflicts and their evidence," and
  "Different IFC sources are not assumed aligned merely because they are
  federated into one file." `src/data/Ara3D.BimOpenSchema.DataModel/DESIGN.md`
  says federation is possible at the storage boundary with distinct source
  IDs but "there is no implemented merge API". `docs/ARCHITECTURE.md` calls
  BOS "Federated by construction" (a document index on every entity) [source].
- **Tools a matching step can use.** `bos.load` and `bos.query` (SQL over a
  loaded BOS), the DuckDB nodes, `spatial.polygonContains` and
  `spatial.polygonIntersects` over WKT footprints, and `view3d.instances` /
  `view3d.boundingBoxes` for world boxes per GlobalId; run records pin a
  graph's hash and inputs [source: `src/flow/BimOpenFlow.Nodes.*/README.md`,
  `docs/ARCHITECTURE.md`]. No node derives a plan footprint from a mesh; the
  spike's bounding-box approximation misassigned rooms that the true
  footprints did not [ran: first and second runs of `t9_geom.py`].

## How others do it

| Tool | What it does across files | Shortfall against shared identity |
|---|---|---|
| Revit Copy/Monitor | Copies a linked model's level or grid into the host as a new element and records a monitoring link; Coordination Review reports later changes. [docs: help.autodesk.com Revit Collaborate, Copy/Monitor] | The copy has its own UniqueId; the link lives inside Revit and is not exported. Acquire/Publish Coordinates share only origin and north. [docs] |
| Revit IFC exporter | Storey GlobalId derived from the level; project, site, building GlobalIds from Project Information parameters (for example `IFC_BUILDING_GUID`) or else a per-document value. [report: github.com/Autodesk/revit-ifc `GUIDUtil.cs`] | Matches only when levels share a Revit ancestor, which also produces false matches (the Datum/L2 case above). Filling the Project Information GUID parameters by hand is the documented way to align project, site, building. [report; ran for the Snowdon behaviour] |
| Navisworks | A federated NWF references appended files; the selection tree keeps each file's own hierarchy; the user picks one active grid. [docs: Navisworks help] | Coordinates only; no storey merge. [docs] |
| Solibri "Federated Floors" (9.7+) | Floors come from the architectural model; components of other models are mapped to them by elevation, beside their original storey. [docs: solibri.com article, verified] | A grouping view, not a merged identity; conflicts are fixed by hand ("Custom Relations"). [docs] |
| BIMcollab Zoom | Aligns models by global origin or site; the model tree shows each model's hierarchy. [docs: helpcenter.bimcollab.com] | No documented storey merge. [docs] |
| IfcOpenShell `ifcpatch` MergeProjects | Keeps one IfcProject, converts length units to the first model's, removes duplicate contexts; "you may end up with duplicate spatial hierarchies (i.e. 2 sites, 2 buildings, etc)". [docs: docs.ifcopenshell.org, verified] | No storey or site matching; an open request asks for name-based merging. [report: IfcOpenShell issue 7474] |
| xBIM referenced models | `AddModelReference` adds read-only models; federated queries concatenate instances. [docs: docs.xbim.net] | Union only, no deduplication or identity. [docs] |
| Simplebim deep merge | Produces one set of storeys and systems, merging storeys with the same name; original containers kept empty. [report: community.simplebim.com, search snippets only] | Name only: would miss Structural's L1 levels and would merge the parapets despite a 76 mm gap. [inferred from the facts above] |
| buildingSMART and national requirements | No buildingSMART text found requiring shared storey GlobalIds or names. The Dutch BIM basis ILS requires equal storey names and elevations across discipline models; IFC5 (alpha) composes one scene from layers that can share components. [report: digigo.nu; docs: buildingSMART IFC5-development FAQ] | Guidance puts the burden on authors; the Snowdon files do not meet it (Structural names, Electrical L1 - Block 37). [ran] |

The pattern: tools either keep each file's hierarchy side by side, or merge by
one key (name, or elevation to an architectural master) without recording
why. None keeps a match as a candidate with its evidence.

## The recommended design and where it lives

### Identity keys per concept

| Concept | Key that works on these files | Corroboration | Must stay visible |
|---|---|---|---|
| Project, site, building | The federation itself: the caller declares "these seven documents describe one project, site, building" | Building Name "Snowdon Towers" and project LongName equal in all 7; site and building placements, WCS, TrueNorth, units identical | Project Name differs per file (it is a document number); phase differs (CD vs DD); the 87 non-spatial IfcSite occurrences are not sites |
| Storey | Elevation within 0.05 ft, one storey per file per cluster | Normalised name equal; GlobalId equal | Electrical L1 - Block 37 (−12.7 mm); parapets A vs F (25–76 mm); Structural L1 names; Site "Project" at 0.0; Datum/L2 GlobalId clash |
| Grid axis | Axis tag | Infinite line equal within 0.001 ft and 0.001° | Axes present in one file only (facade lines) |
| Room (A) ↔ MEP Space | Space's `Room Number` = Room's number | Room Name equal; footprint ≥90% inside | Unoccupied spaces (68); stale claims (2); spaces inside a room without a claim (7); storey disagreements (14) |
| Area (A, S) | None across files; an Area is an area-scheme member, a zone kind | Area scheme id, area type | Must not be counted as rooms |
| Zone | None; the shared "Default" GlobalId is a template default | – | Treat per file |
| System | None; names repeat by Revit's per-model numbering | Connectivity cannot cross files | Treat per file; a name match is not evidence |

[inferred: each row from the facts in the previous section]

The answer to the deciding question: storey identity is a plain join on
attributes already in the files (elevation, name), not on GlobalId, and needs
no geometry. Space-to-room is also a plain join (the `Room Number` property)
for the files that carry it, but it relates two different things (a space
located in a room), leaves 68 of 155 MEP spaces unassigned, and is wrong in 2
of 87 claims; a footprint check is the way to confirm claims and place
unclaimed spaces [ran; inferred].

### How a match is represented

Two layers, kept apart.

1. **The union.** One BOS with seven documents, each file converted on its own
   by the existing converter and appended with `AddBimData(bd, title, path)`.
   Nothing is renamed, deduplicated, or re-parented; each element's document
   is its source file.
2. **The correspondence.** A persisted table, one row per candidate pair or
   per member of a candidate cluster, with columns: concept (storey, grid
   axis, space-in-room, building, site, project), the source entity (document,
   GlobalId, local id), the canonical key it is matched to, the rule and its
   version (for example `storey-by-elevation/1`, tolerance 0.05 ft), the
   evidence values (elevation delta, name equal, GlobalId equal, footprint
   fraction, claimed room number), and a status: Candidate, Confirmed, or
   Rejected. A source row with no match gets a row with status Unmatched, so
   absence is a row, not a gap. A person or agent confirms or rejects; the
   confirmation is a row with its own origin (user assertion), never an edit
   of the rule's output.

Inside BOS, without a new relation kind, a confirmed storey becomes one entity
in an eighth, derived document ("Snowdon federation"), and each confirmed
source storey is related to it with `MemberOf` (a source storey is a member
of the set of storeys that are one level). The evidence cannot sit on the
relation (relations have no attributes), so it stays in the correspondence
table, and candidates and conflicts are written as `Diagnostics` rows against
the source entity [inferred: from the BOS specification]. `MemberOf` already
means aggregation and group assignment in converted IFC; a consumer tells the
federation edges apart by the target's document [source: `IfcRelations.cs`],
which is a real ambiguity and one reason the typed layer below is the better
reader.

In the BuildingModel, the same table maps one to one onto records that
already exist: a `BimObject` per canonical storey (Reconciled only when every
member is Confirmed, Disputed when a conflict remains), a `SourceObject` per
source storey, an `ObjectCorrespondence` per row with its status and policy,
and `Evidence` holding the method and values [source:
`IdentityAndEvidence.cs`]. Space-in-room is not an identity: it maps to the
MEP space's `SpatialContext.Spaces` link to the room, with evidence, and the
space keeps its own `BimObject` [inferred: from `Places.cs`].

### Where it lives, in order

1. **Convert per file (a, unchanged).** Seven runs of the existing converter.
   Two prerequisites: record the length unit per document (the files are in
   feet and the Harmonizer assumes SI for IFC), and keep the
   `Other.Category` property so Rooms, Areas, and Spaces are separable (it is
   already converted as an ordinary parameter [source: property-set loop in
   `IfcToBosConverter`]).
2. **Union (a small CLI or `bos.union` step over `AddBimData`).** Output: one
   seven-document BOS. This is the canonical Snowdon source that TKT-2 asks
   for.
3. **Match (d over e).** A BimOpenFlow graph whose rules are SQL queries
   (`bos.query` or the DuckDB nodes) over the union: the storey elevation
   clusters, the grid tag join, the `Room Number` join, and the project,
   site, building assertion check. Its output is the correspondence table,
   written to a file beside the BOS. The run record pins the BOS hash, the
   graph hash, and the table, so the matching is reproducible and an agent
   can inspect each rule's rows in the table pane. Confirmations live in a
   second, hand- or agent-edited table that the graph joins in, so re-running
   the rules never erases a decision.
4. **Views (e).** DuckDB views over the union plus the correspondence table:
   `FederatedStorey`, and a federated `StoreyOfEntity` (element → source
   storey → canonical storey) that the Snowdon sample graphs and charts group
   by. Unmatched and conflicting storeys appear as their own rows.
5. **Typed model (c).** The BuildingModel mapper reads the union and the
   correspondence table and fills `ObjectCorrespondences`, `BimObject`
   status, and space-in-room links. This needs two fixes in the mapping:
   separate Rooms, Areas, and MEP Spaces by `Other.Category` (Areas to
   `Zone`), and stop reading "Room Number" as the space's own number.

Why this order: conversion needs nothing from the other files, so it stays
per file; the union is mechanical; the matching is a set of joins with a
tolerance, which SQL states in a few lines and a person can read, and the
owner wants it inspectable and reproducible, which is what graphs and run
records give; the typed model is a consumer of decided identity, not the
place to decide it.

## Considered and rejected

| Option | Why rejected | Fact that would reopen it |
|---|---|---|
| (a) Multi-file converter that merges during conversion | Nothing in conversion needs the other files; matching inside C# conversion leaves no evidence table and makes every rule change a re-conversion of 215 MB of IFC | A need to rewrite containment to canonical storeys at write time (for example a consumer that cannot join a correspondence table), or files whose frames differ so geometry must be transformed while converting |
| (b) Harmonizer | It normalises one dataset's vocabulary and units; it has no documents, no pairs, and no place for evidence; adding matching would give it a second job | The Harmonizer becoming the one preparation step every consumer already runs, with a multi-document input |
| (c) BuildingModel alone | Its identity is document-scoped by stated policy, it runs in-process per snapshot, and its rules are C# rather than inspectable joins; it also currently conflates Rooms, Areas, and Spaces | The BuildingModel becoming the only reader of Snowdon data (no DuckDB charts), so a separate table buys nothing |
| (e) SQL views alone | Views recompute on every open and cannot hold a person's confirmation or rejection | Evidence that no match ever needs a human decision (for these files, the four storey conflicts say otherwise) |
| GlobalId join (any home) | Two of ten shared storey GlobalIds name different storeys; L2 has three GlobalIds; no element repeats | Files exported from one Revit model with Project Information GUID parameters set and levels shared by Copy/Monitor ancestry, verified by a GlobalId-to-elevation check |
| Name-only storey join | Misses Structural's L1 levels; merges parapets 76 mm apart without comment | A project standard that enforces identical names and a checker that enforces it (as the Dutch ILS asks) |
| Geometry-first space matching | Not needed for storeys or grids; for spaces the `Room Number` join already settles 85 of 87 claims | MEP files exported without the `Room Number` property (Plumbing already is), or a claim error rate well above 2 of 87 |

## Evidence

- No element GlobalId repeats across the seven files; 164 of 462,945 IfcRoot GlobalIds repeat, none of them physical elements [ran: `t10_guids.py`]
- Storey GlobalId `1ZGO8hrFCHqw0v0026FpFv` is "L2" at 8.0833 ft in HVAC, Plumbing, Electrical and "Datum" at -792 ft in Site [ran: `t2_storeys.py`]
- 77 storeys form 26 elevation clusters at 0.05 ft, 12 across files, never two from one file [ran: `t12_cluster.py`]
- Structural names its L1 levels `L1_35_Low`, `L1_37_Med`, `L1_43_High` at the Architectural L1 elevations [ran: `t2_storeys.py`]
- Electrical "L1 - Block 37" is at -3.5 ft, the others at -3.4583 ft; A and F parapets differ by 0.083 to 0.25 ft [ran: `t3_site.py`]
- Project, site, building GlobalIds differ in all seven; building Name, WCS translation, site placement, TrueNorth, and FOOT units are identical [ran: `t3_site.py`]
- Grid axis tags match and their lines coincide within 0.001 ft and 0.001° [ran: `t5_gridlines.py`]
- Architectural's 154 IfcSpace are 54 Rooms and 100 Areas; Structural's 7 are Areas; MEP IfcSpace are Revit Spaces [ran: `t8_join2.py`]
- MEP `Room Number` claims resolve 40 of 67 (HVAC) and 47 of 80 (Electrical) spaces to Architectural rooms; footprints confirm 38 and 47; Plumbing has 0 claims [ran: `t8_join2.py`, `t9_geom.py`]
- One IfcZone with the same GlobalId appears in all three MEP files with different members [ran: `t11_groups.py`]
- The converter takes one file and one document; `AddBimData` can union datasets [source: `IfcToBosConverter.cs`, `BimDataBuilder.cs`]
- The Harmonizer maps Rooms and Spaces to one category and assumes IFC is SI [source: `CategoryMappings.cs:30`, `UnitConversion.cs`]
- The BuildingModel defines `ObjectCorrespondence` with Candidate/Confirmed/Rejected, and nothing fills it [source: `IdentityAndEvidence.cs`, `Contracts.cs:60`]
- BOS relations are a closed 15-member enumeration with no attributes and no "same as" [source: `BimOpenSchema.cs`]
- ifcpatch MergeProjects leaves duplicate sites, buildings, and storeys [docs: docs.ifcopenshell.org]
- Solibri Federated Floors maps other models to architectural floors by elevation, as a view [docs: solibri.com]

## Not checked

- Whether the existing converter (web-ifc geometry) converts the 95 MB
  Architectural file, how long it takes, and whether its meshes are in feet
  or metres and include the context's survey-point translation. The frames
  are identical, so alignment holds either way if one loader converts all
  seven; the unit question matters for measures.
- Whether Plumbing's 181 duct segments and 31 exhaust systems duplicate
  HVAC's (same names, different GlobalIds); no position comparison was run.
- Architectural Rooms that span several storeys (stairs with an upper limit
  of "Parapet 2") were matched only by the base-in-height test, not by
  per-storey slices.
- The Revit exporter's GUID derivation was read through the landscape search,
  not in the exporter source myself.
- Door, window, and element containment counts per canonical storey after the
  merge, and whether sample graphs change their numbers.
- Performance of the union BOS in DuckDB and in the studio.

## Next step

Convert the seven files with the existing converter, union them with
`AddBimData` into one seven-document BOS, load it with `bos.load`, and write
the storey rule and the `Room Number` rule as two SQL queries. Done when the
queries reproduce this document's numbers (26 clusters, 12 across files, the
four storey conflicts; 40 and 47 room claims) and the elevation parameter's
unit is known. That one run settles whether step 1 needs a unit fix and
whether the union is fast enough to be the canonical Snowdon source.
