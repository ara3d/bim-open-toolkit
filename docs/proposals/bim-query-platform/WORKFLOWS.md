# People and workflow catalog

Companion to [the redesign plan](PLAN.md). These are proposed query surfaces and acceptance
stories, not claims that all required information is already present in BOS.

Each workflow should produce a useful result plus its coverage, units, basis and evidence.
When an exporter omitted data, the result must distinguish that limitation from the physical
absence of an object, connection or requirement. The generally more reliable Revit-derived corpus
will inform semantic examples; imperfect IFC exports remain important stress and data-gap cases.

## 1. Trade and profession views

| Person / trade | Questions they should be able to ask | Proposed useful tables | Additional facts or derivations often required |
|---|---|---|---|
| Cost estimator / quantity surveyor | What quantities belong in this bid? Which priced quantities have uncertain scope? What changed between deliveries? | TradeTakeoff, EstimateItems, QuantityCoverage, RevisionChanges | Measurement rules, rate library, currency/date/region, waste and contingency policies |
| Project manager | Which building/storey/package is ready? Which missing decisions or deliveries affect planned work? | WorkPackages, Milestones, Deliveries, ReadinessFindings | Schedule, responsibilities, status and dependencies; geometry alone does not provide these |
| General contractor / coordinator | Where do scopes overlap? Which penetrations or access zones need coordination? | CoordinationItems, TradeScopes, Penetrations, ClearanceCandidates | Trade assignments, coordination rules, exact geometry where needed |
| Roofing contractor | How much roof membrane/insulation is required by assembly and slope? Where are edges, drains, upstands and penetrations? | RoofTakeoff, RoofAssemblies, RoofEdges, RoofPenetrations | True surface area, layer thickness, gross/net treatment, waste rules; a plan footprint is not sloped area |
| Facade / glazing contractor | What panels, windows and interfaces are needed by elevation and specification? | FacadeSchedule, WindowSchedule, GlazingAreas, InterfaceDetails | Panelization, elevation/orientation, performance specifications, supplier data |
| Drywall / partition contractor | How much lining per face/layer? Which walls need fire or acoustic treatment? | PartitionSchedule, WallFaces, FinishLayers, OpeningDeductions | Face/layer accounting, opening-deduction rules, joint details and specifications |
| Painter / finishing contractor | Which rooms and surfaces receive each finish? What preparation and coats are specified? | FinishSchedule, FinishSurfaces, RoomFinishSummary | Surface assignment, coverage rates, coat count, preparation specification |
| Flooring / tiling contractor | What floor finish area, skirting length and transitions are required by space? | FloorFinishTakeoff, RoomPerimeters, FinishTransitions | Net usable areas, exclusions, layout/waste assumptions |
| Ceiling contractor | Where are suspended ceilings, soffits, access panels and finish changes? | CeilingSchedule, CeilingAreas, AccessPanels | Height/offset, support system, service-access constraints |
| Door / hardware supplier | Which openings need which leaf, frame, hardware and rating? Are handedness and clear width known? | DoorSchedule, DoorAssemblies, HardwareSets | Hardware/specification links, verified clear opening, rating interpretation |
| Electrical engineer / electrician | Which devices belong to a circuit/panel? What cable/conduit/tray routes and lengths are supported by evidence? | ElectricalEquipment, Circuits, CableRoutes, PanelSchedules | Ports/connections, load data, routing assumptions and conductors; proximity is not connection |
| Mechanical engineer / HVAC contractor | What equipment serves a zone? What duct/fitting/insulation quantities and maintenance access are needed? | MechanicalEquipment, AirSystems, DuctTakeoff, ServiceZones | System topology, design flows, insulation definitions, maintenance envelopes |
| Plumbing / sanitation engineer and trade | Which fixtures connect to which supply/waste network? What lengths, slopes, sizes and fittings are required? | PlumbingFixtures, PipeRuns, DrainageNetworks, FittingSchedule | Flow direction, elevation/centerline data, source connectivity and design criteria |
| Fire-protection trade | What devices and pipes belong to protection zones? Which required design facts are missing? | ProtectionDevices, ProtectionSystems, CoverageInputs | Hazard/design classifications and applicable design rules; no coverage claim from device counts alone |
| Structural engineer | What members, supports and connections form a structural system? Which analysis properties are missing? | StructuralMembers, StructuralConnections, StructuralSystems | Analytical idealization, support/load assumptions, material properties |
| Concrete / rebar / steel / timber trade | What material quantities and member schedules are needed by pour, erection package or grade? | StructuralMaterialTakeoff, MemberSchedules, Reinforcement, PourPackages | Verified volumes/mass/length, constituent detail, fabrication and construction grouping |
| Civil engineer / earthworks trade | What terrain, cut/fill, paving and drainage quantities are relevant to this site? | TerrainSurfaces, EarthworkScenarios, PavedAreas, SiteDrainage | Survey frames, existing/proposed surfaces, volume-comparison method |
| Landscape architect / contractor | What planting, soil, irrigation, permeable surface and hardscape quantities are needed? | PlantingSchedule, LandscapeAreas, SoilLayers, IrrigationAssets | Species/specifications, depths, maintenance and water-demand assumptions |
| Architect | How are spaces organized? Which envelope and opening specifications are incomplete or inconsistent? | SpaceSchedule, Adjacencies, EnvelopeSummary, DesignFindings | Program requirements, geometric boundaries, classifications and specifications |
| Interior designer | Which room types, finishes, fixtures and furniture form the interior package? | RoomDataSheets, FinishSchedule, FurnitureSchedule | Design intent, material/specification links, room-facing surface associations |
| Safety auditor / site safety planner | Which work areas have exposure, access or coordination issues? What evidence supports each finding? | WorkAreas, HazardObservations, AccessRoutes, SafetyFindings | Work phase, temporary objects, rules and inspection observations |
| Egress / accessibility reviewer | Which spaces have a supported route to an exit? What widths, obstructions and unresolved assumptions affect the analysis? | Spaces, Portals, RouteSegments, EgressAssessments | Verified navigable topology, usable geometry, occupancy assumptions and versioned jurisdiction rules |
| Owner / asset manager | What do we own, where is it, and how complete is handover? What renewal or investment scenarios differ? | AssetRegister, HandoverCoverage, ReplacementScenarios | Ownership, valuation, service life, manuals, warranties and condition data |
| Facility manager | Which assets serve this room? What is affected by isolating equipment? Which maintenance records are missing? | MaintainableAssets, ServiceDependencies, MaintenanceRequirements | Verified operational topology, maintenance schedules, external work orders |
| Energy / building-performance analyst | Which spaces and envelope systems define a scenario? How do modeled/observed results compare? | PerformanceInputs, EnvelopeThermalData, ObservationSeries, ScenarioResults | Weather, occupancy, constructions, simulation/measurement sources and time periods |
| Sustainability / ecological-impact analyst | What embodied impacts are attributable to each material/package? Which areas and assets affect water, reuse or habitat scenarios? | MaterialUse, ImpactResults, WaterScenarios, LandCover | EPDs/factors, quantities, lifecycle boundaries, geography, reuse assumptions and uncertainty |
| Portfolio analyst | Which buildings have the greatest cost, carbon, missing-data or maintenance exposure on a comparable basis? | BuildingMetrics, PortfolioCoverage, ScenarioComparisons | Comparable units, area/asset definitions, version selections and shared reference data |

