# Core BIM model

This project defines the canonical core model produced from BIM Open Schema exports. It represents the spatial, physical, systems, material, geometry and provenance concepts that can reasonably come from Revit, Archicad, IFC and similar authoring exports.

The model is intentionally not a project-management, facilities-management, compliance, or analysis-results database. Procurement, delivery and installation history; maintenance and inspections; carbon factors; egress studies; acoustic results; pricing; requirements; and derived clash or trace results belong in separately versioned applications or extension contracts. They can link to this core using `ModelSnapshot`, `BimObject`, `ReferenceKey<T>` and `SnapshotKey<T>`.

| Domain | Core records |
|---|---|
| Places | `Project`, `Site`, `Building`, `Storey`, `Space`, `SpaceBoundary`, `Zone`, `ZoneMembership` |
| Architecture | `Wall`, `Floor`, `Roof`, `Ceiling`, `Door`, `Window`, `Opening`, stairs, ramps, vertical transport, facade panels, finishes and furniture |
| Structure and site | structural members, foundations, connections, reinforcement, terrain, earthworks, paving, drainage and landscape occurrences |
| Mechanical and plumbing | systems, ports, connections, ducts, pipes, fittings, terminals, equipment, fixtures, drains and valves |
| Electrical and coordinated systems | panels, circuits, fixtures, devices, cable runs/containment, supports and penetrations |
| Materials and quantities | materials, products, assemblies, quantity scopes, observations and material uses |
| Geometry | coordinate frames, placements, external geometry representations and route segments |
| Identity and evidence | source deliveries, object correspondence, interpretation policies, evidence, properties and classifications |

The common types preserve the facts an importer needs to report accurately:

```csharp
SnapshotKey<Door>       // row identity within one prepared source snapshot
ReferenceKey<BimObject> // shared object identity across facets and snapshots
Fact<Length>            // value or an explicit unavailable state with evidence
LinkSet<Space>          // relationship rows plus coverage of the observed set
```

`Fact<T>` keeps unknown, invalid, conflicting and inapplicable values distinct from zero or false. `LinkSet<T>` keeps an unobserved collection distinct from a known empty collection. A model reader should expose simple flattened query views for schedules and grouping while retaining these details on demand.

The core model does not claim that every export supplies every field. The current BOS workflow adapter populates a small architectural slice—storeys, spaces, doors and roofs—and preserves source evidence and unresolved values. See the workflow project for the source-backed schedule, takeoff, revision-comparison and portfolio-coverage reports.

## Core boundary

Core records describe authoring intent or explicit exported observations. They do not state that a delivery was received, an asset was serviced, a design complies with a rule, a route is legal, a clash is real, or a carbon calculation is comparable. Those conclusions require inputs and policies outside an authoring export.

For example, `Door.ClearWidth` may be source-backed, while accessibility approval stays outside the core. `ServiceConnection` represents topology evidence; a shutdown trace is a derived application result. `GeometryRepresentation.Bounds` supports candidate filtering; clash confirmation remains derived analysis.

## Verification

```powershell
dotnet build BimBuildingModel.sln --no-restore
dotnet test tests/Ara3D.BimOpenSchema.BuildingModel.Tests/Ara3D.BimOpenSchema.BuildingModel.Tests.csproj --no-build --no-restore
dotnet test tests/Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests/Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests.csproj --no-build --no-restore
```

The core-boundary tests assert that lifecycle, commercial and analysis-result records cannot re-enter this assembly unnoticed.
