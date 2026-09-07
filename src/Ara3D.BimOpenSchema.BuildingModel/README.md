# Building model — C# review edition 0.1

This project defines the **human-facing building data model**: recognizable things, useful measurements, relationships, observations and results. Start with the domain files below. They are actual compilable C# records with field documentation, rather than a list of proposed classes.

The model supports review of an incomplete building as well as a detailed federation. A named room can exist before its enclosure is known. A toilet can have an identity and room assignment while its plumbing connections remain unexported. A bid can report a measured subtotal and list the scope still unpriced.

## Where to look

| Domain and C# file | Records | People and decisions |
|---|---|---|
| [Places.cs](Places.cs) | `Project`, `Site`, `Building`, `Storey`, `Space`, `SpaceBoundary`, `Zone`, `ZoneMembership` | Architects, owners, facilities, project managers: navigate a federation, review the room program, group by level, tenant or service zone. |
| [Architecture.cs](Architecture.cs) | `Wall`, `Floor`, `Roof`, `Ceiling`, `Door`, `Window`, `Opening`, `Stair`, `StairFlight`, `Landing`, `Ramp`, `VerticalTransport`, `Railing`, `FacadePanel`, `FinishSurface`, `Furniture` | Architects, roofers, glazing/door suppliers, partition and finishing trades: schedules, measurable construction scope, circulation and room fitout. |
| [StructureAndSite.cs](StructureAndSite.cs) | `StructuralMember`, `Foundation`, `StructuralConnection`, `ReinforcementGroup`, `TerrainSurface`, `EarthworkZone`, `PavedArea`, `DrainageCatchment`, `PlantingArea`, `LandscapeAsset` | Structural/civil engineers, concrete and steel trades, landscapers: member schedules, material takeoffs, cut/fill, site drainage and planting. |
| [MechanicalAndPlumbing.cs](MechanicalAndPlumbing.cs) | `ServiceSystem`, `SystemMembership`, `ServicePort`, `ServiceConnection`, `DuctSegment`, `DuctFitting`, `AirTerminal`, `Damper`, `AirHandlingUnit`, `Fan`, `Pump`, `PipeSegment`, `PipeFitting`, `Valve`, `SanitaryFixture`, `ToiletSpecification`, `Drain`, `FireProtectionTerminal` | Mechanical/plumbing/fire trades and engineers: sizes, media, airflow, isolation, room services, fixture schedules and network evidence. |
| [ElectricalAndSystems.cs](ElectricalAndSystems.cs) | `ElectricalPanel`, `ElectricalCircuit`, `LightingFixture`, `ElectricalDevice`, `CableSegment`, `CableContainment`, `ServiceSupport`, `ServiceSupportAttachment`, `ServicePenetration`, `PenetratingService` | Electricians, controls trades and coordinators: circuit demand, lighting, cable runs, shared supports, penetrations and firestopping. |
| [MaterialsAndQuantities.cs](MaterialsAndQuantities.cs) | `Material`, `ProductDefinition`, `AssemblyDefinition`, `AssemblyLayer`, `QuantityScope`, `QuantityObservation`, `MaterialUse`, `QuantityTakeoff` | Estimators, specifiers and sustainability analysts: layered construction, selected quantities, material allocation and explicit measurement gaps. |
| [CommercialAndDelivery.cs](CommercialAndDelivery.cs) | `AnalysisScenario`, `WorkPackage`, `WorkPackageAssignment`, `RateCatalog`, `RateItem`, `EstimateLine`, `EstimateSummary`, `ProcurementRequirement`, `DeliveryBatch`, `DeliveryLine`, `InstallationObservation`, `Milestone` | Estimators, contractors, project managers and suppliers: bids, work scope, procurement, receipt discrepancies, installation progress and schedule checkpoints. |
| [OperationsAndAssessment.cs](OperationsAndAssessment.cs) | `Asset`, `AssetServiceRequirement`, `MaintenanceTask`, `InspectionObservation`, `RequirementSet`, `Requirement`, `Assessment`, `Finding`, `EnvironmentalFactor`, `ImpactLine`, `ImpactSummary`, `ObservationSeries`, `ObservationSample`, `PerformanceResult` | Owners, facility managers, auditors and analysts: handover, service obligations, inspections, carbon contributions and measured/simulated performance. |
| [AnalysisResults.cs](AnalysisResults.cs) | `ObjectChange`, `DataIssue`, `SpatialConflict`, `ServiceTraceResult`, `ServiceTraceMember`, `EgressStudy`, `EgressRoute`, `EgressRouteStep`, `EgressAssessment`, `AcousticResult`, `AcousticBandResult` | Coordinators, safety auditors and specialist analysts: explain changes, missing evidence, geometric candidates, service paths, egress and acoustic results. |
| [Geometry.cs](Geometry.cs) | `CoordinateFrame`, `Placement`, `GeometryRepresentation`, `ServiceAccessEnvelope`, `RouteSegment`; point, vector, bounds and transform values | Every spatial workflow: distinguish project/site/source frames, multiple representations, physical shape, clearance and navigable paths. |
| [IdentityAndEvidence.cs](IdentityAndEvidence.cs) | `ModelSnapshot`, `BimObject`, `SourceDocument`, `SourceRevision`, `SourceObject`, `ObjectCorrespondence`, `InterpretationPolicy`, `Evidence`, `ExternalReference`, `ElementInfo`, `SpatialContext`, `PropertyConcept`, `PropertyObservation`, `Classification`, `ClassificationAssignment` | Everyone: stable identity, source traceability, readable location, conflicting observations and declared interpretation choices. |
| [Values.cs](Values.cs) | Typed keys, `Fact<T>`, `LinkSet<T>`, `Coverage`, dimensional values | Everyone: know the units, distinguish unavailable values, follow relationships and retain completeness. |
| [ModelChecks.cs](ModelChecks.cs) | `ModelViolation` and selected consistency checks | Tool authors: reject misleading complete prices, unsupported spatial claims and conclusions based on incomplete topology or audit evidence. |