The same person can use multiple views. The schema should not encode a rigid role hierarchy or
restrict electricians to one database. Cross-trade questions use shared objects and definitions.

## 2. Cross-cutting analytical products

| Product | A row represents | Common readable context | Protection against misleading results |
|---|---|---|---|
| Component schedule | One identified occurrence in one snapshot | Building, storey, spaces, category/type, description and selected specification fields | Separate type/template/source representation from countable occurrence |
| Trade takeoff | One quantity contribution at a declared component/material/scope basis | Location, trade/package, assembly, material, quantity/unit, gross/net basis | No repeated-source, assembly/part or material allocation double counting |
| Estimate | One priced scope line in a scenario | Package, location, quantity basis, rate, currency/date, assumptions | Explicit unpriced/uncertain quantities and coverage |
| Material impact | One material contribution under one factor/scenario boundary | Component, material, quantity, factor reference, scenario and impact measure | Avoid mixing factor units/lifecycle boundaries or applying multiple alternatives together |
| Delivery audit | One requirement assessed against a subject/delivery | Subject, location, requirement, result, evidence and responsibility | Pass/fail/not-applicable/unknown are distinct; exporter omission cannot be a pass |
| Coordination finding | One relationship or spatial issue under an analysis rule | Participants, location, geometric evidence, rule/version and status | Bounds candidates distinguished from exact confirmed intersections |
| Maintenance dependency | One supported service/dependency relationship | Asset/system, served space, connection evidence and operational context | Missing topology is not proof of no downstream impact |
| Portfolio metric | One building/period/scenario metric on a declared basis | Building, source revision, definition, unit, coverage and provenance | Aggregate compatible metrics, never totals from overlapping snapshots |