Rooms are `Space` records. Beams, columns and braces are `StructuralMember` records with a role and concrete section/length/material fields. Toilets are `SanitaryFixture` occurrences with `ToiletSpecification` detail. These choices share useful fields without multiplying the count of physical things. `Floor` is construction; `Storey` is a named level; `FinishSurface` is an installation scope. They intentionally have different identities.

## How to read a record

Each table record begins with an `Id`. Its XML summary states what one row represents. Its fields describe the meaning of the data independently of its source encoding.

```csharp
SnapshotKey<Door>                // a door row in one model snapshot
ReferenceKey<BimObject>          // the thing's identity across snapshots and representations
Fact<Length>                    // known metres with evidence, or a missing value with a reason
LinkSet<Space>                  // space references plus completeness of that relationship set
```

`ReferenceKey<T>` is a global key; `SnapshotKey<T>` includes both a snapshot key and a local row key. The same local row value in two snapshots is deliberately unequal. A physical component's `ElementInfo.ObjectId` joins its domain row to asset records, observations, quantities and representations. A reference is data, not a lazy-loading object pointer.

One physical thing may have several useful facets. A pump can also be an asset and a work-package member without becoming three purchased pumps. A wall can host two independently measured room-facing finishes. A shared penetration can carry several services while its firestop assembly is counted once.

`Fact<T>.Known` supplies a typed value, assurance and evidence references. `Fact<T>.Missing` records `NotObserved`, `NotExported`, `NotApplicable`, `Invalid` or `Conflicting` with an explanation. Unknown cause uses `NotObserved`; exporter omissions should only be asserted with evidence. A known zero or known false remains an actual value. `LinkSet<T>` similarly distinguishes a complete empty inventory from a collection that has not been observed. Default completeness, assessment, reachability and quantity-selection states deliberately remain unresolved. `ServiceConnection.Basis` distinguishes source-declared, verified and inferred assertions before a traversal chooses which to accept.

The shared evidence, units and keys are infrastructure; useful fields remain on their domain records. For example, roofs expose both `NetSurfaceArea` and `ProjectedArea`, circuits expose connected load separately from demand, and pipes distinguish nominal labels from physical diameters. Flexible property observations preserve extra source information without making every query depend on property-name matching.

## Worked workflow questions

| Question | Query outline | Important interpretation |
|---|---|---|
| How much membrane should the roofer price? | Select `Roof.NetSurfaceArea`; group by assembly and work scope; report missing measurements beside the subtotal. | Projected area is a different quantity. Waste belongs to an explicit pricing/procurement calculation. |
| Which room finishes should be supplied? | Join spaces to `FinishSurface.Spaces`; group by finish/assembly and host-face scope. | Two wall faces are distinct; an unassigned finish must remain visible. |
| What changed in our steel package? | Reconcile `BimObject` identities; compare `StructuralMember` snapshots; intersect with work-package assignments. | A disputed source correspondence is not proof of an addition or deletion. |
| Which circuits lack demand data? | Select circuits for a panel; sum known demand; retain the unresolved circuits. | Connected load and diversified demand answer different questions. |
| What does this isolation valve affect? | Follow accepted `ServiceConnection` rows between ports; publish a trace and its coverage. | Missing exported topology cannot establish physical disconnection. |
| Which shared openings still need review? | Join `ServicePenetration` to passing-service rows, requirement/inspection evidence and installation observations. | Services and firestop assemblies have different counting scopes. |
| Have the specified doors been delivered and installed? | Compare procurement requirements, accepted delivery quantities and dated installation observations. | Received, accepted, installed and assessed are different events. |
| Which material scopes lack carbon factors? | Select disjoint material contributions; match factor unit, product/material and lifecycle module; retain unresolved lines. | Assembly totals must not be added to their parts; climate impact is not every ecological indicator. |
| What is due for maintenance? | Join assets to service requirements, tasks, evidence and access envelopes. | BIM alone does not supply operational history or prove clearance. |
| Can this route meet the stated egress criterion? | Join an explicit study/scenario to ordered route steps and requirement-specific assessments. | A served floor or nearby door does not establish an authorized, walkable, compliant path. |
| Which buildings have comparable performance? | Group `PerformanceResult` by metric/unit, period, method and weather/occupancy assumptions; join building attributes. | An area-normalized simulated result is not directly comparable to unnormalized metered energy. |