Do not store results of every possible scenario eagerly. Persist reusable measurement facts and
expensive analyses; compute scenario-specific totals from explicitly selected inputs.

## 3. Initial acceptance stories

These stories test different pressures on the shared model. They are intended to be implemented
and reviewed before the physical schema is considered stable.

1. **Roofer:** select a building and get roof surface area by membrane/insulation assembly, plus
   penetrations and unmeasured areas. Explain why a surface area differs from a projected footprint.
2. **Estimator:** price a selected trade package from a versioned rate set. Report included,
   excluded, unknown and unpriced quantities. Recompute a waste scenario without rebuilding geometry.
3. **Interior designer/finisher:** produce a room-facing finish schedule, including walls shared
   between rooms and elements without complete geometry. Preserve conflicting finish observations.
4. **Delivery auditor:** identify doors missing a required rating or usable width. Distinguish a
   missing property from an unsupported exporter feature, an invalid value and a rule that does not apply.
5. **MEP specialist:** trace the supported path from equipment to served spaces through ports and
   connections. Display unresolved links and avoid using proximity as evidence of connectivity.
6. **Egress reviewer:** construct an analysis-ready spaces/portals graph with width and evidence
   coverage. Evaluate a defined scenario only when its required inputs and rules are supplied.
   Missing topology produces an incomplete assessment, not a safety assurance.
7. **Facility manager/owner:** locate a maintainable asset, open an appropriate representation,
   list service dependencies and show missing handover records without loading all building geometry.
8. **Sustainability/portfolio analyst:** compare material impacts across buildings under the same
   factor versions and boundaries. Show coverage and prevent multiple source representations of
   the same physical object from multiplying the total.

Each story needs a small, independently checkable fixture, representative Revit-derived examples,
an IFC-derived stress case with exporter gaps, SQL/API parity, and a stated latency/memory budget.
If required facts are absent in a supplied building, the correct acceptance result is an explicit
gap plus a supported partial answer—not a made-up complete result.

## 4. Information outside BOS

Some useful facts will come from specifications, schedules, surveys, rates, product/EPD catalogs,
inspection records, work orders, sensors or simulation outputs. The model needs identities and
links for them even when it cannot ingest each source in the first release.

Reference datasets should be separately versioned and joined through explicit mappings. A
manufacturer name does not uniquely establish a product or environmental factor. Work packages,
prices and safety rules do not become building facts merely because an agent supplied them.
Store the source, authority, revision and assumptions of supplemental information.

The initial public bridge should make these distinctions easy to see: what is known, what was
derived, what was supplied externally, and what remains unknown.