The accompanying [tests](../../tests/Ara3D.BimOpenSchema.BuildingModel.Tests) construct these kinds of records and exercise representative joins, grouping and consistency checks. These are synthetic semantic tests, not evidence of complete BOS field mappings.

## Authority, persistence and scale

The C# files are the authoritative detailed definitions for this review edition. [model-coverage.csv](model-coverage.csv) connects all 45 earlier workflow candidates to concrete types and reuses the existing candidate IDs. The catalog retains the users, workflow IDs and priority rationale. Coverage here means **represented in the model**, not implemented as an analysis engine or proven available from every exporter. Additional supporting records are listed above.

The older JSON-generated `contract/generated/BimDataModel.cs` remains a separate 23-table prototype. This expanded edition is authored C#; the previous generator does not produce it. There is no hidden synchronization or second field definition to maintain. A future generator can derive schema/database artifacts from this edition after its semantics settle.

Relational projections can flatten `ElementInfo`, measurements and fact values into ordinary columns, with availability and evidence associations retained. A snapshot key becomes `(snapshot_id, local_id)`; global keys remain global. Relationships can become child/edge tables. High-cardinality collections should be paged or queried as separate rows. Measurements retain their named basis; unavailable numbers become nullable values with an availability reason, not zero. A JSON projection needs explicit tags for known/missing and polymorphic property values. That serialization bridge is not implemented in this project.

These records are suitable for inspecting and returning bounded query results. They do not prescribe allocating a complete portfolio as millions of nested `Fact<T>` objects. Geometry payloads remain externally addressed; trace members, route steps, observation samples and shared associations already have separate row types. Columnar BFAST/database preparation, indexes and selective hydration are separate work. The ten-second prepared-open target and 16 GiB process-memory budget remain requirements, not measured achievements of these definitions.

This is a broad initial model, not an exhaustive engineering standard. The current carbon model addresses kg CO2e; detailed equipment performance curves, every specialist ecological indicator and fabrication-specific taxonomies need concrete cases before expansion. External prices, requirements, inspection history and specialist results must be supplied or computed. Record construction alone does not validate foreign-key existence, finite dimensions, enum values, every domain range or engineering truth; `ModelChecks` deliberately covers only selected high-value consistency rules.

## Build and review

Open [BimBuildingModel.sln](../../BimBuildingModel.sln) in Visual Studio to browse this model and its tests. The solution also includes the older generated contract in a separate `Earlier generated contract` folder, with its own library and compile harness. The two model libraries have different namespaces and no dependency on each other.

The generated library can also be opened directly through [Ara3D.BimOpenSchema.QueryModel.Review.csproj](../../docs/proposals/bim-query-platform/contract/generated/Ara3D.BimOpenSchema.QueryModel.Review.csproj). It compiles the existing generated source without copying it or running Python during a build. Regeneration remains an explicit step described in [GENERATION.md](../../docs/proposals/bim-query-platform/contract/GENERATION.md).

```powershell
dotnet build BimBuildingModel.sln
dotnet test tests/Ara3D.BimOpenSchema.BuildingModel.Tests/Ara3D.BimOpenSchema.BuildingModel.Tests.csproj
dotnet test tests/Ara3D.BimOpenSchema.BuildingModel.Tests/Ara3D.BimOpenSchema.BuildingModel.Tests.csproj --no-build --filter "TestCategory=Workflow.MepTrace"
```

Run from the repository root. Tests carry independent size, stage, source, feature and workflow categories. The project directly imports the existing Platonic configuration and compiles with its analyzers. See [TOOLS-AND-PROCESS.md](TOOLS-AND-PROCESS.md) for the requested integration/process summary and the exact boundary between this model, the older contract and future storage work.

Validation on 2026-09-06: the model and test projects compiled with the Platonic analyzers enabled; all **40 tests passed**, with no skipped tests. The suite includes cross-domain workflow examples, consistency checks, snapshot-key checks and a check that every catalog mapping names a compiled type. These results validate the modeled semantics exercised by those examples, not real-file mapping completeness or large-model performance.

See [ASSESSMENT.md](ASSESSMENT.md) for the implementation assessment and recommended next milestones.

The [workflow implementation](../Ara3D.BimOpenSchema.BuildingModel.Workflows/README.md) now exercises this model with BFAST-prepared versions of the three supplied BOS samples, typed operational calculations and persistence checks. See the [measured results and remaining input gaps](../../tools/building-model-workflows/VALIDATION.md).
